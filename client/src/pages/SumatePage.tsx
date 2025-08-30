import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicRegisterSchema, type PublicRegister } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const LOADING_GIF = "http://imgfz.com/i/SzWgZeK.gif";

export default function SumatePage() {
  const [success, setSuccess] = React.useState<{ id: string; nombre: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { new Image().src = LOADING_GIF; }, []);

  const form = useForm<PublicRegister>({
    resolver: zodResolver(publicRegisterSchema),
    defaultValues: { nombre: "", apellido: "", email: "", password: "" }, // 👈 incluye password
    mode: "onChange",
  });

  const onSubmit = async (data: PublicRegister) => {
    setLoading(true); setSuccess(null);
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), // 👈 ahora viaja password
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSuccess({ id: json.member.id, nombre: json.member.nombre });
      form.reset({ nombre: "", apellido: "", email: "", password: "" });
    } catch (e: any) {
      alert(e?.message ?? "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-900 p-6 text-white">
      <Link to="/"><img src="https://imgfz.com/i/LJal3wE.png" alt="logo-clubvg" /></Link>
      <div className="w-full max-w-md bg-neutral-800 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-1">Sumate al Club Van Gogh</h1>
        <p className="text-neutral-300 mb-3">Empezá a obtener puntos y beneficios</p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <img src={LOADING_GIF} alt="Registrando…" className="w-44 h-44 object-contain" />
            <p className="mt-3 text-neutral-300">Registrando…</p>
          </div>
        ) : success ? (
          <div className="rounded-lg bg-emerald-900/30 border border-emerald-700 p-4">
            ¡Listo, {success.nombre}! Tu ID es <span className="font-mono">{success.id}</span>.
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input {...field} placeholder="Sebastián" autoComplete="given-name" disabled={loading} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apellido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl><Input {...field} placeholder="Pavlotsky" autoComplete="family-name" disabled={loading} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} placeholder="socio@email.com" autoComplete="email" disabled={loading} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* 👇 NUEVO: Contraseña */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading} className="w-full">
                Registrarme
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
