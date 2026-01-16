import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api } from "@/lib/api";
import { disablePush, enablePush, getCurrentSubscription, pushSupported } from "@/lib/push";

const ENABLE_PUSH_TEST_BUTTON =
  String(import.meta.env.VITE_ENABLE_PUSH_TEST_BUTTON || "").toLowerCase() === "true";

export default function PushBanner() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupported(pushSupported());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);

    (async () => {
      try {
        const sub = await getCurrentSubscription();
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
    })();
  }, []);

  if (!supported) return null;

  const showEnable = !subscribed || permission !== "granted";

  async function refreshState() {
    try {
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }

  async function onEnable() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enablePush();
      if (!r.ok) setMsg(r.message || "Não foi possível ativar notificações.");
      else setMsg("Notificações ativadas ✅");
    } finally {
      await refreshState();
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    setMsg(null);
    try {
      await disablePush();
      setMsg("Notificações desativadas.");
    } finally {
      await refreshState();
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.pushTest();
      if ((r as any).hint) setMsg(String((r as any).hint));
      else setMsg("Push disparado (se você estiver inscrito, deve aparecer) ✅");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao testar push");
    } finally {
      setBusy(false);
    }
  }

  async function onSimulate(event: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.pushSimulate(event);
      if ((r as any).hint) setMsg(String((r as any).hint));
      else setMsg(`Evento simulado: ${event} ✅`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao simular evento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-panel mt-5 sm:mt-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {showEnable ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span>Notificações</span>
            </div>
            <p className="muted text-sm mt-1">
              Receba avisos de pagamento, moedas diárias e expiração do Premium.
            </p>
            {msg && <div className="text-sm mt-2">{msg}</div>}
          </div>

          <div className="flex gap-2">
            {showEnable ? (
              <button className="btn-primary px-4 py-2" disabled={busy} onClick={onEnable} type="button">
                {busy ? "Ativando..." : "Ativar"}
              </button>
            ) : (
              <button className="btn-link px-4 py-2" disabled={busy} onClick={onDisable} type="button">
                {busy ? "..." : "Desativar"}
              </button>
            )}

            {ENABLE_PUSH_TEST_BUTTON && subscribed && (
              <button className="btn-link px-4 py-2" disabled={busy} onClick={onTest} type="button">
                {busy ? "..." : "Testar push"}
              </button>
            )}
          </div>
        </div>

        {ENABLE_PUSH_TEST_BUTTON && subscribed && (
          <details className="px-4 py-3 rounded-xl border border-white/10 bg-black/15">
            <summary className="cursor-pointer select-none">Simular eventos</summary>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                className="btn-primary px-4 py-2"
                disabled={busy}
                onClick={() => onSimulate("coins_refresh")}
                type="button"
              >
                Simular: moedas caindo
              </button>

              <button
                className="btn-primary px-4 py-2"
                disabled={busy}
                onClick={() => onSimulate("premium_expiring")}
                type="button"
              >
                Simular: premium perto de expirar
              </button>

              <button
                className="btn-primary px-4 py-2"
                disabled={busy}
                onClick={() => onSimulate("tarot_ready")}
                type="button"
              >
                Simular: leitura pronta
              </button>

              <button
                className="btn-primary px-4 py-2"
                disabled={busy}
                onClick={() => onSimulate("payment_coins")}
                type="button"
              >
                Simular: pagamento (moedas)
              </button>

              <button
                className="btn-primary px-4 py-2"
                disabled={busy}
                onClick={() => onSimulate("payment_premium")}
                type="button"
              >
                Simular: pagamento (premium)
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
