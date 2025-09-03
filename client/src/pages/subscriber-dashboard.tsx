import * as React from "react";
import { AuthContext } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

export default function SubscriberDashboard() {
  const { user, loading, logout, refresh } = React.useContext(AuthContext);

  React.useEffect(() => { if (!loading && !user) { /* podrías redirigir si querés */ } }, [loading, user]);

  if (loading) return <div className="min-h-screen grid place-items-center text-white">Cargando…</div>;
  if (!user) return <div className="min-h-screen grid place-items-center text-white">No autenticado</div>;

  const avatar = user.profilePicture || "/Profile-Pictures/1.jpg";

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Mi cuenta</h1>
          <div className="space-x-2">
            <Button variant="secondary" onClick={refresh}>Refrescar</Button>
            <Button variant="destructive" onClick={logout}>Cerrar sesión</Button>
          </div>
        </header>

        <section className="bg-neutral-900/70 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
          <img src={avatar} alt="Avatar" className="w-20 h-20 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-lg font-semibold">{user.nombre} {user.apellido}</p>
            <p className="text-neutral-400 text-sm">{user.email}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-400 text-sm">Puntos</p>
            <p className="text-3xl font-bold text-emerald-400">{user.puntos ?? 0}</p>
          </div>
        </section>

        <section className="bg-neutral-900/70 border border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-neutral-400 text-xs">ID</p>
            <p className="font-mono">{user.id}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs">Número</p>
            <p className="font-mono">VG{user.numero}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs">Registro</p>
            <p>{user.fechaRegistro ? new Date(user.fechaRegistro).toLocaleDateString() : "-"}</p>
          </div>
        </section>

        {/* espacio para movimientos, etc. */}
      </div>
    </div>
  );
}
