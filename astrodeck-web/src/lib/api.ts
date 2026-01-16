/**
 * src/lib/api.ts
 *
 * HTTP client for Astrodeck backend (cookie-based auth).
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    credentials: "include",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.hint || data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data as T;
}

export type User = {
  id: string;
  email: string;
  username: string;
  nome?: string | null;
  phone?: string | null;
  is_premium: boolean;
  premium_until?: string | null;
  coins: number;
};

export type TarotCardView = {
  name_pt: string;
  file_name?: string | null;
  image_url?: string | null;
};

export type PremiumPlan = { id: string; label: string; days: number; price: number };
export type CoinPack = { id: string; label: string; coins: number; price: number };
export type SplitRule = { producerId: string; percent: number };

export type PricingResponse = { premiumPlans: PremiumPlan[]; coinPacks: CoinPack[]; splits: SplitRule[] };

export type PixInfo = {
  qrCodeText: string | null;
  qrCodeImageDataUrl?: string | null;
  receiverPixKey: string | null;
  receiverName: string | null;
  raw: unknown;
};

export type CreatePixPremiumResponse = { identifier: string; plan: PremiumPlan; pix: PixInfo; dustpay: unknown };
export type CreatePixCoinsResponse = { identifier: string; pack: CoinPack; pix: PixInfo; dustpay: unknown };

export type PaymentRow = {
  identifier: string;
  kind: "premium" | "coins";
  plan_id?: string | null;
  pack_id?: string | null;
  coins?: number | null;
  amount: number;
  currency: string;
  status: string;
  dustpay_status?: string | null;
  paid_at?: string | null;
  applied_at?: string | null;
  created_at?: string | null;
};

export type TarotReadingResponse = {
  topic: string;
  isPremium: boolean;
  userId: string;
  cards: TarotCardView[];
  description: string;
  coins: number;
};

export const api = {
  me: () => requestJson<{ user: User }>("/api/auth/me", { method: "GET" }),

  login: (email: string, password: string) =>
    requestJson<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (nome: string, username: string, phone: string, email: string, password: string) =>
    requestJson<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, username, phone, email, password }),
    }),

  logout: () =>
    requestJson<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  tarotReading: (topic: string, userId: string) =>
    requestJson<TarotReadingResponse>("/api/tarot-reading", {
      method: "POST",
      body: JSON.stringify({ topic, userId }),
    }),

  // Legacy/MVP
  activatePremium: (userId: string, days: number) =>
    requestJson<{ message: string; user: { id: string; is_premium: boolean; premium_until: string } }>(
      "/api/subscriptions/activate",
      { method: "POST", body: JSON.stringify({ userId, days }) }
    ),

  pricing: () => requestJson<PricingResponse>("/api/payments/pricing", { method: "GET" }),

  createPixPremium: (planId: string) =>
    requestJson<CreatePixPremiumResponse>("/api/payments/pix/premium", {
      method: "POST",
      body: JSON.stringify({ planId }),
    }),

  createPixCoins: (packId: string) =>
    requestJson<CreatePixCoinsResponse>("/api/payments/pix/coins", {
      method: "POST",
      body: JSON.stringify({ packId }),
    }),

  listMyPayments: () => requestJson<{ payments: PaymentRow[] }>("/api/payments/my", { method: "GET" }),

  confirmPayment: (identifier: string) =>
    requestJson<{ ok: boolean; status: string; user?: User; dustpay_status?: string }>("/api/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),

  getVapidPublicKey: () => requestJson<{ publicKey: string }>("/api/push/vapid-public-key", { method: "GET" }),

  pushSubscribe: (subscription: PushSubscription) =>
    requestJson<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),

  pushUnsubscribe: (endpoint: string) =>
    requestJson<{ ok: boolean }>("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }),

  pushTest: () =>
    requestJson<{ ok: boolean; result?: unknown; error?: string; hint?: string }>("/api/push/test", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  pushSimulate: (event: string) =>
    requestJson<{ ok: boolean; event: string; result?: unknown; error?: string; hint?: string }>("/api/push/simulate", {
      method: "POST",
      body: JSON.stringify({ event }),
    }),
};
