import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";
import { claimCoupon, type Descuento } from "@/lib/coupons";
import { getAuth } from "firebase/auth";
import Confetti from "react-confetti"; // 🎉 agregado

/** Helper: trae costos del backend (usa Bearer si hay y cookie vg_session siempre) */
async function fetchCosts(): Promise<Record<Descuento, number>> {
  let token: string | null = null;
  try {
    const auth = getAuth();
    token = (await auth.currentUser?.getIdToken()) || null;
  } catch {
    token = null;
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/coupons?action=costs", {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) throw new Error("No se pudieron obtener los costos.");
  const data = await res.json();
  return {
    "10%": Number(data?.costPerDiscount?.["10%"] ?? 0),
    "20%": Number(data?.costPerDiscount?.["20%"] ?? 0),
    "40%": Number(data?.costPerDiscount?.["40%"] ?? 0),
  };
}

/** Card de cupón (sin imagen, con outline y % grande) */
function CouponCard({
  label,
  cost,
  disabled,
  reason,
  onClick,
  loading,
}: {
  label: Descuento;
  cost?: number;
  disabled?: boolean;
  loading?: boolean;
  reason?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={reason || undefined}
      className={[
        "relative w-full h-48 rounded-2xl",
        "border-2 border-white/15 bg-neutral-900/60",
        "hover:border-white/30 hover:bg-neutral-900",
        "transition-all duration-200",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/20",
        "grid place-items-center px-4 text-center",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-black tracking-tight">{label}</span>
        <span className="text-xs text-neutral-400">
          {typeof cost === "number" ? `Cuesta ${cost} pts` : "Descuento disponible"}
        </span>
        {reason && <span className="text-[11px] text-amber-400">{reason}</span>}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/5" />

      {loading && (
        <div className="absolute inset-0 bg-black/30 grid place-items-center rounded-2xl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
        </div>
      )}
    </button>
  );
}

/** Hook mínimo para tamaño de ventana (sin libs externas) */
function useWindowSize() {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export default function SubscriberDashboard() {
  const { user, loading, logout } = useSubAuth();

  const [claiming, setClaiming] = React.useState<Descuento | null>(null);
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [codigoObtenido, setCodigoObtenido] = React.useState<string | null>(null);

  const [puntosUI, setPuntosUI] = React.useState<number>(user?.puntos ?? 0);
  React.useEffect(() => setPuntosUI(user?.puntos ?? 0), [user?.puntos]);

  const [costos, setCostos] = React.useState<Record<Descuento, number>>({
    "10%": 0,
    "20%": 0,
    "40%": 0,
  });
  const [loadingCosts, setLoadingCosts] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const c = await fetchCosts();
        setCostos(c);
      } catch (e: any) {
        console.warn("No se pudieron cargar los costos:", e?.message);
      } finally {
        setLoadingCosts(false);
      }
    })();
  }, []);

  const onClaim = async (descuento: Descuento) => {
    if (!user) return;
    setMensaje(null);
    setCodigoObtenido(null);
    setClaiming(descuento);

    try {
      const cost = costos[descuento];
      if (Number.isFinite(cost) && (puntosUI ?? 0) < cost) {
        const falta = cost - (puntosUI ?? 0);
        setMensaje(`No te alcanzan los puntos para el ${descuento}. Te faltan ${falta}.`);
        return;
      }

      const res = await claimCoupon({ descuento });

      if ((res as any)?.noAvailable) {
        setMensaje(`No hay cupones ${descuento} disponibles ahora mismo.`);
        return;
      }
      if ((res as any)?.insufficient) {
        const { need, have } = res as any;
        setMensaje(
          `No te alcanzan los puntos para el ${descuento}. Requerido: ${need}. Tenés: ${have}.`
        );
        return;
      }

      const codigo = (res as any)?.codigo;
      const newPoints = (res as any)?.newPoints;
      const costFromServer = (res as any)?.cost;

      if (typeof codigo !== "string" || codigo.trim().length === 0) {
        setMensaje("No se pudo reclamar el cupón en este momento. Probá de nuevo.");
        return;
      }

      const resolvedCost =
        typeof costFromServer === "number" ? costFromServer : costos[descuento] ?? 0;

      setCodigoObtenido(codigo);
      if (typeof newPoints === "number") setPuntosUI(newPoints);
      setMensaje(`¡Listo! Canjeaste un cupón ${descuento} por ${resolvedCost} puntos.`);
    } catch (err: any) {
      setMensaje(err?.message ?? "No se pudo reclamar el cupón.");
    } finally {
      setClaiming(null);
    }
  };

  // ===== 🎉 Aparición/Desaparición suave en 5s =====
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = React.useState(false);   // montado
  const [confettiVisible, setConfettiVisible] = React.useState(false); // opacidad
  const FADE_MS = 500; // 500ms in / 500ms out

  React.useEffect(() => {
    if (!codigoObtenido) return;

    // Monta y hace fade-in
    setShowConfetti(true);
    // Permite al browser aplicar el transition
    const tIn = setTimeout(() => setConfettiVisible(true), 0);

    // Inicia fade-out a los 4500ms y desmonta a los 5000ms
    const tOutStart = setTimeout(() => setConfettiVisible(false), 5000 - FADE_MS);
    const tOutEnd = setTimeout(() => setShowConfetti(false), 5000);

    return () => {
      clearTimeout(tIn);
      clearTimeout(tOutStart);
      clearTimeout(tOutEnd);
    };
  }, [codigoObtenido]);

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
      {/* 🎉 Confetti con fade-in/out y 5s de vida total */}
      {showConfetti && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            opacity: confettiVisible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          <Confetti
            width={width || undefined}
            height={height || undefined}
            numberOfPieces={400}
            recycle={false}
          />
        </div>
      )}

      <div className="max-w-2xl mx-auto bg-neutral-900 rounded-2xl border border-white/10 p-6">
        {/* Header usuario */}
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

        {/* Puntos */}
        <div className="mt-6">
          <p className="text-lg">
            Tus puntos:{" "}
            <span className="font-mono text-emerald-400">{puntosUI ?? 0}</span>
          </p>
          <p className="text-sm text-neutral-400">ID de socio: {user.id}</p>
        </div>

        {/* Título */}
        <div className="mt-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Reclamar cupón</h2>
          {loadingCosts && (
            <p className="text-xs text-neutral-400 mb-2">Cargando costos…</p>
          )}
        </div>

        {/* Grid cupones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["10%", "20%", "40%"] as Descuento[]).map((d) => {
            const cost = costos[d];
            const falta = Math.max(0, (cost ?? 0) - (puntosUI ?? 0));
            const notEnough = Number.isFinite(cost) && falta > 0;
            const disabled = !!claiming || loadingCosts || notEnough;

            return (
              <CouponCard
                key={d}
                label={d}
                cost={Number.isFinite(cost) ? cost : undefined}
                loading={claiming === d}
                disabled={disabled}
                reason={notEnough ? `Te faltan ${falta} pts` : null}
                onClick={() => {
                  if (disabled) return;
                  onClaim(d);
                }}
              />
            );
          })}
        </div>

        {/* Mensajes y código */}
        {mensaje && (
          <p className="mt-4 text-sm text-neutral-300 text-center">{mensaje}</p>
        )}

        {codigoObtenido && (
          <div className="mt-3 mx-auto max-w-md rounded-lg border border-white/10 bg-neutral-800 p-4 space-y-3">
            <p className="text-sm text-neutral-400">Tu código:</p>
            <p className="text-xl font-mono">{codigoObtenido}</p>

            <div className="flex justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(codigoObtenido)}
              >
                Copiar código
              </Button>
              <Button asChild>
                <a
                  href="https://menu.vangoghburger.com.ar/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hacer pedido
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={logout}>
            Cerrar sesión
          </Button>
          <Button asChild>
            <a
              href="https://menu.vangoghburger.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ir a la tienda
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
