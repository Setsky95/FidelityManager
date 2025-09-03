// src/components/PrivateRouteAdmin.tsx
import { Redirect } from "wouter";
import { useAuth } from "@/providers/AuthProvider";

export default function PrivateRouteAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Gate: mientras carga, no tomar decisiones de ruta
    return <div className="min-h-screen grid place-items-center text-white bg-neutral-950">Cargando…</div>;
  }

  if (!user) return <Redirect to="/admin-login" />;
  return <>{children}</>;
}
