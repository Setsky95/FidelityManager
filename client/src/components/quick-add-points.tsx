import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import type { Member } from "@shared/schema";

type QuickAddPointsProps = {
  members: Member[];
  /** Si lo pasás, se usa en vez del fetch al backend */
  onAddPoints?: (memberId: string, amount: number) => Promise<void> | void;
  /** Forzás estado de envío desde afuera (opcional) */
  isSubmitting?: boolean;
};

export function QuickAddPoints({
  members,
  onAddPoints,
  isSubmitting,
}: QuickAddPointsProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutación por defecto -> POST /api/members/points
  const addPointsMutation = useMutation({
    mutationFn: async ({ id, delta, reason }: { id: string; delta: number; reason?: string }) => {
      const res = await fetch("/api/members/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, delta, reason }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      return json;
    },
    onSuccess: () => {
      // refrescamos listas / stats
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Puntos agregados. Si correspondía, se envió el email al socio.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const pending = isSubmitting ?? addPointsMutation.isPending;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 6);
    return members
      .filter((m) => {
        const full = `${m.nombre} ${m.apellido}`.toLowerCase();
        return (
          m.id.toLowerCase().includes(q) ||
          full.includes(q) ||
          m.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [members, query]);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId]
  );

  const handlePick = (id: string) => {
    setSelectedId(id);
    setQuery("");
  };

  const handleClear = () => {
    setSelectedId("");
    setQuery("");
    inputRef.current?.focus();
  };

  const handleAdd = async () => {
    if (!selected || amount <= 0 || pending) return;

    if (onAddPoints) {
      // modo “legacy/custom”
      await onAddPoints(selected.id, amount);
    } else {
      // nuevo flujo: pega al backend y dispara email
      await addPointsMutation.mutateAsync({
        id: selected.id,
        delta: amount,
        reason: "Carga rápida",
      });
    }

    setAmount(1);
  };

  return (
    <Card className="border border-gray-200 mb-6">
      <CardContent className="p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Sumar Puntos
        </h3>

        {/* Fila: buscador | cantidad | botón */}
        <div className="grid gap-3 items-center md:grid-cols-[minmax(0,1fr)_140px_180px]">
          {/* Buscador + resultados */}
          <div className="relative">
            <div className="relative">
              <Input
                ref={inputRef}
                placeholder="Buscar por ID, nombre o email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-10"
                data-testid="quickadd-search"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {query && results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handlePick(m.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    data-testid={`quickadd-result-${m.id}`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {m.nombre} {m.apellido}{" "}
                      <span className="text-gray-400">· {m.id}</span>
                    </div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div className="flex flex-col">
            <Input
              id="quickadd-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))
              }
              className="h-10 text-right"
              data-testid="quickadd-amount"
            />
          </div>

          {/* Botón */}
          <div className="flex items-end">
            <Button
              className="w-full h-10"
              onClick={handleAdd}
              disabled={!selected || amount <= 0 || pending}
              data-testid="quickadd-submit"
            >
              <Plus className="mr-2 h-4 w-4" />
              {pending ? "Agregando..." : "Agregar Puntos"}
            </Button>
          </div>
        </div>

        {/* Seleccionado */}
        {selected && !query && (
          <div
            className="mt-2 text-sm text-gray-600 flex items-center gap-2"
            data-testid="quickadd-selected"
          >
            <div className="truncate">
              Seleccionado:{" "}
              <span className="font-medium text-gray-900">
                {selected.nombre} {selected.apellido}
              </span>{" "}
              <span className="text-gray-400">({selected.id})</span> —{" "}
              {selected.email}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2"
              aria-label="Borrar selección"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
