// src/components/burgerCarrousel.jsx
import React from "react";

/** Hook para detectar desktop por ancho */
function useIsDesktop(bp = 768) {
  const [is, setIs] = React.useState(
    typeof window !== "undefined" ? window.innerWidth >= bp : false
  );
  React.useEffect(() => {
    const onR = () => setIs(window.innerWidth >= bp);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [bp]);
  return is;
}

/**
 * Carrusel infinito (autoscroll + drag/scroll nativo)
 * - Mobile: horizontal
 * - Desktop: vertical
 * - Imágenes locales desde /public/burger-carrousel/
 *
 * Props:
 * - images?: string[] (paths relativos a /public, default: 1.webp..6.webp)
 * - promos?: string[] (mensajes a rotar)
 * - speed?: number (px/frame, default 0.35 ≈ 21px/s)
 * - gap?: number (espacio entre imágenes en px)
 * - className?: string clases extra para contenedor
 */
export default function BurgerCarousel({
  images,
  promos = ["50% de descuento", "30% de descuento", "Va de regalo", "Envío gratis"],
  speed = 0.35,
  gap = 16,
  className = "",
}) {
  // Si no pasan imágenes, usamos las del directorio público
  const FALLBACK = React.useMemo(
    () => Array.from({ length: 6 }, (_, i) => `/burger-carrousel/${i + 1}.webp`),
    []
  );
  const imgs = images && images.length ? images : FALLBACK;

  const isDesktop = useIsDesktop();
  const contRef = React.useRef(null);
  const unitRef = React.useRef(null);
  const [auto, setAuto] = React.useState(true);
  const [promoIdx, setPromoIdx] = React.useState(0);
  const [showPromo, setShowPromo] = React.useState(true);

  // Autoscroll + wrap infinito
  React.useEffect(() => {
    const el = contRef.current;
    const unit = unitRef.current;
    if (!el || !unit) return;

    const vertical = isDesktop;
    const getPos = () => (vertical ? el.scrollTop : el.scrollLeft);
    const setPos = (v) => (vertical ? (el.scrollTop = v) : (el.scrollLeft = v));
    const unitSize = vertical ? unit.offsetHeight : unit.offsetWidth;

    let raf;
    const tick = () => {
      if (auto) {
        const next = getPos() + speed;
        setPos(next);
        if (next >= unitSize) setPos(next - unitSize); // wrap al pasar 1 bloque
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Pausar al interactuar, reanudar al soltar/salir
    const stop = () => setAuto(false);
    const resume = () => setAuto(true);
    el.addEventListener("pointerdown", stop);
    el.addEventListener("pointerup", resume);
    el.addEventListener("pointercancel", resume);
    el.addEventListener("mouseenter", stop);
    el.addEventListener("mouseleave", resume);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("pointercancel", resume);
      el.removeEventListener("mouseenter", stop);
      el.removeEventListener("mouseleave", resume);
    };
  }, [auto, isDesktop, speed, imgs.length]);

  // Rotación de promos (cada ~2.2s)
  React.useEffect(() => {
    const id = setInterval(() => {
      setPromoIdx((i) => (i + 1) % promos.length);
      setShowPromo(true);
      setTimeout(() => setShowPromo(false), 1200);
    }, 2200);
    return () => clearInterval(id);
  }, [promos.length]);

  return (
    <div className={`relative ${className}`}>
      {/* Contenedor scrollable SIN marco (ocupa el flujo) */}
      <div
        ref={contRef}
        className={[
          "overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none",
          isDesktop ? "max-h-[520px]" : "w-full",
        ].join(" ")}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Triplicamos el set para suavizar el wrap */}
        <div className={isDesktop ? "flex flex-col" : "flex flex-row"} style={{ gap }}>
          {/* bloque referencia (para medir tamaño de wrap) */}
          <div
            ref={unitRef}
            className={isDesktop ? "flex flex-col" : "flex flex-row"}
            style={{ gap }}
          >
            {imgs.map((src, i) => (
              <figure key={`a-${i}`} className="m-0 flex-shrink-0 grid place-items-center">
                <img
                  src={src}
                  alt={`burger ${i + 1}`}
                  className={isDesktop ? "max-h-64 w-auto object-contain" : "h-48 w-auto object-contain"}
                  draggable={false}
                  loading="lazy"
                />
              </figure>
            ))}
          </div>

          {/* segundo set */}
          <div className={isDesktop ? "flex flex-col" : "flex flex-row"} style={{ gap }}>
            {imgs.map((src, i) => (
              <figure key={`b-${i}`} className="m-0 flex-shrink-0 grid place-items-center">
                <img
                  src={src}
                  alt={`burger ${i + 1}`}
                  className={isDesktop ? "max-h-64 w-auto object-contain" : "h-48 w-auto object-contain"}
                  draggable={false}
                  loading="lazy"
                />
              </figure>
            ))}
          </div>

          {/* tercer set */}
          <div className={isDesktop ? "flex flex-col" : "flex flex-row"} style={{ gap }}>
            {imgs.map((src, i) => (
              <figure key={`c-${i}`} className="m-0 flex-shrink-0 grid place-items-center">
                <img
                  src={src}
                  alt={`burger ${i + 1}`}
                  className={isDesktop ? "max-h-64 w-auto object-contain" : "h-48 w-auto object-contain"}
                  draggable={false}
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay de promos (aparece/desaparece) */}
      <div
        className={[
          "pointer-events-none absolute left-1/2 -translate-x-1/2",
          isDesktop ? "bottom-4" : "bottom-3",
          "px-4 py-2 rounded-xl border border-white/20 bg-black/30 backdrop-blur",
          "text-white text-sm sm:text-base font-semibold tracking-wide",
          "transition-opacity duration-300",
          showPromo ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {promos[promoIdx]}
      </div>
    </div>
  );
}
