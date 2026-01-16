const express = require('express');
const util = require('util');
const { requireAuth } = require('./authCookie');
const { supabase } = require('./supabaseClient');
const { premiumPlans, coinPacks, splits } = require('./paymentConfig');
const dustpay = require('./dustpayClient');
const { logLine } = require('./paymentLogger');
const push = require('./pushService');

const router = express.Router();

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D+/g, '');
  const with55 = digits.startsWith('55') ? digits : `55${digits}`;
  // DustPay valida telefone no formato E.164 (ex: +5551999972948)
  return with55.startsWith('+') ? with55 : `+${with55}`;
}


function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeDustpaySplits(totalAmount, rawSplits) {
  if (!Array.isArray(rawSplits) || rawSplits.length === 0) return [];

  // Backward compatibility: if a split already uses fixed amount, pass through.
  const hasAnyAmount = rawSplits.some((s) => s && s.amount !== undefined && s.amount !== null);
  if (hasAnyAmount) {
    return rawSplits
      .filter((s) => s?.producerId)
      .map((s) => ({ producerId: s.producerId, amount: round2(s.amount) }));
  }

  // Percent-based rules: [{ producerId, percent }]
  const rules = rawSplits
    .filter((s) => s?.producerId)
    .map((s) => ({
      producerId: s.producerId,
      percent: Number(s.percent ?? s.percentage ?? s.pct ?? 0),
    }))
    .filter((s) => Number.isFinite(s.percent) && s.percent > 0);

  if (rules.length === 0) return [];

  const sumPercent = rules.reduce((acc, r) => acc + r.percent, 0);
  if (sumPercent > 100.0001) {
    const e = new Error('SPLIT_PERCENT_GT_100');
    e.code = 'SPLIT_PERCENT_GT_100';
    throw e;
  }

  const totalCents = Math.round(Number(totalAmount) * 100);

  // If splits add up to 100%, adjust last split to match cents exactly.
  const adjustLast = Math.abs(sumPercent - 100) < 0.0001;

  let used = 0;
  const out = rules.map((r, i) => {
    let cents = Math.round((totalCents * r.percent) / 100);

    if (adjustLast && i === rules.length - 1) {
      cents = Math.max(0, totalCents - used);
    } else {
      used += cents;
    }

    return { producerId: r.producerId, amount: round2(cents / 100) };
  });

  return out;
}

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function publicUrl() {
  return (process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`)
    .replace(/\/+$/, '');
}

function buildIdentifier(kind, itemId, userId) {
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2, 10);
  return `ad_${kind}_${itemId}_${userId}_${ts}_${rand}`;
}

function extractStatusFromDustpay(data) {
  // Try common shapes
  const direct = data?.status || data?.transactionStatus || data?.transaction_status;
  if (direct) return String(direct);

  const nested =
    data?.transaction?.status ||
    data?.data?.status ||
    data?.payment?.status ||
    data?.pixInformation?.status;

  return nested ? String(nested) : '';
}

function isPaidStatus(rawStatus) {
  const s = String(rawStatus || '').toUpperCase();
  return ['PAID', 'PAYED', 'PAID_OUT', 'CONFIRMED', 'COMPLETED', 'PAGO', 'APPROVED'].includes(s);
}

function extractPixInfo(dustpayResponse) {
  const pix = dustpayResponse?.pixInformation || dustpayResponse?.pix_info || dustpayResponse?.pix || null;

  const candidates = [
    pix?.qrCode,
    pix?.qr_code,
    pix?.copyPaste,
    pix?.copy_paste,
    pix?.emv,
    pix?.brCode,
    pix?.brcode,
    dustpayResponse?.qrCode,
    dustpayResponse?.qr_code,
    dustpayResponse?.copyPaste,
    dustpayResponse?.copy_paste,
    dustpayResponse?.emv,
    dustpayResponse?.brCode,
    dustpayResponse?.brcode,
  ];

  function looksLikePixCode(s) {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    if (!t) return false;
    return t.startsWith('000201') || t.includes('BR.GOV.BCB.PIX') || t.length > 80;
  }

  function looksLikeBase64Image(s) {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    if (!t) return false;
    if (t.startsWith('data:image/')) return true;
    // PNG base64 often starts with iVBOR
    return t.startsWith('iVBOR') || t.startsWith('/9j/'); // jpeg
  }

  function deepFind(obj, predicate, depth = 0) {
    if (!obj || depth > 6) return null;
    if (typeof obj === 'string') return predicate(obj) ? obj : null;
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const found = deepFind(it, predicate, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const found = deepFind(obj[k], predicate, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  let qrCodeText = candidates.find(looksLikePixCode) || null;
  if (!qrCodeText) qrCodeText = deepFind(dustpayResponse, looksLikePixCode);

  let qrCodeImage = candidates.find(looksLikeBase64Image) || null;
  if (!qrCodeImage) qrCodeImage = deepFind(dustpayResponse, looksLikeBase64Image);

  const qrCodeImageDataUrl =
    qrCodeImage && typeof qrCodeImage === 'string'
      ? (qrCodeImage.trim().startsWith('data:image/') ? qrCodeImage.trim() : `data:image/png;base64,${qrCodeImage.trim()}`)
      : null;

  return {
    qrCodeText: qrCodeText ? String(qrCodeText).trim() : null,
    qrCodeImageDataUrl,
    receiverPixKey: pix?.receiverPixKey || pix?.receiver_pix_key || null,
    receiverName: pix?.receiverName || pix?.receiver_name || null,
    raw: pix,
  };
}

function isMissingPaymentsTable(err) {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  return code === '42P01' || msg.includes('relation') && msg.includes('payments') && msg.includes('does not exist');
}

async function ensurePaymentsTable() {
  const { error } = await supabase.from('payments').select('id').limit(1);
  if (error) {
    if (isMissingPaymentsTable(error)) {
      const e = new Error('PAYMENTS_TABLE_MISSING');
      e.code = 'PAYMENTS_TABLE_MISSING';
      throw e;
    }
    throw error;
  }
}

async function loadUserOrFail(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id,email,username,nome,phone,cpf,is_premium,premium_until,coins')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error('USER_NOT_FOUND');
  if (!data.nome) throw new Error('MISSING_NOME');
  if (!data.phone) throw new Error('MISSING_PHONE');
  if (!data.cpf) throw new Error('MISSING_CPF');
  return data;
}

function buildClientPayload(user) {
  // DustPay espera: { name, email, phone, document }
  const cpfDigits = String(user.cpf).replace(/\D+/g, '');
  return {
    name: String(user.nome).trim(),
    email: user.email,
    phone: normalizePhone(user.phone),
    document: cpfDigits,
  };
}

async function upsertPayment(row) {
  const { data, error } = await supabase
    .from('payments')
    .upsert(row, { onConflict: 'identifier' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updatePayment(identifier, patch) {
  const { data, error } = await supabase
    .from('payments')
    .update(patch)
    .eq('identifier', identifier)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function logDustpayError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (data !== undefined) {
    console.error('[DustPay]', util.inspect({ status, data }, { depth: null, colors: true, maxArrayLength: 50 }));
  } else {
    console.error('[DustPay]', util.inspect({ message: err?.message, status }, { depth: null, colors: true }));
  }
}

function dustpayErrorToResponse(err) {
  if (err?.code === 'DUSTPAY_KEYS_MISSING' || err?.message === 'DUSTPAY_KEYS_MISSING') {
    return {
      status: 500,
      body: {
        error: 'DUSTPAY_KEYS_MISSING',
        hint: 'Defina DUSTPAY_PUBLIC_KEY e DUSTPAY_SECRET_KEY no .env do backend.',
      },
    };
  }

  const status = err?.response?.status;
  const data = err?.response?.data;

  if (status) {
    const isString = typeof data === 'string';
    const snippet = isString ? data.slice(0, 800) : null;

    // DustPay pode devolver HTML em bloqueios/403.
    if (status === 403) {
      return {
        status: 502,
        body: {
          error: 'DUSTPAY_FORBIDDEN',
          hint:
            'A DustPay respondeu 403 (acesso bloqueado). Verifique se as chaves estão corretas e se a DustPay exige liberação de IP/ambiente. O backend está tentando bater em: ' +
            dustpay.baseUrlInfo().baseUrl,
          dustpay_snippet: snippet,
        },
      };
    }

    // Para 400/422: normalmente vem "details" com validações.
    const details = data?.details ?? null;

    return {
      status: 502,
      body: {
        error: 'DUSTPAY_REQUEST_FAILED',
        details: `HTTP ${status}`,
        dustpay_errorCode: data?.errorCode ?? null,
        dustpay_message: data?.message ?? null,
        dustpay_details: details,
        dustpay_snippet: snippet,
      },
    };
  }

  return { status: 500, body: { error: 'PIX_CREATE_FAILED' } };
}



router.get('/pricing', (req, res) => {
  return res.json({ premiumPlans, coinPacks, splits });

router.get('/my', requireAuth, async (req, res) => {
  try {
    await ensurePaymentsTable();
    const { data, error } = await supabase
      .from('payments')
      .select('identifier,kind,plan_id,pack_id,coins,amount,currency,status,dustpay_status,paid_at,applied_at,created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return res.json({ payments: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'PAYMENTS_LIST_FAILED' });
  }
});

});

router.get('/dustpay/ping', async (req, res) => {
  try {
    const data = await dustpay.ping();
    return res.json(data);
  } catch (err) {
    logDustpayError(err);
const mapped = dustpayErrorToResponse(err);
    return res.status(mapped.status).json(mapped.body);
  }
});



router.get('/dustpay/debug', (req, res) => {
  const pub = process.env.DUSTPAY_PUBLIC_KEY || '';
  const sec = process.env.DUSTPAY_SECRET_KEY || '';
  return res.json({
    baseUrl: dustpay.baseUrlInfo().baseUrl,
    hasPublicKey: Boolean(pub),
    hasSecretKey: Boolean(sec),
    publicKeyLast4: pub ? pub.slice(-4) : null,
    secretKeyLast4: sec ? sec.slice(-4) : null,
  });
});
router.post('/pix/premium', requireAuth, async (req, res) => {
  try {
    await ensurePaymentsTable();
    dustpay.ensureKeys();

    const { planId } = req.body || {};
    const plan = premiumPlans.find((p) => p.id === planId);
    if (!plan) return res.status(400).json({ error: 'INVALID_PLAN' });

    const user = await loadUserOrFail(req.user.id);

    const identifier = buildIdentifier('premium', plan.id, user.id);
    const webhookSecret = process.env.DUSTPAY_WEBHOOK_SECRET;
    const cb = `${publicUrl()}/api/payments/webhook/dustpay${webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : ''}`;

    const payload = {
      identifier,
      callbackUrl: cb,
      dueDate: todayPlusDays(2),
      client: buildClientPayload(user),
      amount: Number(plan.price),
      products: [{ id: String(plan.id), name: plan.label, quantity: 1, price: Number(plan.price) }],
      metadata: { type: 'premium', planId: plan.id, userId: user.id },
      splits: computeDustpaySplits(Number(plan.price), splits),
    };

    const dust = await dustpay.createPixReceive(payload);
    const pixInfo = extractPixInfo(dust);

    await upsertPayment({
      identifier,
      user_id: user.id,
      kind: 'premium',
      plan_id: plan.id,
      amount: Number(plan.price),
      currency: 'BRL',
      status: 'created',
      dustpay_status: String(dust?.status || ''),
      dustpay_transaction_id: dust?.id || dust?.transactionId || dust?.transaction_id || null,
      dustpay_request: payload,
      dustpay_response: dust,
    });

    return res.json({ identifier, plan, pix: pixInfo, dustpay: dust });
  } catch (err) {
    logDustpayError(err);
if (err?.message === 'PAYMENTS_TABLE_MISSING' || err?.code === 'PAYMENTS_TABLE_MISSING') {
      return res.status(500).json({ error: 'PAYMENTS_TABLE_MISSING', hint: 'Rode astrodeck-backend/supabase_migrations/001_create_payments.sql no Supabase.' });
    }
    const msg = String(err?.message || '');
    if (msg === 'MISSING_NOME' || msg === 'MISSING_PHONE' || msg === 'MISSING_CPF') {
      return res.status(400).json({ error: msg });
    }
    const mapped = dustpayErrorToResponse(err);
    return res.status(mapped.status).json(mapped.body);
  }
});

router.post('/pix/coins', requireAuth, async (req, res) => {
  try {
    await ensurePaymentsTable();
    dustpay.ensureKeys();

    const { packId } = req.body || {};
    const pack = coinPacks.find((p) => p.id === packId);
    if (!pack) return res.status(400).json({ error: 'INVALID_PACK' });

    const user = await loadUserOrFail(req.user.id);

    const identifier = buildIdentifier('coins', pack.id, user.id);
    const webhookSecret = process.env.DUSTPAY_WEBHOOK_SECRET;
    const cb = `${publicUrl()}/api/payments/webhook/dustpay${webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : ''}`;

    const payload = {
      identifier,
      callbackUrl: cb,
      dueDate: todayPlusDays(2),
      client: buildClientPayload(user),
      amount: Number(pack.price),
      products: [{ id: String(pack.id), name: pack.label, quantity: 1, price: Number(pack.price) }],
      metadata: { type: 'coins', packId: pack.id, coins: pack.coins, userId: user.id },
      splits: computeDustpaySplits(Number(pack.price), splits),
    };

    const dust = await dustpay.createPixReceive(payload);
    const pixInfo = extractPixInfo(dust);

    await upsertPayment({
      identifier,
      user_id: user.id,
      kind: 'coins',
      pack_id: pack.id,
      coins: Number(pack.coins),
      amount: Number(pack.price),
      currency: 'BRL',
      status: 'created',
      dustpay_status: String(dust?.status || ''),
      dustpay_transaction_id: dust?.id || dust?.transactionId || dust?.transaction_id || null,
      dustpay_request: payload,
      dustpay_response: dust,
    });

    return res.json({ identifier, pack, pix: pixInfo, dustpay: dust });
  } catch (err) {
    logDustpayError(err);
if (err?.message === 'PAYMENTS_TABLE_MISSING' || err?.code === 'PAYMENTS_TABLE_MISSING') {
      return res.status(500).json({ error: 'PAYMENTS_TABLE_MISSING', hint: 'Rode astrodeck-backend/supabase_migrations/001_create_payments.sql no Supabase.' });
    }
    const msg = String(err?.message || '');
    if (msg === 'MISSING_NOME' || msg === 'MISSING_PHONE' || msg === 'MISSING_CPF') {
      return res.status(400).json({ error: msg });
    }
    const mapped = dustpayErrorToResponse(err);
    return res.status(mapped.status).json(mapped.body);
  }
});



router.post('/confirm', requireAuth, async (req, res) => {
  try {
    await ensurePaymentsTable();
    dustpay.ensureKeys();

    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ error: 'MISSING_IDENTIFIER' });

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('identifier', identifier)
      .eq('user_id', req.user.id)
      .single();

    if (error || !payment) return res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });

    if (payment.status === 'applied' || payment.applied_at) {
      const { data: u } = await supabase.from('users').select('*').eq('id', req.user.id).single();
      return res.json({ ok: true, status: 'applied', user: u });
    }

    const statusRes = await dustpay.getPixReceiveStatus({
      transactionId: payment.dustpay_transaction_id,
      identifier: payment.identifier,
    });

    logLine('confirm_status_query', { identifier, ok: statusRes.ok, via: statusRes.via, status: statusRes.status });

    if (!statusRes.ok) {
      // Não estoura o front: em dev/local o webhook geralmente não chega (localhost),
      // e a DustPay pode não oferecer endpoint de consulta no plano atual.
      logLine('confirm_status_query_failed', {
        identifier,
        status: statusRes.status,
        data: statusRes.data || null,
      });

      return res.json({
        ok: false,
        status: 'status_query_failed',
        hint:
          'Não foi possível consultar o status na DustPay. Em ambiente local (localhost) o webhook não chega. Use ngrok e BACKEND_PUBLIC_URL para testar o webhook ou configure um endpoint de consulta suportado pela DustPay.',
        dustpay_status: null,
        dustpay: { status: statusRes.status, data: statusRes.data || null },
      });
    }

    const dustStatus = extractStatusFromDustpay(statusRes.data);
    const paid = isPaidStatus(dustStatus);

    await updatePayment(identifier, {
      dustpay_status: dustStatus,
      dustpay_response: statusRes.data,
      status: paid ? 'paid' : (dustStatus || 'updated'),
      paid_at: paid ? (payment.paid_at || new Date().toISOString()) : payment.paid_at,
    });

    if (!paid) {
      return res.json({ ok: true, status: 'not_paid', dustpay_status: dustStatus });
    }

    // Claim idempotently
    const claim = await supabase
      .from('payments')
      .update({ applied_at: new Date().toISOString(), status: 'processing' })
      .eq('identifier', identifier)
      .is('applied_at', null)
      .select()
      .single();

    if (claim.error || !claim.data) {
      const { data: u } = await supabase.from('users').select('*').eq('id', req.user.id).single();
      return res.json({ ok: true, status: 'already_processing_or_applied', user: u });
    }

    const p = claim.data;

    if (p.kind === 'premium') {
      const plan = premiumPlans.find((x) => x.id === p.plan_id);
      if (plan) {
        const { data: u0 } = await supabase.from('users').select('premium_until').eq('id', p.user_id).single();
        const now = new Date();
        const base = u0?.premium_until ? new Date(u0.premium_until) : now;
        const start = base > now ? base : now;
        const newUntil = new Date(start.getTime() + plan.days * 24 * 60 * 60 * 1000);

        await supabase.from('users').update({ is_premium: true, premium_until: newUntil.toISOString() }).eq('id', p.user_id);
      }
    } else if (p.kind === 'coins') {
      const pack = coinPacks.find((x) => x.id === p.pack_id);
      const addCoins = pack ? Number(pack.coins) : Number(p.coins || 0);
      if (addCoins > 0) {
        const { data: u0 } = await supabase.from('users').select('coins').eq('id', p.user_id).single();
        const current = Number(u0?.coins || 0);
        await supabase.from('users').update({ coins: current + addCoins }).eq('id', p.user_id);
      }
    }

    await updatePayment(identifier, { status: 'applied' });

    // Push: pagamento aplicado
    try {
      const payload = push.buildPayload({
        title: 'Pagamento confirmado ✅',
        body: p.kind === 'premium' ? 'Seu Premium foi ativado.' : 'Suas moedas foram adicionadas.',
        url: p.kind === 'premium' ? '/premium' : '/',
        tag: 'payment-applied',
      });

      await push.sendToUser(p.user_id, payload, { dedupeKind: 'payment_applied', dedupeRef: p.identifier });
    } catch (e) {
      logLine('push_after_apply_failed', { identifier: p.identifier, message: e?.message || String(e) });
    }


    const { data: u } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    logLine('confirm_applied', { identifier, kind: p.kind, user_id: p.user_id });

    return res.json({ ok: true, status: 'applied', user: u });
  } catch (err) {
    logLine('confirm_error', { message: err?.message, status: err?.response?.status, data: err?.response?.data });
    return res.status(500).json({ error: 'CONFIRM_FAILED' });
  }
});
router.post('/webhook/dustpay', async (req, res) => {
  try {
    const secret = process.env.DUSTPAY_WEBHOOK_SECRET;
    const token = req.query.token || req.headers['x-webhook-secret'];
    if (secret && token !== secret) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    logLine('webhook_in', { headers: req.headers, query: req.query, body: req.body });

    const body = req.body || {};
    const identifier = body?.identifier || body?.transaction?.identifier || body?.data?.identifier;
    const status = body?.status || body?.transaction?.status || body?.data?.status;
    const dustpayTransactionId = body?.id || body?.transactionId || body?.transaction?.id || null;

    if (!identifier) return res.status(400).json({ error: 'MISSING_IDENTIFIER' });

    // Update status fields (if payments table exists)
    await ensurePaymentsTable();

    const paid = isPaidStatus(status);

    const { data: existing } = await supabase
      .from('payments')
      .select('paid_at,applied_at,kind,plan_id,pack_id,coins,user_id')
      .eq('identifier', identifier)
      .single();

    if (!existing) {
      // Create minimal row from identifier (ad_{kind}_{itemId}_{userId}_...)
      const parts = String(identifier).split('_');
      const kind = parts.length >= 4 ? parts[1] : null;
      const itemId = parts.length >= 4 ? parts[2] : null;
      const userId = parts.length >= 4 ? parts[3] : (body?.metadata?.userId || null);

      if (kind && itemId && userId) {
        const plan = kind === 'premium' ? premiumPlans.find((p) => p.id === itemId) : null;
        const pack = kind === 'coins' ? coinPacks.find((p) => p.id === itemId) : null;

        await upsertPayment({
          identifier,
          user_id: userId,
          kind,
          plan_id: plan ? plan.id : null,
          pack_id: pack ? pack.id : null,
          coins: pack ? Number(pack.coins) : null,
          amount: plan ? Number(plan.price) : pack ? Number(pack.price) : 0,
          currency: 'BRL',
          status: 'created',
        });
      }
    }

    const paidAt = existing?.paid_at ? existing.paid_at : paid ? new Date().toISOString() : null;

    await updatePayment(identifier, {
      dustpay_status: String(status || ''),
      dustpay_transaction_id: dustpayTransactionId,
      status: paid ? 'paid' : String(status || 'updated'),
      paid_at: paidAt,
      dustpay_response: body,
    });

    if (!paid) return res.json({ ok: true });

    // Idempotency: claim once
    const claim = await supabase
      .from('payments')
      .update({ applied_at: new Date().toISOString(), status: 'processing' })
      .eq('identifier', identifier)
      .is('applied_at', null)
      .select()
      .single();

    if (claim.error || !claim.data) return res.json({ ok: true });

    const payment = claim.data;

    if (payment.kind === 'premium') {
      const plan = premiumPlans.find((p) => p.id === payment.plan_id);
      if (plan) {
        const { data: u } = await supabase.from('users').select('premium_until').eq('id', payment.user_id).single();
        const now = new Date();
        const base = u?.premium_until ? new Date(u.premium_until) : now;
        const start = base > now ? base : now;
        const newUntil = new Date(start.getTime() + plan.days * 24 * 60 * 60 * 1000);

        await supabase
          .from('users')
          .update({ is_premium: true, premium_until: newUntil.toISOString() })
          .eq('id', payment.user_id);
      }
    } else if (payment.kind === 'coins') {
      const pack = coinPacks.find((p) => p.id === payment.pack_id);
      const add = pack ? Number(pack.coins) : Number(payment.coins || 0);
      if (add > 0) {
        const { data: u } = await supabase.from('users').select('coins').eq('id', payment.user_id).single();
        const current = Number(u?.coins || 0);
        await supabase.from('users').update({ coins: current + add }).eq('id', payment.user_id);
      }
    }

    await updatePayment(identifier, { status: 'applied' });

    // Push: pagamento aplicado
    try {
      const payload = push.buildPayload({
        title: 'Pagamento confirmado ✅',
        body: p.kind === 'premium' ? 'Seu Premium foi ativado.' : 'Suas moedas foram adicionadas.',
        url: p.kind === 'premium' ? '/premium' : '/',
        tag: 'payment-applied',
      });

      await push.sendToUser(p.user_id, payload, { dedupeKind: 'payment_applied', dedupeRef: p.identifier });
    } catch (e) {
      logLine('push_after_apply_failed', { identifier: p.identifier, message: e?.message || String(e) });
    }


    return res.json({ ok: true });
  } catch (err) {
    logDustpayError(err);
if (err?.message === 'PAYMENTS_TABLE_MISSING' || err?.code === 'PAYMENTS_TABLE_MISSING') {
      return res.status(500).json({ error: 'PAYMENTS_TABLE_MISSING', hint: 'Rode astrodeck-backend/supabase_migrations/001_create_payments.sql no Supabase.' });
    }
    return res.status(500).json({ error: 'WEBHOOK_FAILED' });
  }
});

module.exports = router;
