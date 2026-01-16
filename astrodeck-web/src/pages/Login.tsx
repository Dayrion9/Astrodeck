import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MysticBackground from "@/components/MysticBackground";
import AuthCard from "@/components/AuthCard";
import { api } from "@/lib/api";
import { saveUser } from "@/lib/session";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      if (remember) saveUser(res.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao logar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <MysticBackground />

      <div className="center-screen relative z-10">
        <AuthCard title="ASTRODECK" subtitle="Conecte-se para iniciar sua jornada mística">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                className="input-mystic"
                placeholder="seu@email.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <input
                className="input-mystic"
                placeholder="Senha"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" className="muted text-sm">
                Manter conectado
              </label>
            </div>

            <button type="submit" className="btn-primary w-full py-3.5" disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </button>

            {error && <div className="err text-center">{error}</div>}

            <p className="muted text-center">
              Não tem conta?{" "}
              <Link to="/register" className="font-bold transition-colors" style={{ color: "hsl(263 70% 60%)" }}>
                Cadastre-se
              </Link>
            </p>
          </form>
        </AuthCard>
      </div>
    </div>
  );
};

export default Login;
