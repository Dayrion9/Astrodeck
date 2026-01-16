import { Moon, Sparkles, Star } from "lucide-react";

const MysticBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Main gradient background */}
      <div className="absolute inset-0 mystic-bg" />
      
      {/* Constellation overlay */}
      <div className="absolute inset-0 constellation-bg" />
      
      {/* Floating decorative elements */}
      <div className="absolute top-[10%] left-[5%] opacity-20 star-pulse">
        <Star className="w-4 h-4 sm:w-6 sm:h-6 text-gold fill-current" style={{ color: 'hsl(45 93% 58%)' }} />
      </div>
      
      <div className="absolute top-[15%] right-[10%] opacity-15" style={{ animationDelay: '1s' }}>
        <Moon className="w-8 h-8 sm:w-12 sm:h-12 star-pulse" style={{ color: 'hsl(45 70% 45%)' }} />
      </div>
      
      <div className="absolute top-[40%] left-[3%] opacity-20 star-pulse" style={{ animationDelay: '2s' }}>
        <Sparkles className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: 'hsl(263 80% 65%)' }} />
      </div>
      
      <div className="absolute bottom-[30%] right-[5%] opacity-15 star-pulse" style={{ animationDelay: '0.5s' }}>
        <Star className="w-3 h-3 sm:w-5 sm:h-5" style={{ color: 'hsl(45 93% 58%)' }} />
      </div>
      
      <div className="absolute bottom-[15%] left-[8%] opacity-20 star-pulse" style={{ animationDelay: '1.5s' }}>
        <Sparkles className="w-4 h-4 sm:w-6 sm:h-6" style={{ color: 'hsl(263 80% 65%)' }} />
      </div>
      
      {/* Large decorative moon */}
      <div className="absolute -bottom-20 -right-20 sm:-bottom-32 sm:-right-32 opacity-[0.03]">
        <Moon className="w-64 h-64 sm:w-96 sm:h-96" />
      </div>
      
      {/* Nebula glow effects */}
      <div 
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ background: 'radial-gradient(circle, hsl(263 70% 50%), transparent 70%)' }}
      />
      <div 
        className="absolute bottom-1/4 right-0 w-80 h-80 rounded-full blur-3xl opacity-10"
        style={{ background: 'radial-gradient(circle, hsl(330 80% 55%), transparent 70%)' }}
      />
    </div>
  );
};

export default MysticBackground;
