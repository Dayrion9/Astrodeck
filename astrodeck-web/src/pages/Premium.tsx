import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, Sparkles, Star, Zap } from "lucide-react";
import MysticBackground from "@/components/MysticBackground";
import PixPaymentModal from "@/components/PixPaymentModal";
import { api, type User } from "@/lib/api";
import { clearUser, loadUser, saveUser } from "@/lib/session";

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const Premium = () => {
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(() => (typeof window !== "undefined" ? loadUser() : null));

  const [pixOpen, setPixOpen] = useState(false);
  const [pixTitle, setPixTitle] = useState("");
  const [pixAmountLabel, setPixAmountLabel] = useState<string | undefined>(undefined);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [pixIdentifier, setPixIdentifier] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.me();
        if (!mounted) return;
        setUser(res.user);
        saveUser(res.user);
      } catch {
        clearUser();
        navigate("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function startPix(planId: "mensal" | "anual") {
    setBusy(true);
    setMsg(null);
    setErr(null);

    try {
      const res = await api.createPixPremium(planId);

      setPixTitle(planId === "mensal" ? "Premium Mensal" : "Premium Anual");
      setPixAmountLabel(`Valor: ${brl(res.plan.price)}`);
      setPixCode(res.pix.qrCodeText);
      setPixImage(res.pix.qrCodeImageDataUrl ?? null);
      setPixIdentifier(res.identifier);
      setPixOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao gerar PIX");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAfterPay() {
    setErr(null);

    try {
      if (pixIdentifier) {
        const res = await api.confirmPayment(pixIdentifier);
        const u = res.user ? res.user : (await api.me()).user;

        setUser(u);
        saveUser(u);

        if (u.is_premium) {
          setMsg("Pagamento confirmado! Premium ativado ✅");
          setPixOpen(false);
          return;
        }

        setMsg(`Ainda não confirmado (status: ${res.status}${res.dustpay_status ? ` / dust: ${res.dustpay_status}` : ""}).`);
        return;
      }

      const me = await api.me();
      setUser(me.user);
      saveUser(me.user);
      setMsg("Atualizado. Se você acabou de pagar, aguarde alguns segundos e tente novamente.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao confirmar pagamento");
    }
  }

  if (!user) return null;

  return (
    <div className="relative min-h-screen">
      <MysticBackground />

      <main className="relative z-10 container-app">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(330 80% 55%), hsl(263 70% 50%))",
                boxShadow: "0 8px 20px -5px hsl(330 80% 55% / 0.4)",
              }}
            >
              <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div>
              <h1 className="h1 flex items-center gap-2">
                Premium <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
              </h1>
              <p className="muted text-sm sm:text-base">
                {user.is_premium ? "Você já é Premium." : "Assine para desbloquear tiragens completas e mais moedas diárias."}
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <PlanCard
            title="Mensal"
            price={brl(19.9)}
            highlights={["Tiragem de 3 cartas", "Moedas diárias Premium", "Acesso completo ao resultado"]}
            icon={<Star className="w-5 h-5" />}
            onSelect={() => startPix("mensal")}
            busy={busy}
          />

          <PlanCard
            title="Anual"
            price={brl(168.9)}
            highlights={["Tiragem de 3 cartas", "Moedas diárias Premium", "Acesso completo ao resultado"]}
            icon={<Zap className="w-5 h-5" />}
            onSelect={() => startPix("anual")}
            busy={busy}
          />
        </section>

        {(msg || err) && (
          <div className="glass-panel mt-6">
            {msg && <div className="text-foreground/90">{msg}</div>}
            {err && <div className="err">{err}</div>}
          </div>
        )}

        <PixPaymentModal
          open={pixOpen}
          title={pixTitle || "Pagamento PIX"}
          subtitle="Finalize no seu banco e confirme aqui."
          amountLabel={pixAmountLabel}
          qrCodeText={pixCode}
          qrCodeImageDataUrl={pixImage}
          onClose={() => setPixOpen(false)}
          onIHavePaid={refreshAfterPay}
        />
      </main>
    </div>
  );
};

const PlanCard = ({
  title,
  price,
  highlights,
  icon,
  onSelect,
  busy,
}: {
  title: string;
  price: string;
  highlights: string[];
  icon: React.ReactNode;
  onSelect: () => void;
  busy: boolean;
}) => {
  return (
    <div className="glass-panel mystic-glow relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg sm:text-xl font-extrabold tracking-wide">{title}</div>
          <div className="muted text-sm">{price}</div>
        </div>
        <div className="w-10 h-10 rounded-xl grid place-items-center border border-white/10 bg-black/20">{icon}</div>
      </div>

      <ul className="mt-4 space-y-2">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5" style={{ color: "hsl(45 93% 58%)" }} />
            <span className="muted">{h}</span>
          </li>
        ))}
      </ul>

      <button className="btn-primary w-full mt-5 py-3" disabled={busy} onClick={onSelect} type="button">
        {busy ? "Gerando PIX..." : "Assinar com PIX"}
      </button>
    </div>
  );
};

export default Premium;
