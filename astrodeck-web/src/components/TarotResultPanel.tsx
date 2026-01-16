import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { TarotCardView } from "@/lib/api";

interface TarotResultPanelProps {
  topic: string;
  isPremium: boolean;
  coins: number;
  cards: TarotCardView[];
  description: string;
}

/**
 * Renders cards BEFORE the text and keeps everything inside the main glass panel.
 * Cards are responsive (smaller on phones).
 */
const TarotResultPanel = ({ topic, isPremium, coins, cards, description }: TarotResultPanelProps) => {
  const [openCard, setOpenCard] = useState<TarotCardView | null>(null);

  const safeCards = useMemo(() => cards ?? [], [cards]);

  return (
    <>
      <section className="glass-panel mystic-glow relative mt-4 sm:mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="h2 flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: "hsl(263 70% 60%)" }} />
              Resultado
            </h2>
            <p className="muted mt-1 text-sm sm:text-base">
              Pergunta: <span className="text-foreground/90">{topic}</span>
              {" · "}
              Plano: <span className="text-foreground/90">{isPremium ? "Premium" : "Free"}</span>
              {" · "}
              Coins: <span className="text-foreground/90">{coins}</span>
            </p>
          </div>
        </div>

        {/* Cards first */}
        <div className="mt-4">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {safeCards.map((c, i) => (
              <button
                key={`${c.file_name ?? i}`}
                type="button"
                onClick={() => setOpenCard(c)}
                className="flex-none rounded-xl border border-white/10 bg-black/20 hover:bg-black/25 transition"
                style={{ width: "min(26vw, 120px)" }}
                aria-label={`Abrir carta ${c.name_pt}`}
              >
                <div className="p-2">
                  <div className="text-xs sm:text-sm font-semibold line-clamp-1">{c.name_pt}</div>
                  <div className="mt-2 rounded-lg overflow-hidden border border-white/10 bg-black/20 aspect-[2/3]">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name_pt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center muted text-xs">Sem imagem</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Text after cards, constrained */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
            <div className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed max-w-full max-h-[45vh] overflow-y-auto pr-1">
              {description}
            </div>
          </div>
        </div>
      </section>

      {/* Card lightbox (mobile-friendly sizing) */}
      {openCard && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/80"
          onClick={() => setOpenCard(null)}
        >
          <div
            className="relative w-full max-w-[420px] sm:max-w-[520px] rounded-2xl border border-white/10 bg-card/95 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-semibold">{openCard.name_pt}</div>
              <button className="btn-link text-sm" onClick={() => setOpenCard(null)} type="button">
                Fechar
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
              {openCard.image_url ? (
                <img
                  src={openCard.image_url}
                  alt={openCard.name_pt}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              ) : (
                <div className="p-6 muted">Sem imagem</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TarotResultPanel;
