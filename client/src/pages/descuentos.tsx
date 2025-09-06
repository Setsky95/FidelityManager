import * as React from "react";
import { Button } from "@/components/ui/button";
import { getAuth } from "firebase/auth";

type Descuento = "10%" | "20%" | "40%";
const DESCUENTOS: Descuento[] = ["10%", "20%", "40%"];

export default function DescuentosPage() {
  // --- Crear cupón ---
  const [porcentaje, setPorcentaje] = React.useState<Descuento>("10%");
  const [codigo, setCodigo] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [msgCreate, setMsgCreate] = React.useState<string | null>(null);

  // --- Costos en puntos ---
  const [costos, setCostos] = React.useState<Record<Descuento, number>>({
    "10%": 0,
    "20%": 0,
    "40%": 0,
  });
  const [savingCosts, setSavingCosts] = React.useState(false);
  const [msgCosts, setMsgCosts] = React.useState<string | null>(null);
  const [loadingCosts, setLoadingCosts] = React.useState(true);

  // helper: obtiene token o tira error legible
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
        if (res.ok) {
          const data = await res.json();
          setCostos({
            "10%": Number(data?.costPerDiscount?.["10%"] ?? 0),
            "20%": Number(data?.costPerDiscount?.["20%"] ?? 0),
            "40%": Number(data?.costPerDiscount?.["40%"] ?? 0),
          });
        } else {
          const err = await res.json().catch(() => ({}));
          setMsgCosts(err?.error || "No se pudieron cargar los costos.");
        }
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
    <div className="min-h-screen  p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Descuentos</h1>
          <p className="text-sm ">
            Administrá cupones y el costo en puntos.
          </p>
        </header>

        {/* Crear cupón */}
        <section className=" rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold mb-4">Crear cupón</h2>

          <form onSubmit={createCoupon} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Descuento</label>
              <select
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value as Descuento)}
                className="w-full rounded-lg  border border-white/10 px-3 py-2"
              >
                {DESCUENTOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm  mb-1">Código de cupón</label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="VG-10-ABCD1234"
                className="w-full rounded-lg  border border-white/10 px-3 py-2"
              />
            </div>

            <div className="sm:col-span-3">
              <Button type="submit" disabled={creating}>
                {creating ? "Creando…" : "Crear cupón"}
              </Button>
            </div>
          </form>

          {msgCreate && <p className="mt-3 text-sm ">{msgCreate}</p>}

       
        </section>

        {/* Costos en puntos */}
        <section className=" rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Costo en puntos por descuento</h2>
            {loadingCosts && (
              <span className="text-xs ">Cargando…</span>
            )}
          </div>

          <form onSubmit={saveCosts} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DESCUENTOS.map((d) => (
              <div key={d}>
                <label className="block text-sm  mb-1">{d}</label>
                <input
                  type="number"
                  min={0}
                  value={costos[d] ?? 0}
                  onChange={(e) =>
                    setCostos((prev) => ({
                      ...prev,
                      [d]: Math.max(0, Number(e.target.value || 0)),
                    }))
                  }
                  className="w-full rounded-lg  border border-white/10 px-3 py-2"
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
