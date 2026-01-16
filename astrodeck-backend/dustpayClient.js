const axios = require('axios');

const DUSTPAY_BASE_URL = (process.env.DUSTPAY_BASE_URL || 'https://app.dustpay.com.br/api/v1').replace(/\/+$/, '');

function ensureKeys() {
  const pub = process.env.DUSTPAY_PUBLIC_KEY;
  const sec = process.env.DUSTPAY_SECRET_KEY;

  if (!pub || !sec) {
    const err = new Error('DUSTPAY_KEYS_MISSING');
    err.code = 'DUSTPAY_KEYS_MISSING';
    throw err;
  }

  return { pub, sec };
}

function baseUrlInfo() {
  return { baseUrl: DUSTPAY_BASE_URL };
}

function client() {
  const { pub, sec } = ensureKeys();

  return axios.create({
    baseURL: DUSTPAY_BASE_URL,
    timeout: 20000,
    headers: {
      'x-public-key': pub,
      'x-secret-key': sec,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'AstrodeckBackend/1.0 (+node)',
    },
  });
}

async function ping() {
  const c = client();
  const res = await c.get('/ping');
  return res.data;
}

async function createPixReceive(payload) {
  const c = client();
  const res = await c.post('/gateway/pix/receive', payload);
  return res.data;
}

/**
 * DustPay status query helper.
 * The documentation varies; we try a small set of common paths.
 */
async function getPixReceiveStatus({ transactionId, identifier }) {
  const c = client();
  const tries = [];

  if (transactionId) {
    tries.push({ method: 'GET', url: `/gateway/pix/receive/${encodeURIComponent(transactionId)}` });
    tries.push({ method: 'GET', url: `/gateway/pix/receive?id=${encodeURIComponent(transactionId)}` });
    tries.push({ method: 'GET', url: `/gateway/transaction/${encodeURIComponent(transactionId)}` });
    tries.push({ method: 'GET', url: `/gateway/transactions/${encodeURIComponent(transactionId)}` });
  }

  if (identifier) {
    tries.push({ method: 'GET', url: `/gateway/pix/receive?identifier=${encodeURIComponent(identifier)}` });
    tries.push({ method: 'GET', url: `/gateway/transactions?identifier=${encodeURIComponent(identifier)}` });
  }

  let lastErr = null;

  for (const t of tries) {
    try {
      const res = await c.request({ method: t.method, url: t.url });
      return { ok: true, via: t.url, data: res.data };
    } catch (err) {
      lastErr = err;
      // continue
    }
  }

  return { ok: false, error: lastErr?.message || 'STATUS_QUERY_FAILED', status: lastErr?.response?.status, data: lastErr?.response?.data };
}

module.exports = { ping, createPixReceive, getPixReceiveStatus, ensureKeys, baseUrlInfo };
