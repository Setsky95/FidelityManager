// src/components/PrivateRoute.tsx
import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";

type Props = { children: ReactNode };

export function PrivateRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/sign-in", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return <div className="p-6 text-gray-500">Cargando…</div>;
  if (!user) return null; // mientras redirige
  return <>{children}</>;
}

export default PrivateRoute; // opcional, por si preferís import default
