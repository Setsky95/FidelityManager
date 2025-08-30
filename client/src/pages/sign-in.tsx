// src/pages/sign-in.tsx
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebase";
import { useLocation } from "wouter";
import { LogIn } from "lucide-react";
import { useState } from "react";

export default function SignIn() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      navigate("/"); // al dashboard
    } catch (e) {
      console.error(e);
      alert("No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-center">Van Gogh Fidelidad</h1>
        <Button className="w-full" onClick={handleLogin} disabled={loading}>
          <LogIn className="h-4 w-4 mr-2" />
          {loading ? "Conectando…" : "Continuar con Google"}
        </Button>
      </div>
    </div>
  );
}
