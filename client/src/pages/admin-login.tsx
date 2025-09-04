// src/pages/admin-login.tsx
import * as React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const { user, loading, loginWithGoogle } = useAuth();
  const [, navigate] = useLocation();

  React.useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

  const onGoogle = async () => {
    await loginWithGoogle();
    // por si el onAuthStateChanged tarda un frame:
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white p-6">
      <div className="w-full max-w-sm bg-neutral-900 rounded-2xl border border-white/10 p-6">
        <h1 className="text-xl font-semibold mb-4">Acceso Administrador</h1>
        <Button onClick={onGoogle} className="w-full">Continuar con Google</Button>
        <p className="text-xs text-neutral-400 mt-3">
          Asegurate de usar un dominio autorizado en Firebase.
        </p>
      </div>
    </div>
  );
}
