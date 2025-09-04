import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";
import { claimCoupon, type Descuento } from "@/lib/coupons";

export default function SubscriberDashboard() {
  const { user, loading, logout } = useSubAuth();
  const [claiming, setClaiming] = React.useState<Descuento | null>(null);
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [codigoObtenido, setCodigoObtenido] = React.useState<string | null>(null);

  const onClaim = async (descuento: Descuento) => {
    if (!user) return;
    setMensaje(null);
    setCodigoObtenido(null);
    setClaiming(descuento);

    try {
      const res = await claimCoupon({
        descuento,
        userId: user.id,
        userEmail: user.email,
      });

      if (!res) {
        setMensaje(`No hay cupones ${descuento} disponibles ahora mismo.`);
      } else {
        setCodigoObtenido(res.codigo);
        setMensaje(`¡Listo! Te asignamos un cupón ${descuento}.`);
      }
    } catch (err: any) {
      setMensaje(err?.message ?? "Error al asignar el cupón.");
    } finally {
      setClaiming(null);
    }
  };

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
            <span className="font-mono text-emerald-400">{user.puntos ?? 0}</span>
          </p>
          <p className="text-sm text-neutral-400">ID de socio: {user.id}</p>
        </div>

        {/* === BOTONES DE CUPONES === */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Reclamar cupón</h2>
          <div className="flex flex-wrap gap-3">
            {(["10%", "20%", "40%"] as Descuento[]).map((d) => (
              <Button
                key={d}
                variant="secondary"
                disabled={!!claiming}
                onClick={() => onClaim(d)}
              >
                {claiming === d ? "Buscando…" : d}
              </Button>
            ))}
          </div>

          {mensaje && <p className="mt-4 text-sm text-neutral-300">{mensaje}</p>}

          {codigoObtenido && (
            <div className="mt-2 rounded-lg border border-white/10 bg-neutral-800 p-4">
              <p className="text-sm text-neutral-400">Tu código:</p>
              <p className="text-xl font-mono">{codigoObtenido}</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <Button onClick={logout}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  );
}
