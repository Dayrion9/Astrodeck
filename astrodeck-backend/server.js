// astrodeck-backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

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

// CORS restrito por lista (CORS_ORIGIN="http://localhost:8080,https://seudominio.com")
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

// Arquivos estáticos
app.use('/static', express.static('public'));

// ===== ROTAS =====

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  const webIndex = path.join(__dirname, 'public_web', 'index.html');
  if (fs.existsSync(webIndex)) return res.sendFile(webIndex);
  return res.send('Backend ASTRODECK rodando com tarotapi.dev + n8n + Supabase 🔮');
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
app.post('/api/reading', async (req, res) => {
  const { topic, userId } = req.body;

  if (!topic || !userId) {
    return res.status(400).json({ error: 'topic e userId são obrigatórios.' });
  }

  // 1) Buscar e normalizar dados do usuário (premium + coins)
  let safeIsPremium = false;
  let userCoins = 0;

  try {
    const userData = await getUserWithNormalizedPremium(userId);

    if (!userData) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    safeIsPremium = !!userData.isPremium;
    userCoins = userData.coins || 0;
  } catch (err) {
    console.error('Erro ao buscar usuário:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }

  // 2) Se não for premium e não tiver moedas, bloqueia
  if (!safeIsPremium && userCoins <= 0) {
    return res.status(403).json({
      error: 'Você não tem moedas suficientes para fazer uma nova leitura.',
      code: 'NO_COINS',
      isPremium: safeIsPremium,
      coins: userCoins,
    });
  }

  // 3) Se não for premium e tem moedas, consumir 1 moeda
  if (!safeIsPremium && userCoins > 0) {
    try {
      const { data: updated, error } = await supabase
        .from('users')
        .update({ coins: userCoins - 1 })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar moedas:', error);
        return res.status(500).json({ error: 'Erro ao consumir moeda.' });
      }

      userCoins = updated.coins || 0;
    } catch (err) {
      console.error('Erro ao consumir moeda:', err?.message || err);
      return res.status(500).json({ error: 'Erro ao consumir moeda.' });
    }
  }

  // 4) Sorteio das cartas via tarotapi.dev
  try {
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
      name_pt: translateCardName(card.name),
    }));

    // 3) Descobre base URL (CARD_IMAGE_BASE_URL ou fallback pro próprio servidor)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const cardImageBaseUrl =
      CARD_IMAGE_BASE_URL || `${protocol}://${host}/static/tarot`;

    const ensurePng = (nameShort, fallback) => {
      if (!nameShort) return fallback;
      const cleaned = String(nameShort).trim();
      if (!cleaned) return fallback;
      return cleaned.endsWith('.png') ? cleaned : `${cleaned}.png`;
    };

    // 4) Monta payload para n8n
    const payloadForN8n = {
      topic,
      userId,
      isPremium: safeIsPremium,
      coins: userCoins,
      cards: allCards,
      card_image_base_url: cardImageBaseUrl,
      public_base_url: PUBLIC_BASE_URL,
    };

    // 5) Resposta padrão (caso n8n não esteja configurado)
    let resultTopic = topic;
    let resultCards = allCards.map((c) => {
      const fileName = ensurePng(c.name_short, null);
      const imageUrl = fileName ? `${cardImageBaseUrl}/${fileName}` : null;

      return {
        name_pt: c.name_pt || '',
        file_name: fileName,
        image_url: imageUrl,
      };
    });
    let resultDesc = '';

    // 6) Envia para n8n (se configurado) e monta resposta final
    if (N8N_WEBHOOK_URL) {
      try {
        const n8nResp = await axios.post(N8N_WEBHOOK_URL, payloadForN8n);
        console.log('Enviado para n8n. Status:', n8nResp.status);

        const dataFromN8n = n8nResp.data;
        const item = Array.isArray(dataFromN8n) ? dataFromN8n[0] : dataFromN8n;

        const body = item?.body || {};

        if (item.topic) resultTopic = item.topic;

        if (typeof body.isPremium === 'boolean') safeIsPremium = body.isPremium;
        if (typeof body.coins === 'number') userCoins = body.coins;

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
        } else if (item.primaryCard) {
          // FREE: primaryCard (uma carta)
          const primaryCard = item.primaryCard;
          const c = allCards[0] || primaryCard;

          const fileName = ensurePng(
            primaryCard.file_name || primaryCard.fileName,
            null
          );
          const imageUrl = fileName ? `${cardImageBaseUrl}/${fileName}` : null;

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
        console.error('Erro ao enviar para n8n:', err?.response?.data || err.message);
        // não falha o fluxo; devolve leitura sem n8n
      }
    }

    return res.json({
      topic: resultTopic,
      cards: resultCards,
      card_desc: resultDesc,
      isPremium: safeIsPremium,
      coins: userCoins,
    });
  } catch (err) {
    if (err.response) {
      console.error('Erro tarotapi.dev:', err.response.status, err.response.data);
      return res.status(500).json({
        error: 'Erro ao buscar cartas na API de tarot.',
        status: err.response.status,
        details: err.response.data,
      });
    }

    if (err.request) {
      console.error('Erro de rede/axios:', err.message);
      return res.status(500).json({
        error: 'Erro ao processar tiragem (rede ou axios).',
        details: err.message,
      });
    }

    console.error('Erro inesperado:', err);
    return res.status(500).json({
      error: 'Erro inesperado ao processar tiragem.',
      details: err.message,
    });
  }
});


// Em produção (Docker), servir o frontend buildado (Vite) se existir.
// O build é copiado para ./public_web no container.
const webDir = path.join(__dirname, 'public_web');
const webIndex = path.join(webDir, 'index.html');
if (fs.existsSync(webIndex)) {
  app.use(express.static(webDir));

  // SPA fallback
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/static')) return next();
    return res.sendFile(webIndex);
  });
}

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
