import { Eye, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TarotDrawPanelProps {
  topic: string;
  setTopic: (value: string) => void;
  onDraw: () => void;
  busy: boolean;
  error: string | null;
}

const TarotDrawPanel = ({ topic, setTopic, onDraw, busy, error }: TarotDrawPanelProps) => {
  return (
    <section className="glass-panel mystic-glow relative mt-4 sm:mt-6">
      {/* Decorative corner elements */}
      <div className="absolute top-3 right-3 opacity-30">
        <Eye className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'hsl(45 93% 58%)' }} />
      </div>
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Star className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'hsl(263 80% 65%)' }} />
        <h2 className="h2">Tiragem de Cartas</h2>
      </div>
      
      <p className="muted mb-4">
        Digite seu tema ou pergunta e descubra o que as cartas revelam para você.
      </p>
      
      {/* Input and Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            className="input-mystic pr-10"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: Como vai ser minha semana?"
          />
          <Sparkles 
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" 
            style={{ color: 'hsl(263 80% 65%)' }}
          />
        </div>
        
        <Button
          onClick={onDraw}
          disabled={busy || topic.trim().length < 3}
          className="btn-primary w-full sm:w-auto whitespace-nowrap"
        >
          {busy ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Star className="w-4 h-4" />
              <span>Tirar Cartas</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="err flex items-center gap-2 mt-3">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      
      {/* Decorative bottom border */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(45 93% 58% / 0.3), transparent)'
        }}
      />
    </section>
  );
};

export default TarotDrawPanel;
