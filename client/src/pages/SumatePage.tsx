import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicRegisterSchema, type PublicRegister } from "@shared/schema";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import ClubBenefitsSection from "@/components/ClubBenefitsSection";

import { Eye, EyeOff } from "lucide-react";

const LOADING_GIF = "cargando...";

// 👇 opciones disponibles (coinciden con /Profile-Pictures)
const PROFILE_PICTURES = [
  { id: "https://imgfz.com/i/rIbPLBA.jpeg", src: "https://imgfz.com/i/rIbPLBA.jpeg", label: "1" },
  { id: "https://imgfz.com/i/k6rqewz.jpeg", src: "https://imgfz.com/i/k6rqewz.jpeg", label: "2" },
  { id: "https://imgfz.com/i/ifsrEgV.jpeg", src: "https://imgfz.com/i/ifsrEgV.jpeg", label: "3" },
  { id: "https://imgfz.com/i/mD5KnXZ.jpeg", src: "https://imgfz.com/i/mD5KnXZ.jpeg", label: "4" },
];

export default function SumatePage() {
  const [success, setSuccess] = React.useState<{ id: string; nombre: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [accepted, setAccepted] = React.useState(true);

  React.useEffect(() => {
    new Image().src = LOADING_GIF;
  }, []);

  const form = useForm<PublicRegister & { profilePicture: string }>({
    resolver: zodResolver(publicRegisterSchema as any), // ⚠️ mantener como en tu schema
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      profilePicture: PROFILE_PICTURES[0].id,
    },
    mode: "onChange",
  });

  const onSubmit = async (data: PublicRegister & { profilePicture: string }) => {
    if (!accepted) return;
    setLoading(true);
    setSuccess(null);
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const ct = res.headers.get("content-type") || "";
      let json: any = null;
      let text: string | null = null;

      if (ct.includes("application/json")) {
        try {
          json = await res.json();
        } catch {}
      }
      if (!json) {
        text = await res.text();
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}
      }

      if (!res.ok || !json?.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          (text && text.slice(0, 300)) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setSuccess({ id: json.member.id, nombre: json.member.nombre });
      form.reset({
        nombre: "",
        apellido: "",
        email: "",
        password: "",
        profilePicture: PROFILE_PICTURES[0].id,
      });
    } catch (e: any) {
      alert(e?.message ?? "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const password = form.watch("password");
  const strength = React.useMemo(() => {
    const len = password?.length || 0;
    const hasNum = /\d/.test(password || "");
    const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(password || "");
    const hasLower = /[a-záéíóúñ]/.test(password || "");
    const hasSym = /[^\w\s]/.test(password || "");
    let score = 0;
    if (len >= 8) score++;
    if (len >= 12) score++;
    if (hasNum) score++;
    if (hasUpper && hasLower) score++;
    if (hasSym) score++;
    return Math.min(score, 5);
  }, [password]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Main split layout (sin navbar) */}
      <main className="mx-auto max-w-7xl px-4 py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <ClubBenefitsSection className="order-1 lg:order-none hidden lg:block" />
        {/* Panel del formulario */}
        <section className="relative">
          <div className="rounded-3xl border border-white/10 bg-neutral-900/70 backdrop-blur p-6 lg:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            {loading && (
              <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-black/50">
                <div className="flex flex-col items-center">
                  <img src={LOADING_GIF} alt="Registrando…" className="w-28 h-28 object-contain" />
                  <span className="mt-2 text-neutral-300">Registrando…</span>
                </div>
              </div>
            )}

            {success ? (
              <div className="rounded-2xl bg-emerald-900/30 border border-emerald-700 p-6">
                <p className="text-lg">¡Listo, {success.nombre}! 🎉</p>
                <p className="mt-1 text-neutral-300">
                  Tu ID es <span className="font-mono">{success.id}</span>. Guardalo para futuras consultas.
                </p>
                <div className="mt-6">
                  <Link to="/" className="inline-flex">
                    <Button>Ir al inicio</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre */}
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Sebastián" autoComplete="given-name" disabled={loading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Apellido */}
                  <FormField
                    control={form.control}
                    name="apellido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Pavlotsky" autoComplete="family-name" disabled={loading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} placeholder="socio@email.com" autoComplete="email" disabled={loading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Contraseña */}
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                placeholder="Mínimo 8 caracteres"
                                autoComplete="new-password"
                                disabled={loading}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-neutral-400 hover:text-white"
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          {/* Barra de fuerza */}
                          <div className="mt-2 h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              style={{ width: `${(strength / 5) * 100}%` }}
                              className={cn(
                                "h-full transition-all",
                                strength <= 2 && "bg-red-500",
                                strength === 3 && "bg-yellow-500",
                                strength >= 4 && "bg-emerald-500"
                              )}
                            />
                          </div>
                          <p className="mt-1 text-xs text-neutral-400">
                            Usá al menos 8 caracteres, combinando mayúsculas, minúsculas, números y símbolos.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Foto de perfil */}
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="profilePicture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Elegí tu imagen de perfil</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                              {PROFILE_PICTURES.map((p) => {
                                const isActive = field.value === p.id;
                                return (
                                  <button
                                    type="button"
                                    key={p.id}
                                    onClick={() => field.onChange(p.id)}
                                    className={cn(
                                      "relative inline-flex items-center justify-center overflow-hidden border transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                                      "rounded-full md:rounded-2xl",
                                      isActive ? "border-emerald-500" : "border-white/10 hover:border-white/30"
                                    )}
                                    aria-pressed={isActive}
                                    aria-label={`Elegir ${p.label}`}
                                  >
                                    <img
                                      src={p.src}
                                      alt={`Profile ${p.label}`}
                                      className="h-24 w-24 md:h-28 md:w-28 object-cover"
                                      draggable={false}
                                    />
                                    {isActive && (
                                      <div className="absolute inset-0 ring-2 ring-emerald-400 rounded-full md:rounded-2xl pointer-events-none" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Términos */}
                  <div className="md:col-span-2 flex items-start gap-2 rounded-xl border border-white/10 p-2">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-emerald-500"
                    />
                    <label htmlFor="terms" className="text-xs text-neutral-300 select-none leading-4">
                      Acepto los <a className="underline" href="/terminos" target="_blank" rel="noreferrer">Términos</a> y la{" "}
                      <a className="underline" href="/privacidad" target="_blank" rel="noreferrer">Política de Privacidad</a>.
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <Button type="submit" disabled={loading || !accepted} className="w-full text-base py-6 rounded-2xl">
                      Registrarme
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </section>
      </main>

      {/* Footer simple */}
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-neutral-500">
        © {new Date().getFullYear()} Club Van Gogh — Hecho con ♥
      </footer>
    </div>
  );
}
