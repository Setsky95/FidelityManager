import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/public/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      // redirigí donde quieras:
      setLocation("/"); // o "/panel" si tenés dashboard
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-900 p-6 text-white">
      <Link href="/"><img src="https://imgfz.com/i/LJal3wE.png" alt="logo-clubvg" /></Link>
      <div className="w-full max-w-md bg-neutral-800 rounded-2xl p-6">
        <h1 className="text-2xl font-semibold mb-1">Ingresar</h1>
        <p className="text-neutral-300 mb-3">Accedé a tu cuenta</p>

        {error && (
          <div className="mb-3 rounded-lg bg-red-900/30 border border-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu@email.com" autoComplete="email" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </Form>

        <p className="mt-4 text-xs text-neutral-400">
          ¿No tenés cuenta?{" "}
          <Link href="/Sumate" className="text-primary underline underline-offset-2">
            Sumate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
