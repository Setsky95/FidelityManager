import * as React from "react";
import { useLocation, Link } from "wouter";
import { useSubAuth } from "@/providers/SubAuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

const IMAGES = [
  "/burger-fotos/1.webp",
  "/burger-fotos/2.webp",
  "/burger-fotos/3.webp",
  "/burger-fotos/4.webp",
  "/burger-fotos/5.webp",
  "/burger-fotos/6.webp",
];

export default function LoginPage() {
  const { login, loading, user } = useSubAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Imagen aleatoria al montar el componente
  const [selectedImage] = React.useState(
    () => IMAGES[Math.floor(Math.random() * IMAGES.length)]
  );

  React.useEffect(() => {
    if (!loading && user) navigate("/mi-cuenta");
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/mi-cuenta");
    } catch (err: any) {
      alert(err?.message || "Login inválido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white relative overflow-hidden flex items-center">
      {/* fondo sutil */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/40 via-transparent to-neutral-950" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* GRID principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
          {/* IZQUIERDA: imagen + título centrados */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex justify-center">
              <img
                src={selectedImage}
                alt="Ilustración de la marca"
                className="
                  w-[110%] max-w-[520px] h-auto object-contain
                  md:w-[150%] md:max-w-[980px]
                "
                loading="lazy"
              />
            </div>
          </div>

          {/* DERECHA: formulario */}
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md md:justify-self-end bg-neutral-900/70 backdrop-blur rounded-2xl border border-white/10 p-5 sm:p-6 shadow-xl space-y-5"
          >
            <div className="space-y-1 hidden md:block">
              <h1 className="text-2xl font-bold">Iniciá sesión</h1>
              <p className="text-neutral-300 text-sm">Usá tu email y contraseña</p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="socio@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                autoComplete="email"
                className="bg-neutral-900/70 border-white/15 text-white placeholder:text-neutral-400 focus-visible:ring-white"
              />
            </div>

            {/* Password con ojito */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm">Contraseña</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="current-password"
                  className="bg-neutral-900/70 border-white/15 text-white placeholder:text-neutral-400 focus-visible:ring-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-white transition"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Botón principal */}
            <Button
              type="submit"
              className="w-full bg-transparent border border-white text-white font-medium rounded-xl hover:bg-white/10 transition shadow-none"
              disabled={submitting}
            >
              {submitting ? "Ingresando…" : "Entrar"}
            </Button>

            {/* Registro */}
            <div className="text-sm text-neutral-400">
              ¿No tenés cuenta?{" "}
              <Link href="/sumate" className="underline hover:text-white">
                Registrate
              </Link>
            </div>
          </form>
        </div>

        <div className="flex justify-center">
          <Link href="/">
            <a className="inline-flex items-center justify-center px-4 py-2 mt-6 rounded-xl border border-white/70 text-white font-medium hover:bg-white/10 transition">
              Volver al inicio
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
