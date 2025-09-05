import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";
import { claimCoupon, type Descuento } from "@/lib/coupons";

/** Card de cupón con imagen placeholder y hover lindo */
function CouponCard({
  label,
  disabled,
  onClick,
  loading,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "group relative w-40 h-44 rounded-2xl overflow-hidden",
        "border border-white/10 bg-neutral-800/60",
        "hover:border-white/30 hover:bg-neutral-800",
        "transition-all duration-200",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/20",
      ].join(" ")}
    >
      <div className="h-24 w-full overflow-hidden">
        <img
          src="https://picsum.photos/400/240?blur=2"
          alt="Cupón"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="p-3 text-center">
        <span className="text-xl font-extrabold tracking-wide">
          {loading ? "Buscando…" : label}
        </span>
        <div className="mt-1 text-xs text-neutral-400">Descuento disponible</div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/5 group-hover:ring-white/15" />

      {loading && (
        <div className="absolute inset-0 bg-black/30 grid place-items-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
        </div>
      )}
    </button>
  );
}

export default function SubscriberDashboard() {
  const { user, loading, logout } = useSubAuth();
  const [claiming, setClaiming] = React.useState<Descuento | null>(null);
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [codigoObtenido, setCodigoObtenido] = React.useState<string | null>(null);

  // puntos visibles en UI (no tocamos el provider)
  const [puntosUI, setPuntosUI] = React.useState<number>(user?.puntos ?? 0);
  React.useEffect(() => setPuntosUI(user?.puntos ?? 0), [user?.puntos]);

  const onClaim = async (descuento: Descuento) => {
    if (!user) return;
    setMensaje(null);
    setCodigoObtenido(null);
    setClaiming(descuento);

    try {
      const res = await claimCoupon({ descuento });

      // sin stock
      if ((res as any)?.noAvailable) {
        setMensaje(`No hay cupones ${descuento} disponibles ahora mismo.`);
        return;
      }
      // puntos insuficientes
      if ((res as any)?.insufficient) {
        const { need, have } = res as any;
        setMensaje(
          `No te alcanzan los puntos para el ${descuento}. Requerido: ${need}. Tenés: ${have}.`
        );
        return;
      }

      // éxito: { codigo, newPoints, cost }
      const { codigo, newPoints, cost } = res as any;
      setCodigoObtenido(codigo);
      setPuntosUI(typeof newPoints === "number" ? newPoints : puntosUI);
      setMensaje(`¡Listo! Canjeaste un cupón ${descuento} por ${cost} puntos.`);

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
            <span className="font-mono text-emerald-400">{puntosUI ?? 0}</span>
          </p>
          <p className="text-sm text-neutral-400">ID de socio: {user.id}</p>
        </div>

        {/* === CARDS DE CUPONES === */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Reclamar cupón</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["10%", "20%", "40%"] as Descuento[]).map((d) => (
              <CouponCard
                key={d}
                label={d}
                loading={claiming === d}
                disabled={!!claiming}
                onClick={() => onClaim(d)}
              />
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
