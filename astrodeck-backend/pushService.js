// pushService.js
const webpush = require('web-push');
const { supabase } = require('./supabaseClient');
const { logLine } = require('./paymentLogger');

function ensureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!pub || !priv) {
    const e = new Error('VAPID_KEYS_MISSING');
    e.code = 'VAPID_KEYS_MISSING';
    throw e;
  }

  webpush.setVapidDetails(subject, pub, priv);
  return { pub };
}

function getPublicKey() {
  return ensureVapid().pub;
}

async function ensureTables() {
  // Best-effort check. If missing, Supabase will error on insert/select anyway.
  return true;
}

async function upsertSubscription(userId, sub, userAgent) {
  await ensureTables();

  const endpoint = sub?.endpoint;
  const keys = sub?.keys || {};
  const p256dh = keys.p256dh;
  const auth = keys.auth;

  if (!endpoint || !p256dh || !auth) {
    const e = new Error('INVALID_SUBSCRIPTION');
    e.code = 'INVALID_SUBSCRIPTION';
    throw e;
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) throw error;
  return { ok: true };
}

async function removeSubscription(userId, endpoint) {
  await ensureTables();

  const q = supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (userId) q.eq('user_id', userId);

  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

async function listUserSubscriptions(userId) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

async function markPushEventOnce(userId, kind, ref) {
  // Returns true if inserted (should send), false if already exists.
  try {
    const { error } = await supabase.from('push_events').insert({
      user_id: userId,
      kind,
      ref,
      created_at: new Date().toISOString(),
    });
    if (!error) return true;

    const msg = String(error.message || '');
    if (msg.toLowerCase().includes('duplicate') || msg.includes('23505')) return false;
    throw error;
  } catch (err) {
    // If table missing, don't block sending.
    return true;
  }
}

async function sendToUser(userId, payload, { dedupeKind, dedupeRef } = {}) {
  ensureVapid();

  if (dedupeKind && dedupeRef) {
    const should = await markPushEventOnce(userId, dedupeKind, dedupeRef);
    if (!should) return { ok: true, skipped: true };
  }

  const subs = await listUserSubscriptions(userId);
  if (!subs.length) return { ok: true, skipped: true };

  const body = JSON.stringify(payload);

  const results = [];
  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };

    try {
      await webpush.sendNotification(subscription, body);
      results.push({ endpoint: s.endpoint, ok: true });
    } catch (err) {
      const status = err?.statusCode || err?.status || null;
      results.push({ endpoint: s.endpoint, ok: false, status });

      // Remove invalid subscriptions
      if (status === 404 || status === 410) {
        try {
          await removeSubscription(userId, s.endpoint);
        } catch {
          // ignore
        }
      }

      logLine('push_send_error', { userId, status, message: err?.message });
    }
  }

  return { ok: true, results };
}

function buildPayload({ title, body, url, tag }) {
  return {
    title,
    body,
    url: url || '/',
    tag: tag || undefined,
    ts: Date.now(),
  };
}

module.exports = {
  getPublicKey,
  upsertSubscription,
  removeSubscription,
  sendToUser,
  buildPayload,
  markPushEventOnce,
};
