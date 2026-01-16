/**
 * paymentConfig.js
 *
 * Centraliza preços (premium + pacotes de moedas) e split.
 * Você pode sobrescrever via ENV com JSON.
 */

function parseJsonEnv(name, fallback) {
  try {
    if (!process.env[name]) return fallback;
    const parsed = JSON.parse(process.env[name]);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const premiumPlansDefault = [
  { id: 'mensal', label: 'Premium Mensal', days: 30, price: 19.90 },
  { id: 'anual', label: 'Premium Anual', days: 365, price: 168.90 },
];

const coinPacksDefault = [
  { id: 'pack1', label: 'Pack 30 moedas', coins: 30, price: 19.90 },
  { id: 'pack2', label: 'Pack 50 moedas', coins: 50, price: 49.90 },
  { id: 'pack3', label: 'Pack 100 moedas', coins: 100, price: 79.90 },
];

// Splits: [{ producerId: "cm1234", amount: 30.00 }, ...]
const splitsDefault = [];

const premiumPlans = parseJsonEnv('PREMIUM_PLANS_JSON', premiumPlansDefault);
const coinPacks = parseJsonEnv('COIN_PACKS_JSON', coinPacksDefault);
const splits = parseJsonEnv('DUSTPAY_SPLITS_JSON', splitsDefault);

module.exports = { premiumPlans, coinPacks, splits };
