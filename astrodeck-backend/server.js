// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const authRoutes = require('./authRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const paymentsRoutes = require('./paymentsRoutes');
const pushRoutes = require('./pushRoutes');
const { getUserWithNormalizedPremium } = require('./premiumUtils');
const { translateCardName } = require('./languages/ptbr');
const { supabase } = require('./supabaseClient');
const push = require('./pushService');
const { logLine } = require('./paymentLogger');

const app = express();
// Base pública para montar image_url (útil em produção)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');


// ===== CONFIGURAÇÕES =====
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // ex: http://localhost:5678/webhook/tarot-carta
const CARD_IMAGE_BASE_URL = process.env.CARD_IMAGE_BASE_URL; // ex: http://192.168.2.183:3000/static/tarot

// Base da tarotapi.dev
const TAROTAPI_BASE_URL = 'https://tarotapi.dev/api/v1';

// ===== MIDDLEWARES =====

// servir arquivos estáticos (imagens, etc.) – pasta "public"
app.use('/static', express.static('public'));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // permite requests sem Origin (curl/postman)
    if (!origin) return cb(null, true);
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// Express 5 + path-to-regexp: use regex instead of "*"
app.options(/.*/, cors(corsOptions));

app.use(express.json());
// Rotas de autenticação (Supabase)
app.use('/api/auth', authRoutes);

// Rotas de assinatura / premium (ativação manual por X dias, etc.)
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/push', pushRoutes);


// ===== ROTAS =====

// Healthcheck simples
app.get('/', (req, res) => {
  res.send('Backend ASTRODECK rodando com tarotapi.dev + n8n + Supabase 🔮');
});

/**
 * Rota principal:
 * - recebe topic (texto livre) e userId do app
 * - normaliza status premium + moedas do usuário no Supabase
 * - se não tiver moedas, bloqueia e devolve erro NO_COINS
 * - sorteia cartas na tarotapi.dev
 * - adiciona name_pt
 * - envia tudo para o n8n
 * - usa a resposta do n8n (card_desc, cards/primaryCard) para montar retorno pro front
 *
 * Body esperado:
 * {
 *   "topic": "texto livre digitado pelo usuário",
 *   "userId": "uuid-do-supabase"
 * }
 *
 * OBS: o status premium e as moedas NÃO são confiados vindo do app.
 * Sempre buscamos e normalizamos no Supabase via getUserWithNormalizedPremium.
 */
