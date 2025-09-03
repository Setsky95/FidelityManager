// client/src/components/PrivateRouteAdmin.tsx
import * as React from "react";
import { Redirect } from "wouter";
import { useAdminAuth } from "@/providers/AdminAuthProvider";

export function PrivateRouteAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-white bg-neutral-950">
        Cargando…
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/admin-login" />;
  }

  return <>{children}</>;
}
