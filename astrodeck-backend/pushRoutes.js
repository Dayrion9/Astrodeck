// pushRoutes.js
const express = require('express');
const { requireAuth } = require('./authCookie');
const push = require('./pushService');

const router = express.Router();

const ENABLE_PUSH_TEST_ENDPOINT = String(process.env.ENABLE_PUSH_TEST_ENDPOINT || '').toLowerCase() === 'true';
const ENABLE_PUSH_SIMULATE_ENDPOINT = String(process.env.ENABLE_PUSH_SIMULATE_ENDPOINT || '').toLowerCase() === 'true';

router.get('/vapid-public-key', (req, res) => {
  try {
    return res.json({ publicKey: push.getPublicKey() });
  } catch (e) {
    return res.status(500).json({ error: 'VAPID_KEYS_MISSING', hint: 'Configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no .env do backend.' });
  }
});

router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    const ua = req.headers['user-agent'] || '';
    await push.upsertSubscription(req.user.id, subscription, ua);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.code || 'SUBSCRIBE_FAILED', message: e.message });
  }
});

router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'MISSING_ENDPOINT' });
    await push.removeSubscription(req.user.id, endpoint);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'UNSUBSCRIBE_FAILED' });
  }
});

// Small helper for testing (dev only)
router.post('/test', requireAuth, async (req, res) => {
  if (!ENABLE_PUSH_TEST_ENDPOINT) {
    return res.status(404).json({ error: 'PUSH_TEST_DISABLED', hint: 'Ative ENABLE_PUSH_TEST_ENDPOINT=true no .env do backend para usar este endpoint.' });
  }

  try {
    const payload = push.buildPayload({
      title: 'Astrodeck',
      body: 'Notificação de teste ✅',
      url: '/',
      tag: 'test',
    });

    const r = await push.sendToUser(req.user.id, payload, { dedupeKind: 'test', dedupeRef: String(Date.now()) });
    return res.json({ ok: true, result: r });
  } catch (e) {
    return res.status(500).json({ error: 'PUSH_TEST_FAILED', message: e.message });
  }
});



router.post('/simulate', requireAuth, async (req, res) => {
  if (!ENABLE_PUSH_SIMULATE_ENDPOINT) {
    return res.status(404).json({
      error: 'PUSH_SIMULATE_DISABLED',
      hint: 'Ative ENABLE_PUSH_SIMULATE_ENDPOINT=true no .env do backend para usar este endpoint.',
    });
  }

  try {
    const event = String(req.body?.event || '').trim();

    const templates = {
      coins_refresh: { title: 'Moedas diárias liberadas ✨', body: 'Você recebeu +5 moedas.', url: '/', tag: 'coins-refresh' },
      premium_expiring: { title: 'Seu Premium está para expirar', body: 'Faltam ~3 dias. Renove para continuar ✨', url: '/premium', tag: 'premium-expiry' },
      tarot_ready: { title: 'Sua leitura está pronta 🔮', body: 'Toque para ver o resultado no Astrodeck.', url: '/', tag: 'tarot-ready' },
      payment_coins: { title: 'Pagamento confirmado ✅', body: 'Suas moedas foram adicionadas.', url: '/', tag: 'payment-applied' },
      payment_premium: { title: 'Pagamento confirmado ✅', body: 'Seu Premium foi ativado.', url: '/premium', tag: 'payment-applied' },
    };

    const t = templates[event];
    if (!t) {
      return res.status(400).json({
        error: 'INVALID_EVENT',
        hint: 'Use: coins_refresh | premium_expiring | tarot_ready | payment_coins | payment_premium',
      });
    }

    const payload = push.buildPayload(t);
    const ref = `simulate:${event}:${Date.now()}`;

    const r = await push.sendToUser(req.user.id, payload, { dedupeKind: `simulate_${event}`, dedupeRef: ref });
    return res.json({ ok: true, event, result: r });
  } catch (e) {
    return res.status(500).json({ error: 'PUSH_SIMULATE_FAILED', message: e?.message || String(e) });
  }
});

module.exports = router;
