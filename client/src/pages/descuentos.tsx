import * as React from "react";
import { Button } from "@/components/ui/button";
import { getAuth } from "firebase/auth";

// Valores que entiende el backend:
type Descuento =
  | "10%"
  | "20%"
  | "40%"
  | "50%"
  | "75%"
  | "envio_gratis";

// Mapeo value (API) -> label (UI)
const DESCUENTOS: { value: Descuento; label: string }[] = [
  { value: "10%", label: "10%" },
  { value: "20%", label: "20%" },
  { value: "40%", label: "40%" },
  { value: "50%", label: "50%" },
  { value: "75%", label: "75%" },
  { value: "envio_gratis", label: "Envío gratis" },
];

export default function DescuentosPage() {
  // --- Crear cupón ---
  const [porcentaje, setPorcentaje] = React.useState<Descuento>("10%");
  const [codigo, setCodigo] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [msgCreate, setMsgCreate] = React.useState<string | null>(null);

  // --- Costos en puntos (keys = values que entiende la API) ---
  const [costos, setCostos] = React.useState<Record<Descuento, number>>({
    "10%": 0,
    "20%": 0,
    "40%": 0,
    "50%": 0,
    "75%": 0,
    "envio_gratis": 0,
  });
  const [savingCosts, setSavingCosts] = React.useState(false);
  const [msgCosts, setMsgCosts] = React.useState<string | null>(null);
  const [loadingCosts, setLoadingCosts] = React.useState(true);

  const getIdTokenOrThrow = React.useCallback(async () => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Debés iniciar sesión como administrador.");
    return token;
  }, []);

  // Cargar costos actuales al montar
  React.useEffect(() => {
    (async () => {
      try {
        const token = await getIdTokenOrThrow();
        const res = await fetch("/api/coupons?action=costs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "No se pudieron cargar los costos.");
        }
        const data = await res.json();
        const src = data?.costPerDiscount || {};
        setCostos({
          "10%": Number(src["10%"] ?? 0),
          "20%": Number(src["20%"] ?? 0),
          "40%": Number(src["40%"] ?? 0),
          "50%": Number(src["50%"] ?? 0),
          "75%": Number(src["75%"] ?? 0),
          "envio_gratis": Number(src["envio_gratis"] ?? 0),
        });
      } catch (e: any) {
        setMsgCosts(e?.message || "No se pudieron cargar los costos.");
      } finally {
        setLoadingCosts(false);
      }
    })();
  }, [getIdTokenOrThrow]);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgCreate(null);

    if (!codigo.trim()) {
      setMsgCreate("Ingresá un código de cupón.");
      return;
    }

    setCreating(true);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Enviamos el value (API), no el label
        body: JSON.stringify({ action: "create", descuento: porcentaje, codigo }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo crear el cupón.");
      }

      setCodigo("");
      setMsgCreate("✅ Cupón creado como disponible.");
    } catch (err: any) {
      setMsgCreate(err?.message ?? "Error creando el cupón.");
    } finally {
      setCreating(false);
    }
  };

  const saveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgCosts(null);
    setSavingCosts(true);

    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Mandamos un objeto con las claves EXACTAS que entiende la API
        body: JSON.stringify({ action: "save_costs", costPerDiscount: costos }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "No se pudo guardar los costos.");
      }

      setMsgCosts("💾 Costos guardados.");
    } catch (err: any) {
      setMsgCosts(err?.message ?? "Error guardando los costos.");
    } finally {
      setSavingCosts(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Descuentos</h1>
          <p className="text-sm">Administrá cupones y el costo en puntos.</p>
        </header>

        {/* Crear cupón */}
        <section className="rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold mb-4">Crear cupón</h2>

          <form onSubmit={createCoupon} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Descuento</label>
              <select
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value as Descuento)}
                className="w-full rounded-lg border border-white/10 px-3 py-2"
              >
                {DESCUENTOS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Código de cupón</label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="ABC123 o cualquier combinación"
                className="w-full rounded-lg border border-white/10 px-3 py-2"
              />
            </div>

            <div className="sm:col-span-3">
              <Button type="submit" disabled={creating}>
                {creating ? "Creando…" : "Crear cupón"}
              </Button>
            </div>
          </form>

          {msgCreate && <p className="mt-3 text-sm">{msgCreate}</p>}
        </section>

        {/* Costos en puntos */}
        <section className="rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Costo en puntos por descuento</h2>
            {loadingCosts && <span className="text-xs">Cargando…</span>}
          </div>

          <form onSubmit={saveCosts} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DESCUENTOS.map((d) => (
              <div key={d.value}>
                <label className="block text-sm mb-1">{d.label}</label>
                <input
                  type="number"
                  min={0}
                  value={costos[d.value] ?? 0}
                  onChange={(e) =>
                    setCostos((prev) => ({
                      ...prev,
                      [d.value]: Math.max(0, Number(e.target.value || 0)),
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 px-3 py-2"
                />
              </div>
            ))}

            <div className="sm:col-span-3">
              <Button type="submit" disabled={savingCosts}>
                {savingCosts ? "Guardando…" : "Guardar costos"}
              </Button>
            </div>
          </form>

          {msgCosts && <p className="mt-3 text-sm">{msgCosts}</p>}
        </section>
      </div>
    </div>
  );
}
