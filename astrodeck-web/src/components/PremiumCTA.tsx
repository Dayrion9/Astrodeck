import { Crown, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";

interface PremiumCTAProps {
  isPremium: boolean;
}

const PremiumCTA = ({ isPremium }: PremiumCTAProps) => {
  return (
    <section className="glass-panel premium-cta relative mt-4 sm:mt-6 overflow-hidden">
      {/* Decorative stars */}
      <div className="absolute top-2 left-3 opacity-20 star-pulse">
        <Star className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: 'hsl(45 93% 58%)' }} />
      </div>
      <div className="absolute bottom-3 right-4 opacity-15 star-pulse" style={{ animationDelay: '1s' }}>
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'hsl(330 80% 55%)' }} />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Content */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Icon */}
          <div 
            className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
            style={{
              background: isPremium 
                ? 'linear-gradient(135deg, hsl(330 80% 55%), hsl(263 70% 50%))'
                : 'linear-gradient(135deg, hsl(263 70% 50% / 0.5), hsl(330 80% 55% / 0.3))',
              boxShadow: isPremium 
                ? '0 8px 20px -5px hsl(330 80% 55% / 0.4)'
                : '0 8px 20px -5px hsl(263 70% 50% / 0.3)'
            }}
          >
            <Crown className={`w-5 h-5 sm:w-6 sm:h-6 ${isPremium ? 'star-pulse' : ''}`} />
          </div>
          
          {/* Text */}
          <div className="min-w-0">
            <h2 className="h2 flex items-center gap-2">
              <span>{isPremium ? 'Premium Ativo' : 'Seja Premium'}</span>
              {isPremium && (
                <Sparkles className="w-4 h-4 star-pulse" style={{ color: 'hsl(45 93% 58%)' }} />
              )}
            </h2>
            <p className="muted mt-1">
              {isPremium
                ? 'Gerencie seu plano e veja opções de ativação.'
                : 'Desbloqueie benefícios e faça tiragens com mais tranquilidade.'}
            </p>
          </div>
        </div>
        
        {/* CTA Button */}
        <Link 
          to="/premium" 
          className="btn-premium w-full sm:w-auto justify-center"
        >
          <Crown className="w-4 h-4" />
          <span>{isPremium ? 'Gerenciar' : 'Ver Premium'}</span>
        </Link>
      </div>
    </section>
  );
};

export default PremiumCTA;
