import * as React from "react";
import { AuthContext } from "@/providers/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function LoginPage() {
  const { login } = React.useContext(AuthContext);
  const [, navigate] = useLocation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/mi-cuenta");
    } catch (e: any) {
      alert(e?.message || "Login inválido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-neutral-900 p-6 rounded-2xl border border-white/10 space-y-3">
        <h1 className="text-xl font-semibold">Iniciá sesión</h1>
        <Input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading} />
        <Input type="password" placeholder="contraseña" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} />
        <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
        <p className="text-xs text-neutral-400">¿No tenés cuenta? <Link href="/sumate" className="underline">Registrate</Link></p>
      </form>
    </div>
  );
}
