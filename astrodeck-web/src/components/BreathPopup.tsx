import { Moon, Sparkles } from "lucide-react";

/**
 * Fullscreen overlay shown while the reading is being processed.
 * Uses a soft pulse animation to match the mystic theme.
 */
const BreathPopup = () => {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel mystic-glow w-full max-w-md rounded-2xl border border-white/10 bg-black/40 animate-pulse">
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div
            className="w-14 h-14 rounded-2xl grid place-items-center"
            style={{
              background: "linear-gradient(135deg, hsl(263 70% 50%), hsl(330 80% 55%))",
              boxShadow: "0 10px 25px -5px hsl(263 70% 50% / 0.45)",
            }}
          >
            <Moon className="w-7 h-7" />
          </div>

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 opacity-80" />
            <div className="text-lg sm:text-xl font-extrabold tracking-wide">
              Respire fundo e mentalize a pergunta
            </div>
          </div>

          <div className="muted text-sm sm:text-base">
            Estamos preparando sua tiragem...
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreathPopup;
