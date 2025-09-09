import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";
import { claimCoupon } from "@/lib/coupons"; // asume que hace POST /api/coupons { action:'claim', descuento }
import { getAuth } from "firebase/auth";

// Lazy Confetti para evitar SSR issues
const LazyConfetti = React.lazy(() => import("react-confetti"));

/** Claves que maneja el backend */
type DescuentoAPI = "10%" | "20%" | "40%" | "50%" | "75%" | "envio_gratis";

/** Etiquetas que mostramos en UI */
type DescuentoUI = "10%" | "20%" | "50%" | "75%" | "Envío gratis"; // podés sumar "40%" si lo usás

// Si querés incluir 40% en la UI, habilitalo acá:
const DESCUENTOS_UI: DescuentoUI[] = ["10%", "20%", /* "40%" as any,*/ "50%", "75%", "Envío gratis"];

/** Normalización UI -> API */
function uiToApi(d: DescuentoUI): DescuentoAPI {
  if (d === "Envío gratis") return "envio_gratis";
  // @ts-expect-error: si habilitás "40%", TypeScript lo acepta
  return d;
}

/** Normalización API -> UI (para mostrar costos) */
function apiToUi(d: DescuentoAPI): DescuentoUI {
  if (d === "envio_gratis") return "Envío gratis";
  // @ts-expect-error: si habilitás "40%", TypeScript lo acepta
  return d;
}

/** Trae costos del backend tal como vienen y los mapea a UI */
async function fetchCosts(): Promise<Record<DescuentoUI, number>> {
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

  const { costPerDiscount } = await res.json() as {
    costPerDiscount: Partial<Record<DescuentoAPI, number>>;
  };

  // Mapear de claves API -> UI, dejando 0 por defecto si no viene
  const out: Record<DescuentoUI, number> = {
    "10%": Number(costPerDiscount["10%"] ?? 0),
    "20%": Number(costPerDiscount["20%"] ?? 0),
    // "40%": Number(costPerDiscount["40%"] ?? 0), // habilitar si usás 40% en la UI
    "50%": Number(costPerDiscount["50%"] ?? 0),
    "75%": Number(costPerDiscount["75%"] ?? 0),
    "Envío gratis": Number(costPerDiscount["envio_gratis"] ?? 0),
  } as any;

  return out;
}

/** Card de cupón */
function CouponCard({
  label,
  cost,
  disabled,
  reason,
  onClick,
  loading,
}: {
  label: DescuentoUI;
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
        "border-2",
        disabled ? "border-white/10 bg-neutral-900/50" : "border-white/15 bg-neutral-900/60",
        disabled ? "" : "hover:border-white/30 hover:bg-neutral-900",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
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

/** Hook mínimo para tamaño de ventana */
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

  const [claiming, setClaiming] = React.useState<DescuentoUI | null>(null);
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [codigoObtenido, setCodigoObtenido] = React.useState<string | null>(null);

  const [puntosUI, setPuntosUI] = React.useState<number>(user?.puntos ?? 0);
  React.useEffect(() => setPuntosUI(user?.puntos ?? 0), [user?.puntos]);

  const [costos, setCostos] = React.useState<Record<DescuentoUI, number>>({
    "10%": 0,
    "20%": 0,
    // "40%": 0,
    "50%": 0,
    "75%": 0,
    "Envío gratis": 0,
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

  const onClaim = async (descuentoUi: DescuentoUI) => {
    if (!user) return;
    setMensaje(null);
    setCodigoObtenido(null);
    setClaiming(descuentoUi);

    try {
      // Simplificación: NO hacemos pre-validaciones complejas en el front.
      // Mandamos el descuento normalizado y dejamos que el backend resuelva atomizando en la transacción.
      const descuentoApi = uiToApi(descuentoUi);

      const res = await claimCoupon({ descuento: descuentoApi as any }); // usa la clave backend

      if ((res as any)?.noAvailable || (res as any)?.error === "no_available") {
        setMensaje(`No hay cupones ${descuentoUi} disponibles ahora mismo.`);
        return;
      }
      if ((res as any)?.insufficient || (res as any)?.error === "insufficient_points") {
        const need = (res as any)?.need ?? costos[descuentoUi] ?? 0;
        const have = (res as any)?.have ?? (puntosUI ?? 0);
        setMensaje(`No te alcanzan los puntos para ${descuentoUi}. Requerido: ${need}. Tenés: ${have}.`);
        return;
      }

      const codigo = (res as any)?.codigo;
      const newPoints = (res as any)?.newPoints;
      const costFromServer = (res as any)?.cost;

      if (typeof codigo !== "string" || !codigo.trim()) {
        setMensaje("No se pudo reclamar el cupón en este momento. Probá de nuevo.");
        return;
      }

      // Actualizamos puntos si el backend los devuelve
      if (typeof newPoints === "number") setPuntosUI(newPoints);

      // Mensaje final usando etiqueta UI
      const resolvedCost = Number.isFinite(costFromServer) ? costFromServer : (costos[descuentoUi] ?? 0);
      setCodigoObtenido(codigo);
      setMensaje(`¡Listo! Canjeaste un cupón ${descuentoUi} por ${resolvedCost} puntos.`);
    } catch (err: any) {
      setMensaje(err?.message ?? "No se pudo reclamar el cupón.");
    } finally {
      setClaiming(null);
    }
  };

  // 🎉 Confetti con lazy load y fade
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [confettiVisible, setConfettiVisible] = React.useState(false);
  const FADE_MS = 500;

  React.useEffect(() => {
    if (!codigoObtenido) return;
    setShowConfetti(true);
    const tIn = setTimeout(() => setConfettiVisible(true), 0);
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
      {showConfetti && width > 0 && height > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{ opacity: confettiVisible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
        >
          <React.Suspense fallback={null}>
            <LazyConfetti width={width} height={height} numberOfPieces={300} recycle={false} gravity={0.25} wind={0} />
          </React.Suspense>
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
            Tus puntos: <span className="font-mono text-emerald-400">{puntosUI ?? 0}</span>
          </p>
          <p className="text-sm text-neutral-400">ID de socio: {user.id}</p>
        </div>

        {/* Título */}
        <div className="mt-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Reclamar cupón</h2>
          {loadingCosts && <p className="text-xs text-neutral-400 mb-2">Cargando costos…</p>}
        </div>

        {/* Grid cupones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DESCUENTOS_UI.map((d) => {
            const cost = costos[d];
            const costKnown = Number.isFinite(cost);
            const disabled = !!claiming || loadingCosts || !costKnown;

            return (
              <CouponCard
                key={d}
                label={d}
                cost={costKnown ? (cost as number) : undefined}
                loading={claiming === d}
                disabled={disabled}
                reason={!costKnown ? "Cargando costo…" : null}
                onClick={() => {
                  if (disabled) return;
                  onClaim(d);
                }}
              />
            );
          })}
        </div>

        {/* Mensajes y código */}
        {mensaje && <p className="mt-4 text-sm text-neutral-300 text-center">{mensaje}</p>}

        {codigoObtenido && (
          <div className="mt-3 mx-auto max-w-md rounded-lg border border-white/10 bg-neutral-800 p-4 space-y-3">
            <p className="text-sm text-neutral-400">Tu código:</p>
            <p className="text-xl font-mono">{codigoObtenido}</p>

            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(codigoObtenido)}>
                Copiar código
              </Button>
              <Button asChild>
                <a href="https://menu.vangoghburger.com.ar/" target="_blank" rel="noopener noreferrer">
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
            <a href="https://menu.vangoghburger.com.ar/" target="_blank" rel="noopener noreferrer">
              Ir a la tienda
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
