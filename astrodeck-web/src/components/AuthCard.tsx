import { Moon, Sparkles, Star } from "lucide-react";
import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const AuthCard = ({ title, subtitle, children }: AuthCardProps) => {
  return (
    <div className="glass-card w-full max-w-md mx-auto relative">
      {/* Decorative elements */}
      <div className="absolute -top-3 -right-3 opacity-30 star-pulse">
        <Star className="w-6 h-6" style={{ color: 'hsl(45 93% 58%)' }} />
      </div>
      <div className="absolute -bottom-2 -left-2 opacity-20 star-pulse" style={{ animationDelay: '1s' }}>
        <Sparkles className="w-5 h-5" style={{ color: 'hsl(263 80% 65%)' }} />
      </div>
      
      {/* Header */}
      <div className="text-center mb-6">
        {/* Logo */}
        <div 
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{
            background: 'linear-gradient(135deg, hsl(263 70% 50%), hsl(270 70% 35%))',
            boxShadow: '0 12px 30px -8px hsl(263 70% 30% / 0.6)'
          }}
        >
          <Moon className="w-8 h-8 text-foreground" />
        </div>
        
        <h1 className="h1 flex items-center justify-center gap-2">
          <span>{title}</span>
          <Sparkles className="w-5 h-5 opacity-60" style={{ color: 'hsl(45 93% 58%)' }} />
        </h1>
        <p className="muted mt-2">{subtitle}</p>
      </div>
      
      {/* Content */}
      {children}
      
      {/* Decorative bottom line */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(263 80% 65% / 0.4), transparent)'
        }}
      />
    </div>
  );
};

export default AuthCard;
