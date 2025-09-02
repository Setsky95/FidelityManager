import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Gift,
  Star,
  Shield,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export type BenefitItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

export interface ClubBenefitsSectionProps
  extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  items?: BenefitItem[];
}

/**
 * Sección de beneficios/branding para el registro al Club Van Gogh.
 * - 100% estilada con Tailwind
 * - Acepta `className` para ajustar paddings/márgenes externos
 * - Podés sobrescribir `title`, `subtitle` e `items`
 */
export default function ClubBenefitsSection({
  className,
  title = (
    <>
      Sumate al <span className="text-emerald-400">Club Van Gogh</span>
    </>
  ),
  subtitle = (
    <>
      Empezá a sumar puntos y desbloqueá beneficios exclusivos cada vez que nos
      visitás.
    </>
  ),
  items = [
    {
      icon: Gift,
      title: "Regalos y promos",
      desc: "Bonos de bienvenida y sorpresas mensuales.",
    },
    {
      icon: Star,
      title: "Niveles",
      desc: "Subí de nivel y multiplicá tus puntos.",
    },
    {
      icon: Shield,
      title: "Seguro y privado",
      desc: "Tus datos protegidos con cifrado.",
    },
    {
      icon: CheckCircle2,
      title: "Sin vueltas",
      desc: "Registrate en menos de 1 minuto.",
    },
  ],
  ...props
}: ClubBenefitsSectionProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10",
        "bg-gradient-to-br from-[#0e0e0e] via-[#151515] to-[#1c1c1c]",
        "p-6 lg:p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
        className
      )}
      {...props}
    >
      {/* halos decorativos */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-neutral-300 max-w-prose">{subtitle}</p>

      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-2xl border border-white/10 p-4"
          >
            <b.icon className="h-6 w-6" aria-hidden />
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-sm text-neutral-400">{b.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <img
          src="/img/burger-home.webp"
          alt="burger"
          className="w-full max-w-md mx-auto rounded-2xl object-cover shadow-lg"
        />
      </div>
    </section>
  );
}
