// client/src/hooks/use-members.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { InsertMember, UpdatePoints } from "@shared/schema";

// Tip mínimo para lookup local
type MemberRec = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  puntos: number;
  numero?: number;
};

// Helper fetch JSON con errores claros
async function postJSON<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || json?.message || `HTTP ${res.status}`;
    const err = new Error(msg) as any;
    (err.status = res.status);
    throw err;
  }
  return json as T;
}

export function useMembers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 🔎 Listado
  const { data: members = [], isLoading } = useQuery<MemberRec[]>({
    queryKey: ["/api/members"],
    queryFn: FirebaseService.getMembers,
  });

  // ➕ Alta (ADMIN) → backend dispara emails
  const addMember = useMutation({
    mutationFn: async (payload: InsertMember) => {
      const resp = await postJSON<{ ok: true; member: MemberRec }>(
        "/api/admin/members",
        {
          nombre: payload.nombre.trim(),
          apellido: payload.apellido.trim(),
          email: payload.email.trim().toLowerCase(),
          puntos: Number(payload.puntos || 0),
        }
      );
      return resp.member;
    },
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Éxito", description: `Socio creado: ${member.id}` });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Error al agregar el socio",
        variant: "destructive",
      });
      console.error("Error adding member:", error);
    },
  });

  // 🔄 Sumar puntos (prioriza endpoint serverless; fallback a flujo Firebase + mail pointsAdd)
  type NewShape = { memberId: string; amount: number; reason?: string };
  type OldShape = {
    memberId: string;
    currentPoints: number;
    update: UpdatePoints; // { operation: 'add' | 'set' | 'subtract', amount, reason? }
  };

  const updatePoints = useMutation({
    mutationFn: async (args: NewShape | OldShape) => {
      // Normalizo parámetros
      let memberId: string;
      let amount = 0;
      let reason: string | undefined;
      let currentPointsFromCaller: number | undefined;

      if ("amount" in args) {
        // firma nueva
        memberId = args.memberId;
        amount = Number(args.amount || 0);
        reason = args.reason;
      } else {
        // firma vieja
        memberId = args.memberId;
        currentPointsFromCaller = Number(args.currentPoints ?? NaN);
        const op = (args.update as any)?.operation;
        const a =
          (args.update as any)?.amount ??
          (args.update as any)?.delta ??
          (args.update as any)?.add ??
          0;
        amount = op === "subtract" ? 0 : Number(a || 0); // sólo sumas positivas disparan server
        reason = (args.update as any)?.reason;
        // Si pidieron set/subtract, hacé el flujo viejo directo
        if (op && op !== "add") {
          return FirebaseService.updateMemberPoints(
            memberId,
            currentPointsFromCaller!,
            (args as OldShape).update
          );
        }
      }

      if (!(amount > 0)) {
        throw new Error("La cantidad debe ser mayor a 0");
      }

      // 1) Endpoint ideal: dispara DB + emails (pointsAdd + threshold)
      try {
        const r = await fetch(`/api/members/points-add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, amount, reason }),
        });
        const text = await r.text();
        const json = text ? JSON.parse(text) : null;

        if (r.status === 404) {
          // No existe la ruta -> fallback
          throw Object.assign(new Error("NO_SERVER_ENDPOINT"), { code: "NO_SERVER_ENDPOINT" });
        }
        if (!r.ok || json?.ok === false) {
          const msg = json?.error || json?.message || `HTTP ${r.status}`;
          throw new Error(msg);
        }
        // { ok: true, newPoints, previousPoints, ... }
        return json;
      } catch (err: any) {
        if (err?.code !== "NO_SERVER_ENDPOINT") throw err;

        // 2) Fallback: flujo anterior (cliente) + intento de mail pointsAdd
        const member: MemberRec | undefined = (members as MemberRec[]).find(
          (m) => m.id === memberId
        );

        const current =
          typeof currentPointsFromCaller === "number"
            ? currentPointsFromCaller
            : Number(member?.puntos || 0);

        const result = await FirebaseService.updateMemberPoints(memberId, current, {
          operation: "add",
          amount,
          reason: reason || "Carga rápida",
        } as any);

        try {
          if (member?.email) {
            const newPoints =
              typeof (result as any)?.newPoints === "number"
                ? (result as any).newPoints
                : current + amount;

            await postJSON("/api/automations/points-add", {
              to: member.email,
              data: {
                nombre: member.nombre,
                apellido: member.apellido,
                email: member.email,
                id: member.id,
                puntos: newPoints,
                delta: amount,
              },
            });
          }
        } catch (e) {
          console.warn("[points-add email] fallback no se pudo enviar:", e);
          // aviso suave, sin romper el flujo
        }

        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Éxito", description: "Puntos actualizados correctamente" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Error al actualizar los puntos",
        variant: "destructive",
      });
      console.error("Error updating points:", error);
    },
  });

  // 🗑️ Eliminar
  const deleteMember = useMutation({
    mutationFn: FirebaseService.deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Éxito", description: "Socio eliminado correctamente" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al eliminar el socio",
        variant: "destructive",
      });
      console.error("Error deleting member:", error);
    },
  });

  return { members, isLoading, addMember, updatePoints, deleteMember };
}
