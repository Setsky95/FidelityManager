// client/src/pages/lists.tsx
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { useLists } from "@/hooks/use-lists";
import { useToast } from "@/hooks/use-toast";

import { FirebaseService } from "@/lib/firebase";
import type { Member } from "@/../shared/schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function ListsPage() {
  const { lists, create, remove } = useLists();
  const { toast } = useToast();

  // ====== estado de creación ======
  const [nombre, setNombre] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // ====== paginado de miembros ======
  const [pageSize, setPageSize] = useState<number>(25);
  const [members, setMembers] = useState<Member[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // carga inicial y cuando cambia el pageSize
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMembers(true);
      try {
        const { items, nextCursor } = await FirebaseService.getMembersPage({
          limit: pageSize,
          startAfterNumero: null,
        });
        if (cancelled) return;
        setMembers(items);
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
      } catch (e) {
        toast({
          title: "Error al cargar socios",
          description: (e as any)?.message ?? "",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageSize, toast]);

  const loadMore = async () => {
    if (!hasMore || loadingMembers) return;
    setLoadingMembers(true);
    try {
      const { items, nextCursor } = await FirebaseService.getMembersPage({
        limit: pageSize,
        startAfterNumero: cursor,
      });
      setMembers((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (e) {
      toast({
        title: "Error al cargar más",
        description: (e as any)?.message ?? "",
        variant: "destructive",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  //borrar lista
  const handleDelete = async (l: { id: string; nombre: string }) => {
    const ok = window.confirm(
      `¿Eliminar la lista "${l.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      await remove.mutateAsync(l.id);
      if (openListId === l.id) setOpenListId(null);
      setDetailsCache((p) => {
        const next = { ...p };
        delete next[l.id];
        return next;
      });
      toast({
        title: "Lista eliminada",
        description: `Se borró "${l.nombre}".`,
      });
    } catch (e: any) {
      toast({
        title: "No se pudo eliminar",
        description: e?.message ?? "Intentalo de nuevo",
        variant: "destructive",
      });
    }
  };

  // ====== selección & búsqueda local ======
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.nombre.toLowerCase().includes(q) ||
        m.apellido.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [search, members]);

  const toggle = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  const allSelected = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const handleCreate = async () => {
    if (!nombre.trim()) {
      toast({
        title: "Completa el nombre de la lista",
        variant: "destructive",
      });
      return;
    }
    if (allSelected.length === 0) {
      toast({ title: "Seleccioná al menos un socio", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ nombre: nombre.trim(), ids: allSelected });
      setNombre("");
      setSelected({});
      toast({
        title: "Lista creada",
        description: `Se agregaron ${allSelected.length} socios.`,
      });
    } catch (e: any) {
      toast({
        title: "Error al crear la lista",
        description: e?.message ?? "",
        variant: "destructive",
      });
    }
  };

  // ====== detalles expandibles por lista ======
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<
    Record<string, { loading: boolean; error?: string; members?: Member[] }>
  >({});

  const toggleOpen = async (listId: string, idsCsv: string) => {
    setOpenListId((prev) => (prev === listId ? null : listId));

    // si nunca cargamos, traemos los miembros
    if (!detailsCache[listId]) {
      setDetailsCache((p) => ({ ...p, [listId]: { loading: true } }));
      try {
        const ids = idsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const members = await FirebaseService.getMembersByIds(ids);
        setDetailsCache((p) => ({
          ...p,
          [listId]: { loading: false, members },
        }));
      } catch (e: any) {
        setDetailsCache((p) => ({
          ...p,
          [listId]: { loading: false, error: e?.message ?? "Error al cargar" },
        }));
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface">
      <div className="p-6 space-y-8 max-w-6xl">
        <h2 className="text-2xl font-semibold">Listas</h2>

        {/* Crear nueva lista */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1 space-y-2">
                <Label htmlFor="list-name">Nombre de la lista</Label>
                <Input
                  id="list-name"
                  placeholder="Ej: Promo Septiembre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={create.isPending}
                />
                <Button onClick={handleCreate} disabled={create.isPending}>
                  {create.isPending ? "Creando..." : "Crear lista"}
                </Button>
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Buscar por ID, nombre, apellido o email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={loadingMembers}
                    className="flex-1 min-w-[260px]"
                  />

                  <div className="flex items-center gap-2">
                    <Label htmlFor="page-size" className="text-sm">
                      Registros
                    </Label>
                    <select
                      id="page-size"
                      className="border rounded px-2 py-1 text-sm bg-background"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      disabled={loadingMembers}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="text-sm text-muted-foreground ml-auto">
                    Seleccionados: <b>{allSelected.length}</b>
                  </div>
                </div>

                <div className="max-h-72 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 w-10"></th>
                        <th className="text-left p-2">ID</th>
                        <th className="text-left p-2">Nombre</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-right p-2">Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingMembers && members.length === 0 && (
                        <tr>
                          <td className="p-3" colSpan={5}>
                            Cargando socios…
                          </td>
                        </tr>
                      )}
                      {filteredMembers.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-2">
                            <Checkbox
                              checked={!!selected[m.id]}
                              onCheckedChange={() => toggle(m.id)}
                            />
                          </td>
                          <td className="p-2 font-mono">{m.id}</td>
                          <td className="p-2">
                            {m.nombre} {m.apellido}
                          </td>
                          <td className="p-2">{m.email}</td>
                          <td className="p-2 text-right">{m.puntos}</td>
                        </tr>
                      ))}
                      {!loadingMembers &&
                        filteredMembers.length === 0 &&
                        members.length > 0 && (
                          <tr>
                            <td className="p-3" colSpan={5}>
                              Sin resultados.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Mostrando {members.length} registros
                    {hasMore ? "" : " (fin)"}
                  </div>
                  {hasMore && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMembers}
                    >
                      {loadingMembers ? "Cargando..." : "Cargar más"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listas existentes con desplegable */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="text-lg font-medium">Listas existentes</h3>
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 w-16"></th>
                    <th className="text-left p-2">Nombre</th>
                    <th className="text-left p-2">IDs</th>
                    <th className="text-right p-2">Cantidad</th>
                    <th className="text-right p-2">Borrar</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.isLoading && (
                    <tr>
                      <td className="p-3" colSpan={4}>
                        Cargando listas…
                      </td>
                    </tr>
                  )}

                  {(lists.data ?? []).map((l) => {
                    const count = l.Ids
                      ? l.Ids.split(",").filter(Boolean).length
                      : 0;
                    const isOpen = openListId === l.id;
                    const det = detailsCache[l.id];

                    return (
                      <>
                        <tr key={l.id} className="border-t">
                          <td className="p-2 align-top">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleOpen(l.id, l.Ids)}
                                className="rounded p-1 hover:bg-muted transition"
                                aria-label={isOpen ? "Cerrar" : "Ver detalles"}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    isOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="p-2 align-top">{l.nombre}</td>
                          <td className="p-2 align-top font-mono break-all">
                            {l.Ids}
                          </td>
                          <td className="p-2 align-top text-right">{count}</td>
                          <td className="p-2 align-top text-right">
                            <button
                              type="button"
                              onClick={() => handleDelete(l)}
                              className="rounded p-1 hover:bg-red-50 text-red-600 transition"
                              title="Eliminar lista"
                              aria-label="Eliminar lista"
                              disabled={remove.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Fila expandida */}
                        {isOpen && (
                          <tr className="bg-muted/30">
                            <td colSpan={4} className="p-0">
                              <div className="p-4">
                                {det?.loading && <div>Cargando socios…</div>}
                                {det?.error && (
                                  <div className="text-destructive">
                                    {det.error}
                                  </div>
                                )}
                                {det?.members && det.members.length === 0 && (
                                  <div>No hay socios en esta lista.</div>
                                )}
                                {det?.members && det.members.length > 0 && (
                                  <div className="overflow-auto rounded border bg-background">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted">
                                        <tr>
                                          <th className="text-left p-2">ID</th>
                                          <th className="text-left p-2">
                                            Nombre
                                          </th>
                                          <th className="text-left p-2">
                                            Email
                                          </th>
                                          <th className="text-right p-2">
                                            Puntos
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {det.members.map((m) => (
                                          <tr key={m.id} className="border-t">
                                            <td className="p-2 font-mono">
                                              {m.id}
                                            </td>
                                            <td className="p-2">
                                              {m.nombre} {m.apellido}
                                            </td>
                                            <td className="p-2">{m.email}</td>
                                            <td className="p-2 text-right">
                                              {m.puntos}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}

                  {!lists.isLoading && (lists.data ?? []).length === 0 && (
                    <tr>
                      <td className="p-3" colSpan={4}>
                        Aún no hay listas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
