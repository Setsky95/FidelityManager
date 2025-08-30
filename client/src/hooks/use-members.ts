import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FirebaseService } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { InsertMember, UpdatePoints } from "@shared/schema";

// Minimal para lookup local
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
    throw new Error(msg);
  }
  return json as T;
}

export function useMembers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 🔎 Listado de miembros (seguimos usando tu fuente actual)
  const { data: members = [], isLoading } = useQuery<MemberRec[]>({
    queryKey: ["/api/members"],
    queryFn: FirebaseService.getMembers,
  });

  // ➕ Alta de socio (ADMIN) => ahora pasa por el BACKEND para disparar automations
  const addMember = useMutation({
    // payload que llega desde AddMemberModal
    mutationFn: async (payload: InsertMember) => {
      // El server crea VG{n}, logs y manda emails (welcome + pointsAdd si puntos>0)
      // Endpoint agregado en routes.mts: POST /api/admin/members
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
      toast({
        title: "Éxito",
        description: `Socio creado: ${member.id}`,
      });
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

  // 🔄 Actualización de puntos
  // Mantengo tu operación en Firebase, y SI el delta es positivo,
  // disparo /api/automations/points-add con los datos del miembro.
  const updatePoints = useMutation({
    mutationFn: async ({
      memberId,
      currentPoints,
      update,
    }: {
      memberId: string;
      currentPoints: number;
      update: UpdatePoints;
    }) => {
      // 1) Hacé lo de siempre (transacción en Firebase)
      const result = await FirebaseService.updateMemberPoints(
        memberId,
        currentPoints,
        update
      );

      // 2) Intento inferir un "delta" positivo para notificar
      //    (soporta varias formas comunes de payload)
      const deltaFromUpdate =
        // @ts-ignore — intentamos soportar formas típicas
        update?.delta ??
        // @ts-ignore
        update?.amount ??
        // @ts-ignore
        update?.add ??
        0;

      const delta = Number.isFinite(deltaFromUpdate)
        ? Number(deltaFromUpdate)
        : 0;

      if (delta > 0) {
        // Buscar datos del miembro en la caché
        const member: MemberRec | undefined = (members as MemberRec[]).find(
          (m) => m.id === memberId
        );

        // Calcular total estimado (si el servicio ya retorna el nuevo total, usalo)
        const newPoints =
          typeof (result as any)?.newPoints === "number"
            ? (result as any).newPoints
            : currentPoints + delta;

        if (member?.email) {
          // 3) Disparo de automation (server compila plantilla y envía)
          //    Si tenés la plantilla 'pointsAdd' en Firestore/archivo, el server la usa.
          try {
            await postJSON("/api/automations/points-add", {
              to: member.email,
              data: {
                nombre: member.nombre,
                apellido: member.apellido,
                email: member.email,
                id: member.id,
                puntos: newPoints,
                delta,
              },
            });
          } catch (e) {
            // No bloqueamos el flujo por el mail — avisamos en consola/Toast suave
            console.warn("[points-add email] no se pudo enviar:", e);
            toast({
              title: "Aviso",
              description:
                "Puntos actualizados. No se pudo enviar el email de notificación.",
              duration: 3500,
            });
          }
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Puntos actualizados correctamente",
      });
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

  // 🗑️ Eliminación (dejamos como lo tenías)
  const deleteMember = useMutation({
    mutationFn: FirebaseService.deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Éxito",
        description: "Socio eliminado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al eliminar el socio",
        variant: "destructive",
      });
      console.error("Error deleting points:", error);
    },
  });

  return {
    members,
    isLoading,
    addMember,
    updatePoints,
    deleteMember,
  };
}
