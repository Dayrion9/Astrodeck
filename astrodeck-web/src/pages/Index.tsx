import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MysticBackground from "@/components/MysticBackground";
import MysticHeader from "@/components/MysticHeader";
import PushBanner from "@/components/PushBanner";
import TarotDrawPanel from "@/components/TarotDrawPanel";
import PremiumCTA from "@/components/PremiumCTA";
import BuyCoins from "@/components/BuyCoins";
import BreathPopup from "@/components/BreathPopup";
import TarotResultPanel from "@/components/TarotResultPanel";
import { api, type TarotReadingResponse, type User } from "@/lib/api";
import { clearUser, loadUser, saveUser } from "@/lib/session";

const Index = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(() => (typeof window !== "undefined" ? loadUser() : null));
  const [result, setResult] = useState<TarotReadingResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.me();
        if (!mounted) return;
        setUser(res.user);
        saveUser(res.user);
      } catch {
        // Not logged in
        clearUser();
        navigate("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function onDraw() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.tarotReading(topic, user.id);
      setResult(res);
      const updatedUser = { ...user, coins: res.coins, is_premium: res.isPremium };
      setUser(updatedUser);
      saveUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer tiragem");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      clearUser();
      navigate("/login");
    }
  }

  if (!user) return null;

  return (
    <div className="relative min-h-screen">
      <MysticBackground />
      {busy && <BreathPopup />}

      <main className="relative z-10 container-app">
        <MysticHeader
          username={user.username}
          coins={user.coins}
          isPremium={user.is_premium}
          onLogout={onLogout}
        />
      <PushBanner />

        <TarotDrawPanel topic={topic} setTopic={setTopic} onDraw={onDraw} busy={busy} error={error} />

        {result && (
          <TarotResultPanel
            topic={result.topic}
            isPremium={result.isPremium}
            coins={result.coins}
            cards={result.cards}
            description={result.description}
          />
        )}

        <PremiumCTA isPremium={user.is_premium} />

        <BuyCoins currentCoins={user.coins} />
      </main>
    </div>
  );
};

export default Index;
