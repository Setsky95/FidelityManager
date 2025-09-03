import * as React from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      navigate("/mi-cuenta");
    }
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/mi-cuenta");
    } catch (err: any) {
      alert(err?.message || "Login inválido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-neutral-900 p-6 rounded-2xl border border-white/10 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-semibold">Iniciá sesión</h1>
          <p className="text-neutral-400 text-sm">Usá tu email y contraseña</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <Input
            type="email"
            placeholder="socio@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Contraseña</label>
          <Input
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Ingresando…" : "Entrar"}
        </Button>

        <p className="text-xs text-neutral-400">
          ¿No tenés cuenta?{" "}
          <Link href="/sumate" className="underline">
            Registrate
          </Link>
        </p>
      </form>
    </div>
  );
}
