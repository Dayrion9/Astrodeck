import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MysticBackground from "@/components/MysticBackground";
import AuthCard from "@/components/AuthCard";
import { api } from "@/lib/api";
import { saveUser } from "@/lib/session";

function normalizeBrazilPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  const with55 = digits.startsWith("55") ? digits : `55${digits}`;
  return with55;
}

const Register = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("55");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = useMemo(() => normalizeBrazilPhone(phone), [phone]);

  function onPhoneChange(next: string) {
    const digits = next.replace(/\D+/g, "");
    const forced = digits.startsWith("55") ? digits : `55${digits}`;
    setPhone(forced);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const normalizedPhone = normalizeBrazilPhone(phone);

      // basic client-side guard (backend also validates)
      if (nome.trim().length < 2) throw new Error("Informe seu nome completo.");
      if (normalizedPhone.length < 12) throw new Error("Informe um telefone válido (55 + DDD + número).");

      const res = await api.register(nome.trim(), username.trim(), normalizedPhone, email.trim(), password);
      saveUser(res.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <MysticBackground />

      <div className="center-screen relative z-10">
        <AuthCard title="Cadastro ✨" subtitle="Crie sua conta em segundos">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome completo</label>
              <input
                className="input-mystic"
                placeholder="Seu nome completo"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Usuário</label>
              <input
                className="input-mystic"
                placeholder="Seu username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <input
                className="input-mystic"
                placeholder="55DDDNÚMERO (ex: 5551999972948)"
                inputMode="numeric"
                required
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                autoComplete="tel"
              />
              <div className="muted text-xs sm:text-sm">
                Formato: <span className="text-foreground/80">{phoneDigits}</span>
              </div>
            </div>

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
                placeholder="Senha (mín. 6)"
                minLength={6}
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3.5" disabled={busy}>
              {busy ? "Criando..." : "Criar conta"}
            </button>

            {error && <div className="err text-center">{error}</div>}

            <p className="muted text-center">
              Já tem conta?{" "}
              <Link to="/login" className="font-bold transition-colors" style={{ color: "hsl(263 70% 60%)" }}>
                Entrar
              </Link>
            </p>
          </form>
        </AuthCard>
      </div>
    </div>
  );
};

export default Register;
