// client/src/pages/HomePage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  React.useEffect(() => { document.title = "Club Van Gogh — Inicio"; }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Hero */}
      <header className="relative overflow-hidden">
        {/* fondo sutil */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/60 via-neutral-900/40 to-neutral-950" />
        <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-20 bg-indigo-600" />
        <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-20 bg-fuchsia-600" />

        <div className="relative mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="flex flex-col items-center text-center gap-6">
            <img
              src="https://imgfz.com/i/LJal3wE.png"
              alt="Club Van Gogh"
              className="w-40 h-auto drop-shadow md:w-48"
              loading="eager"
            />
            <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
              Sumá puntos. Canjeá beneficios.
            </h1>
            <p className="text-neutral-300 max-w-2xl">
              Unite gratis al <strong>Club Van Gogh</strong> y empezá a acumular puntos
              con cada compra para canjear por experiencias y premios.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild size="lg" className="gap-2">
                <Link to="/Sumate">
                  Unirme <ArrowRight className="h-4 w-4" />
                </Link>
               
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 text-black ">
                {/* Cambiá el destino si tenés login: to="/login" */}
                <Link to="/login">
                  Ingresar <LogIn className="h-4 w-4 " />
                </Link>
              </Button>
            </div>

            {/* mini features */}
            <ul className="mt-6 grid gap-2 text-sm text-neutral-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                sumate en menos de 1 minuto
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Obtené beneficios exclusivos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
               Es 100% gratis
              </li>
            </ul>
          </div>
        </div>
      </header>

      {/* Footer chiquito */}
      <footer className="py-8 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Club Van Gogh — Todos los derechos reservados 

          <Link to="/dashboard">
                  -  admin 
                </Link>
      </footer>
    </div>
  );
}