app.post('/api/tarot-reading', async (req, res) => {
  try {
    const { topic, userId } = req.body;

    // topic agora é texto livre, mas validamos se não veio vazio
    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({
        error: 'topic deve ser um texto com pelo menos 3 caracteres',
      });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const normalizedTopic = topic.trim();

    // pega o usuário no Supabase e normaliza premium + moedas (regra diária)
    const user = await getUserWithNormalizedPremium(userId);
    const safeIsPremium = !!user.is_premium;
    let userCoins = user.coins ?? 0;

    // Sem moedas suficientes para tirar carta
    if (userCoins <= 0) {
      return res.status(403).json({
        error: 'NO_COINS',
        message:
          'Você não possui moedas suficientes para uma nova tiragem hoje.',
        isPremium: safeIsPremium,
        coins: userCoins,
      });
    }

    // 1) Sorteia cartas na tarotapi.dev
    const url = `${TAROTAPI_BASE_URL}/cards/random`;
    const n = 3; // quantidade de cartas na tiragem

    const tarotResp = await axios.get(url, { params: { n } });
    const data = tarotResp.data;

    if (!data || !Array.isArray(data.cards) || data.cards.length === 0) {
      return res
        .status(500)
        .json({ error: 'Resposta inesperada da tarotapi.dev.' });
    }

    let allCards = data.cards;

    // 2) Adiciona name_pt nas cartas usando o módulo de linguagem
    allCards = allCards.map((card) => ({
      ...card,
      name_pt: translateCardName(card),
    }));

    const primaryCard = allCards[0];

    // 3) Monta payload para o n8n
    const payloadForN8n = {
      topic: normalizedTopic, // texto livre
      userId, // id do usuário (uuid do Supabase)
      isPremium: safeIsPremium, // status da assinatura vindo do banco
      primaryCard, // carta principal já com name_pt
      cards: allCards,
      source: 'astrodeck-backend',
    };

    // Valores padrão (caso n8n falhe)
    let resultTopic = normalizedTopic;
    let resultIsPremium = safeIsPremium;
    let resultDesc = null;

    // cartões padrão (free: só uma carta)
    let resultCards = [
      {
        name_pt: primaryCard.name_pt || primaryCard.name,
        file_name: `${primaryCard.name_short}.png`,
      },
    ];

    // pegar protocol e host da requisição (para montar URLs)
    const protocol = req.protocol; // 'http'
    const host = req.get('host'); // ex: '10.0.2.2:3000' ou '192.168.0.15:3000'

    // base das imagens (env ou host atual)
    const cardImageBaseUrl =
      CARD_IMAGE_BASE_URL || `${protocol}://${host}/static/tarot`;

    // helper local pra garantir .png
    const ensurePng = (raw, fallback) => {
      const base = raw || fallback;
      if (!base) return null;
      return base.endsWith('.png') ? base : `${base}.png`;
    };

    // 4) Envia para n8n e lê resposta
    if (N8N_WEBHOOK_URL) {
      try {
        const n8nResp = await axios.post(N8N_WEBHOOK_URL, payloadForN8n);
        console.log('Enviado para n8n. Status:', n8nResp.status);

        const dataFromN8n = n8nResp.data;
        const item = Array.isArray(dataFromN8n) ? dataFromN8n[0] : dataFromN8n;

        if (item.topic) {
          // se o n8n quiser ajustar o tópico, deixamos
          resultTopic = item.topic;
        }

        const body = item.body || {};
        if (typeof body.isPremium === 'boolean') {
          resultIsPremium = body.isPremium;
        } else {
          // se o n8n não devolver nada sobre premium, usamos o do banco
          resultIsPremium = safeIsPremium;
        }

        // PREMIUM: body.cards (lista de cartas)
        if (Array.isArray(body.cards) && body.cards.length > 0) {
          resultCards = body.cards.map((c) => {
            const fileName = ensurePng(c.name_short, null);
            const imageUrl = fileName
              ? `${cardImageBaseUrl}/${fileName}`
              : null;

            return {
              name_pt: c.name_pt || '',
              file_name: fileName,
              image_url: imageUrl,
            };
          });
        } else if (body.primaryCard) {
          // FREE (ou fallback): primaryCard
          const c = body.primaryCard;
          const fileName = ensurePng(c.name_short, primaryCard.name_short);
          const imageUrl = fileName
            ? `${cardImageBaseUrl}/${fileName}`
            : null;

          resultCards = [
            {
              name_pt: c.name_pt || primaryCard.name_pt || primaryCard.name,
              file_name: fileName,
              image_url: imageUrl,
            },
          ];
        }

        if (item.card_desc) {
          resultDesc = item.card_desc;
        }
      } catch (err) {
        console.error(
          'Erro ao enviar carta para n8n:',
          err.response?.status,
          err.response?.data || err.message
        );
      }
    } else {
      console.warn('N8N_WEBHOOK_URL não definido no .env');
    }

    // 5) Para qualquer carta que ainda não tenha image_url (fallback), monta aqui
    resultCards = resultCards.map((card) => {
      if (!card.file_name) return card;
      if (card.image_url) return card;

      return {
        ...card,
        image_url: `${cardImageBaseUrl}/${card.file_name}`,
      };
    });

    // 6) Desconta 1 moeda pela tiragem
    let finalCoins = Math.max(userCoins - 1, 0);

    try {
      const { data: updatedUser, error: coinsError } = await supabase
        .from('users')
        .update({ coins: finalCoins })
        .eq('id', userId)
        .select()
        .single();

      if (!coinsError && updatedUser) {
        finalCoins = updatedUser.coins ?? finalCoins;
      }
    } catch (e) {
      console.error('Erro ao atualizar moedas após tiragem:', e.message);
    }

    // 7) Push: leitura pronta
    try {
      const payload = push.buildPayload({
        title: 'Sua leitura está pronta 🔮',
        body: 'Toque para ver o resultado no Astrodeck.',
        url: '/',
        tag: 'tarot-ready',
      });

      // Dedup por minuto (evita spam em replays rápidos)
      const ref = `${String(userId)}:${new Date().toISOString().slice(0, 16)}`;
      await push.sendToUser(userId, payload, { dedupeKind: 'tarot_ready', dedupeRef: ref });
    } catch (e) {
      logLine('tarot_ready_push_failed', { userId, message: e?.message || String(e) });
    }

    // 8) Resposta final para o app (front)
    return res.json({
      topic: resultTopic, // texto livre (pergunta/tema)
      isPremium: resultIsPremium,
      userId,
      cards: resultCards,
      description: resultDesc,
      coins: finalCoins,
    });
  } catch (err) {
    if (err.response) {
      console.error(
        'Erro na tarotapi.dev:',
        err.response.status,
        JSON.stringify(err.response.data, null, 2)
      );
      return res.status(500).json({
        error: 'Erro na tarotapi.dev',
        status: err.response.status,
        details: err.response.data,
      });
    } else {
      console.error('Erro de rede/axios:', err.message);
      return res.status(500).json({
        error: 'Erro ao processar tiragem (rede ou axios).',
        details: err.message,
      });
    }
  }
});

// Sobe o servidor

// ===== PUSH CRON (opcional) =====
// Envia alerta de expiração do Premium (ex: 3 dias antes).
// Ative com ENABLE_PUSH_CRON=true e configure VAPID_... no .env
if (String(process.env.ENABLE_PUSH_CRON || '').toLowerCase() === 'true') {
  try {
    require('./pushCron').start();
  } catch (e) {
    console.error('Falha ao iniciar pushCron:', e?.message || e);
  }
}

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('N8N_WEBHOOK_URL:', N8N_WEBHOOK_URL || 'não definido');
  console.log('CARD_IMAGE_BASE_URL:', CARD_IMAGE_BASE_URL || 'não definido');
});
