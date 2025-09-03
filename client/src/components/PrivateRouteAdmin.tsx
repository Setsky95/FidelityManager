import * as React from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/providers/AuthProvider";

export function PrivateRouteAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
        <p>Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/admin-login" />; // 👈 o a la ruta de login de admin
  }

  return <>{children}</>;
}
