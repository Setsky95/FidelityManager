import { useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import type { Member } from "@shared/schema";

type QuickAddPointsProps = {
  members: Member[];
  onAddPoints?: (memberId: string, amount: number) => Promise<void> | void;
  isSubmitting?: boolean;
};

export function QuickAddPoints({
  members,
  onAddPoints,
  isSubmitting,
}: QuickAddPointsProps) {
  const safeMembers = Array.isArray(members) ? members : [];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addPointsMutation = useMutation({
    mutationFn: async ({
      id,
      delta,
      reason,
    }: {
      id: string;
      delta: number;
      reason?: string;
    }) => {
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
    if (!q) return safeMembers.slice(0, 6);
    return safeMembers
      .filter((m) => {
        const idStr = String(m.id).toLowerCase();
        const full = `${m.nombre} ${m.apellido}`.toLowerCase();
        return idStr.includes(q) || full.includes(q) || m.email.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [safeMembers, query]);

  const selected = useMemo(
    () => safeMembers.find((m) => String(m.id) === selectedId) || null,
    [safeMembers, selectedId]
  );

  const handlePick = useCallback((id: string | number) => {
    setSelectedId(String(id));
    setQuery("");
  }, []);

  const handleClear = useCallback(() => {
    setSelectedId("");
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleAdd = useCallback(async () => {
    if (!selected || amount <= 0 || pending) return;

    const delta = Number.isFinite(amount) ? amount : 1;

    if (onAddPoints) {
      await onAddPoints(String(selected.id), delta);
    } else {
      await addPointsMutation.mutateAsync({
        id: String(selected.id),
        delta,
        reason: "Carga rápida",
      });
    }

    setAmount(1);
    setSelectedId("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [selected, amount, pending, onAddPoints, addPointsMutation]);

  const handleAmountChange = (v: string) => {
    const n = parseInt(v, 10);
    setAmount(Number.isFinite(n) && n > 0 ? n : 1);
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!selected && results.length > 0) {
        handlePick(results[0].id);
      } else {
        handleAdd();
      }
    }
    if (e.key === "Escape") {
      if (query) setQuery("");
      else if (selectedId) handleClear();
    }
  };

  return (
    <Card className="border border-gray-200 mb-6">
      <CardContent className="p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Sumar Puntos
        </h3>

        {/* Buscador | cantidad | botón */}
        <div className="grid gap-3 items-center md:grid-cols-[minmax(0,1fr)_140px_180px]">
          {/* Buscador + resultados */}
          <div className="relative">
            <div className="relative">
              <Input
                ref={inputRef}
                placeholder="Buscar por ID, nombre o email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9 h-10"
                data-testid="quickadd-search"
                autoComplete="off"
              />
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {query && results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-auto max-h-64">
                {results.map((m) => (
                  <button
                    key={String(m.id)}
                    type="button"
                    onClick={() => handlePick(m.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    data-testid={`quickadd-result-${m.id}`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {m.nombre} {m.apellido}{" "}
                      <span className="text-gray-400">· {String(m.id)}</span>
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
              onChange={(e) => handleAmountChange(e.target.value)}
              className="h-10 text-right"
              data-testid="quickadd-amount"
              inputMode="numeric"
              pattern="[0-9]*"
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
              <span className="text-gray-400">({String(selected.id)})</span> —{" "}
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
