import * as React from "react";
import { Redirect } from "wouter";
import { useSubAuth } from "@/providers/SubAuthProvider";

export function PrivateRouteSubscriber({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSubAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-white">Cargando…</div>;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}
