import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FirebaseService } from "@/lib/firebase";
import type { Movement, MovementType } from "@shared/schema";
import { BurgerMenu } from "@/components/burgerMenu.jsx";

const TYPE_OPTIONS: { value: "all" | MovementType; label: string }[] = [
  { value: "all",            label: "Todos los eventos" },
  { value: "create",         label: "Nuevos usuarios" },
  { value: "delete",         label: "Usuarios borrados" },
  { value: "points_add",     label: "Suba de puntos" },
  { value: "points_subtract",label: "Baja de puntos" },
  { value: "points_set",     label: "Ajuste de puntos" },
];

export default function Reports() {
  const [typeFilter, setTypeFilter] = useState<"all" | MovementType>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/movements", typeFilter],
    queryFn: () =>
      FirebaseService.getMovements({
        limit: 200,
        type: typeFilter === "all" ? undefined : typeFilter,
      }),
  });

  const movements = useMemo<Movement[]>(() => (data ?? []) as Movement[], [data]);
  const fmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-gray-200">
        
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="reports-navbar flex items-center justify-between">
                                <BurgerMenu />
          <h2 className="text-2xl font-semibold text-gray-900">Reportes</h2>

          </div>

          <div className="flex items-center gap-3">
            {/* Filtro por tipo */}
            <select
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              data-testid="select-filter-type"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Refrescar */}
            <Button onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-movements">
              {isFetching ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="p-6 space-y-6">
          <Card className="border border-gray-200">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-gray-500">Cargando movimientos…</div>
              ) : movements.length === 0 ? (
                <div className="p-6 text-gray-500">No hay movimientos para el filtro seleccionado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Fecha</Th>
                        <Th>Socio</Th>
                        <Th>Email</Th>
                        <Th>Tipo</Th>
                        <Th className="text-right">Δ Puntos</Th>
                        <Th className="text-right">Antes → Después</Th>
                        <Th>Motivo</Th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {movements.map((m) => {
                        const delta = Number(m?.delta ?? 0);
                        const prev = Number(m?.previousPoints ?? 0);
                        const next = Number(m?.newPoints ?? 0);

                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <Td>{fmt.format(m.createdAt)}</Td>
                            <Td>
                              <div className="text-sm font-medium text-gray-900">
                                {m.memberName || "—"}
                              </div>
                              <div className="text-xs text-gray-500">{m.memberId}</div>
                            </Td>
                            <Td className="text-sm text-gray-700">{m.email || "—"}</Td>
                            <Td>
                              <span className={`text-xs px-2 py-1 rounded ${badgeClass(m.type)}`}>
                                {labelType(m.type)}
                              </span>
                            </Td>
                            <Td className={`text-right font-medium ${deltaClass(delta)}`}>
                              {delta > 0 ? `+${delta}` : delta}
                            </Td>
                            <Td className="text-right text-sm text-gray-700">
                              {prev} → <span className="font-semibold">{next}</span>
                            </Td>
                            <Td className="text-sm text-gray-700 truncate max-w-[240px]">
                              {m.reason || "—"}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Th({ children, className = "" }: any) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: any) {
  return <td className={`px-6 py-3 whitespace-nowrap align-middle ${className}`}>{children}</td>;
}

/* Etiquetas en español */
function labelType(t?: MovementType) {
  switch (t) {
    case "create":          return "Alta de socio";
    case "delete":          return "Baja de socio";
    case "points_add":      return "Suma de puntos";
    case "points_subtract": return "Resta de puntos";
    case "points_set":      return "Ajuste de puntos";
    default:                return "—";
  }
}

/* Colores por tipo */
function badgeClass(t?: MovementType) {
  switch (t) {
    case "create":
    case "points_add":
      return "bg-green-100 text-green-700";
    case "delete":
    case "points_subtract":
      return "bg-red-100 text-red-700";
    case "points_set":
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/* Color del Δ */
function deltaClass(delta: number) {
  if (delta > 0) return "text-green-600";
  if (delta < 0) return "text-red-600";
  return "text-gray-600";
}
