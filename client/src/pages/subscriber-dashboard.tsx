import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";

export default function SubscriberDashboard() {
  const { user, loading, logout } = useSubAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-white bg-neutral-950">
        <p>Cargando tu perfil…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center text-white bg-neutral-950">
        <p>No has iniciado sesión.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto bg-neutral-900 rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-4">
          {user.profilePicture && (
            <img
              src={user.profilePicture}
              alt="Avatar"
              className="h-20 w-20 rounded-full border border-white/20 object-cover"
            />
          )}
          <div>
            <h1 className="text-xl font-bold">
              {user.nombre} {user.apellido}
            </h1>
            <p className="text-neutral-400">{user.email}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-lg">
            Tus puntos:{" "}
            <span className="font-mono text-emerald-400">
              {user.puntos ?? 0}
            </span>
          </p>
          <p className="text-sm text-neutral-400">ID de socio: {user.id}</p>
        </div>

        <div className="mt-6">
          <Button onClick={logout}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  );
}
