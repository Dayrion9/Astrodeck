import { Coins, Crown, LogOut, Moon, Sparkles } from "lucide-react";

interface MysticHeaderProps {
  username: string;
  coins: number;
  isPremium: boolean;
  onLogout: () => void;
}

const MysticHeader = ({ username, coins, isPremium, onLogout }: MysticHeaderProps) => {
  return (
    <header className="relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Logo and User Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Logo Icon */}
          <div 
            className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(263 70% 50%), hsl(270 70% 35%))',
              boxShadow: '0 10px 25px -5px hsl(263 70% 30% / 0.5)'
            }}
          >
            <Moon className="w-5 h-5 sm:w-7 sm:h-7 text-foreground" />
            <Sparkles 
              className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 star-pulse" 
              style={{ color: 'hsl(45 93% 58%)' }}
            />
          </div>
          
          {/* Title and User */}
          <div className="min-w-0">
            <h1 className="h1 flex items-center gap-2">
              <span>Astrodeck</span>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-gold opacity-60" style={{ color: 'hsl(45 93% 58%)' }} />
            </h1>
            <p className="muted mt-0.5 truncate">
              Olá, <span className="font-semibold text-foreground">{username}</span>
            </p>
          </div>
        </div>
        
        {/* Stats and Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Coins Badge */}
          <div 
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm sm:text-base font-semibold"
            style={{
              background: 'hsl(var(--card) / 0.8)',
              border: '1px solid hsl(45 93% 58% / 0.3)',
            }}
          >
            <Coins className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'hsl(45 93% 58%)' }} />
            <span className="gold-shimmer font-bold">{coins}</span>
          </div>
          
          {/* Premium Badge */}
          <div 
            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm sm:text-base font-semibold ${
              isPremium ? 'text-foreground' : 'text-muted-foreground'
            }`}
            style={{
              background: isPremium 
                ? 'linear-gradient(135deg, hsl(263 70% 50% / 0.3), hsl(330 80% 55% / 0.2))'
                : 'hsl(var(--card) / 0.6)',
              border: isPremium 
                ? '1px solid hsl(330 80% 55% / 0.4)'
                : '1px solid hsl(var(--glass-border))',
            }}
          >
            <Crown className={`w-4 h-4 sm:w-5 sm:h-5 ${isPremium ? 'star-pulse' : ''}`} style={{ color: isPremium ? 'hsl(330 80% 55%)' : undefined }} />
            <span>{isPremium ? 'Premium' : 'Free'}</span>
          </div>
          
          {/* Logout Button */}
          <button 
            onClick={onLogout}
            className="btn-link flex items-center gap-1.5 p-2 rounded-lg hover:bg-card/50 transition-colors"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default MysticHeader;
