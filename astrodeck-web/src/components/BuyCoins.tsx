import { useState } from "react";
import { Coins, Plus, Zap } from "lucide-react";
import PixPaymentModal from "@/components/PixPaymentModal";
import { api, type User } from "@/lib/api";
import { loadUser, saveUser } from "@/lib/session";

interface BuyCoinsProps {
  currentCoins: number;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const coinPackages = [
  { id: "pack1" as const, amount: 30, price: 19.9, popular: false },
  { id: "pack2" as const, amount: 50, price: 49.9, popular: true },
  { id: "pack3" as const, amount: 100, price: 79.9, popular: false },
];

const BuyCoins = ({ currentCoins }: BuyCoinsProps) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pixOpen, setPixOpen] = useState(false);
  const [pixTitle, setPixTitle] = useState("");
  const [pixAmountLabel, setPixAmountLabel] = useState<string | undefined>(undefined);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [pixIdentifier, setPixIdentifier] = useState<string | null>(null);

  const [expectedCoins, setExpectedCoins] = useState<number | null>(null);

  const handlePurchase = async (packId: (typeof coinPackages)[number]["id"]) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.createPixCoins(packId);
      setPixTitle(`Comprar ${res.pack.coins} moedas`);
      setPixAmountLabel(`Valor: ${brl(res.pack.price)}`);
      setPixCode(res.pix.qrCodeText);
      setPixImage((res.pix as any).qrCodeImageDataUrl ?? null);
      setPixIdentifier(res.identifier);
      setExpectedCoins(res.pack.coins);
      setPixOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao gerar PIX");
    } finally {
      setBusy(false);
    }
  };

  const refreshAfterPay = async () => {
    try {
      if (pixIdentifier) {
        const res = await api.confirmPayment(pixIdentifier);
        const u = res.user ? res.user : (await api.me()).user;
        saveUser(u);

        const after = Number(u.coins || 0);
        const before = Number(currentCoins || 0);

        if (after > before) {
          setMsg("Pagamento confirmado! Moedas adicionadas ✅");
          setPixOpen(false);
          return;
        }

        setMsg(`Ainda não confirmado (status: ${res.status}${res.dustpay_status ? ` / dust: ${res.dustpay_status}` : ""}).`);
        return;
      }

      const me = await api.me();
      saveUser(me.user);
      setMsg("Atualizado. Se você acabou de pagar, aguarde alguns segundos e tente novamente.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao confirmar pagamento");
    }
  };

  return (
    <section className="glass-panel mystic-glow mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="h2 flex items-center gap-2">
            <Coins className="w-5 h-5" style={{ color: "hsl(45 93% 58%)" }} />
            Comprar Moedas
          </h2>
          <p className="muted">Você tem {currentCoins} moedas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {coinPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => handlePurchase(pkg.id)}
            disabled={busy}
            className={`
              relative p-4 rounded-xl border transition-all duration-300
              hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
              ${pkg.popular ? "border-primary/50 bg-primary/10 shadow-md shadow-primary/20" : "border-border/50 bg-card/50 hover:border-primary/30"}
            `}
            type="button"
          >
            {pkg.popular && (
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
                style={{
                  background: "linear-gradient(135deg, hsl(263 70% 50%), hsl(330 80% 55%))",
                  color: "white",
                }}
              >
                <Zap className="w-3 h-3" />
                Popular
              </div>
            )}

            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Coins className="w-5 h-5" style={{ color: "hsl(45 93% 58%)" }} />
                <span className="text-xl font-bold">{pkg.amount}</span>
              </div>

              <div className="text-sm font-semibold">{brl(pkg.price)}</div>
              <div className="muted text-xs">PIX instantâneo</div>

              <div
                className={`
                  mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold
                  ${pkg.popular ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary hover:bg-primary/25"}
                `}
              >
                <Plus className="w-3.5 h-3.5" />
                Comprar
              </div>
            </div>
          </button>
        ))}
      </div>

      {(msg || err) && (
        <div className="mt-4">
          {msg && <div className="text-foreground/90">{msg}</div>}
          {err && <div className="err">{err}</div>}
        </div>
      )}

      <PixPaymentModal
        open={pixOpen}
        title={pixTitle || "Pagamento PIX"}
        subtitle={expectedCoins ? `Você receberá +${expectedCoins} moedas após confirmação.` : "Finalize no seu banco e confirme aqui."}
        amountLabel={pixAmountLabel}
        qrCodeText={pixCode}
        qrCodeImageDataUrl={pixImage}
        onClose={() => setPixOpen(false)}
        onIHavePaid={refreshAfterPay}
      />
    </section>
  );
};

export default BuyCoins;
