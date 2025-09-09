import * as React from "react";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Button } from "@/components/ui/button";
import { claimCoupon } from "@/lib/coupons";
import { getAuth } from "firebase/auth";

const LazyConfetti = React.lazy(() => import("react-confetti"));

type DescuentoAPI = "10%" | "20%" | "40%" | "50%" | "75%" | "envio_gratis";
type DescuentoUI = "10%" | "20%" | "50%" | "75%" | "Envío gratis";
const DESCUENTOS_UI: DescuentoUI[] = ["10%", "20%", "50%", "75%", "Envío gratis"];

function uiToApi(d: DescuentoUI): DescuentoAPI {
  if (d === "Envío gratis") return "envio_gratis";
  // @ts-expect-error
  return d;
}

async function fetchCosts(): Promise<Record<DescuentoUI, number>> {
  let token: string | null = null;
  try {
    const auth = getAuth();
    token = (await auth.currentUser?.getIdToken()) || null;
  } catch {}
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch("/api/coupons?action=costs", { method: "GET", headers, credentials: "include" });
  if (!res.ok) throw new Error("No se pudieron obtener los costos.");
  const { costPerDiscount } = (await res.json()) as { costPerDiscount: Partial<Record<DescuentoAPI, number>> };
  return {
    "10%": Number(costPerDiscount["10%"] ?? 0),
    "20%": Number(costPerDiscount["20%"] ?? 0),
    "50%": Number(costPerDiscount["50%"] ?? 0),
    "75%": Number(costPerDiscount["75%"] ?? 0),
    "Envío gratis": Number(costPerDiscount["envio_gratis"] ?? 0),
  };
}

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
        "relative w-full h-32 sm:h-40 rounded-2xl", // más bajas en mobile
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
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{label}</span>
        <span className="text-[11px] sm:text-xs text-neutral-400">
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
    "50%": 0,
    "75%": 0,
    "Envío gratis": 0,
  });
  const [loadingCosts, setLoadingCosts] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        setCostos(await fetchCosts());
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
      const res = await claimCoupon({ descuento: uiToApi(descuentoUi) as any });
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
        setMensaje("No se pudo reclamar el cupón en este momento. Probá más tarde.");
        return;
      }
      if (typeof newPoints === "number") setPuntosUI(newPoints);
      const resolvedCost = Number.isFinite(costFromServer) ? costFromServer : (costos[descuentoUi] ?? 0);
      setCodigoObtenido(codigo);
      setMensaje(`¡Listo! Canjeaste un cupón ${descuentoUi} por ${resolvedCost} puntos.`);
    } catch (err: any) {
      setMensaje(err?.message ?? "No se pudo reclamar el cupón.");
    } finally {
      setClaiming(null);
    }
  };

  // 🎉 Confetti con más piezas en mobile
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
      clearTimeout(tIn); clearTimeout(tOutStart); clearTimeout(tOutEnd);
    };
  }, [codigoObtenido]);

  const isMobile = width > 0 && width < 768;
  const pieces = isMobile ? 900 : 400;
  const canvasWidth = isMobile ? Math.round(width * 1.2) : width;
  const canvasHeight = isMobile ? Math.round(height * 1.2) : height;

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
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6">
      {showConfetti && width > 0 && height > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{ opacity: confettiVisible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
        >
          <React.Suspense fallback={null}>
            <LazyConfetti width={canvasWidth} height={canvasHeight} numberOfPieces={pieces} recycle={false} gravity={isMobile ? 0.27 : 0.22} wind={0} />
          </React.Suspense>
        </div>
      )}

      <div className="max-w-3xl mx-auto bg-neutral-900 rounded-2xl border border-white/10 p-4 sm:p-6">
        {/* Header usuario — mobile apilado, desktop lado a lado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          {/* Datos */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user.profilePicture && (
              <img
                src={user.profilePicture}
                alt="Avatar"
                className="h-24 w-24 sm:h-28 sm:w-28 md:h-24 md:w-24 rounded-2xl border border-white/20 object-cover" // ⬅️ cuadrado en mobile
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-[26px] md:text-2xl font-bold leading-tight break-words">
                {user.nombre} {user.apellido}
              </h1>
              <p className="text-neutral-300 text-base sm:text-lg break-words">{user.email}</p>
              <p className="text-xs text-neutral-500 mt-1">ID de socio: {user.id}</p>
            </div>
          </div>

          {/* Puntos: desktop a la derecha; mobile centrado debajo */}
          <div className="md:self-auto self-stretch">
            <div
              className={[
                // mobile: centrado, más ancho que alto
                "md:hidden mx-auto mt-3",
                "bg-neutral-800/60 border border-white/10 rounded-xl",
                "px-6 py-2",
                "w-fit max-w-full text-center",
              ].join(" ")}
            >
              <div className="text-[11px] uppercase tracking-wide text-neutral-400">Tus puntos</div>
              <div className="font-mono font-black text-4xl text-emerald-400 leading-none">{puntosUI ?? 0}</div>
            </div>

            <div
              className={[
                // desktop
                "hidden md:block bg-neutral-800/60 border border-white/10 rounded-2xl px-5 py-3 text-right",
              ].join(" ")}
            >
              <div className="text-[11px] uppercase tracking-wide text-neutral-400">Tus puntos</div>
              <div className="font-mono font-black text-5xl text-emerald-400 leading-none">{puntosUI ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="mt-6 sm:mt-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Reclamar cupón</h2>
          {loadingCosts && <p className="text-xs text-neutral-400 mb-2">Cargando costos…</p>}
        </div>

        {/* Grid cupones — mobile 2 columnas, desktop 3 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {DESCUENTOS_UI.map((d) => {
            const cost = costos[d];
            const costKnown = Number.isFinite(cost);
            const falta = Math.max(0, (cost ?? 0) - (puntosUI ?? 0));
            const notEnough = costKnown && falta > 0;
            const disabled = !!claiming || loadingCosts || !costKnown || notEnough;

            return (
              <CouponCard
                key={d}
                label={d}
                cost={costKnown ? (cost as number) : undefined}
                loading={claiming === d}
                disabled={disabled}
                reason={!costKnown ? "Cargando costo…" : notEnough ? `Te faltan ${falta} pts` : null}
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
{/* Botones de acción */}
<div className="mt-8 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
  <a
    href="/"
    className="px-5 py-2 rounded-xl border border-white text-white text-sm sm:text-base font-medium text-center hover:bg-white/10 transition"
  >
    Inicio
  </a>
  <a
    href="https://menu.vangoghburger.com.ar/"
    target="_blank"
    rel="noopener noreferrer"
    className="px-5 py-2 rounded-xl border border-white text-white text-sm sm:text-base font-medium text-center hover:bg-white/10 transition"
  >
    Hacer pedido
  </a>
  <button
    onClick={logout}
    className="px-5 py-2 rounded-xl border border-white text-white text-sm sm:text-base font-medium text-center hover:bg-white/10 transition"
  >
    Cerrar sesión
  </button>
</div>

        {/* Footer */}
<footer className="mt-12 pt-10 pb-8 border-t border-white/10 bg-gradient-to-b from-neutral-900/60 via-neutral-900/40 to-neutral-950">
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
    <a
      className="hover:underline text-neutral-300 px-4 py-2 border border-neutral-500/60 rounded-lg transition"
      href="mailto:hola@vangoghburger.com.ar"
    >
      Escribinos
    </a>
    <a
      className="hover:underline text-neutral-300 px-4 py-2 border border-neutral-500/60 rounded-lg transition"
      href="https://maps.google.com/?q=Van+Gogh+Burger"
      target="_blank"
      rel="noreferrer"
    >
      Ubicación
    </a>
    <a
      className="hover:underline text-neutral-300 px-4 py-2 border border-neutral-500/60 rounded-lg transition"
      href="/nosotros"
    >
      Nosotros
    </a>
    <a
      className="hover:underline text-neutral-300 px-4 py-2 border border-neutral-500/60 rounded-lg transition"
      href="/mas-informacion"
    >
      Más información
    </a>
  </div>
  <p className="mt-6 text-center text-xs text-neutral-500">
    © {new Date().getFullYear()} Club Van Gogh | 14 e/ 54 y 55 - La Plata
  </p>
</footer>

      </div>

      {/* Botón flotante de WhatsApp */}
      <a
        href="https://wa.me/5492215319464?text=Buenas,%20vengo%20de%20ClubVangogh"
        target="_blank"
        rel="noreferrer"
        aria-label="Escribir por WhatsApp"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 px-4 py-3 rounded-full font-medium shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/20"
        style={{ backgroundColor: "#25D366" }}
      >
        {/* ícono WhatsApp simple en SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-5 w-5 fill-current">
          <path d="M19.11 17.44c-.27-.14-1.59-.78-1.83-.87-.24-.09-.42-.14-.6.14-.18.27-.69.87-.84 1.05-.15.18-.31.2-.58.07-.27-.14-1.13-.41-2.15-1.31-.79-.7-1.32-1.57-1.48-1.84-.15-.27-.02-.42.11-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.6-1.45-.82-1.99-.22-.53-.45-.46-.6-.46-.15 0-.33-.02-.51-.02s-.47.07-.72.34c-.25.27-.95.93-.95 2.27s.98 2.63 1.11 2.81c.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.57.65.21 1.24.18 1.7.11.52-.08 1.59-.65 1.82-1.28.22-.63.22-1.17.15-1.28-.07-.11-.25-.18-.52-.32zM16.02 5C10.5 5 6 9.5 6 15.02c0 1.78.47 3.45 1.3 4.89L6 27l7.22-1.89c1.4.77 3 .12 2.8.2 5.54 0 10.03-4.49 10.03-10.02C26.05 9.5 21.56 5 16.02 5z" />
        </svg>
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
