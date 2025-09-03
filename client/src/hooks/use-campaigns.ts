import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCampaigns() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const r = await fetch("/api/campaigns");
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al cargar campañas");
      return j.campaigns as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: { name: string; from?: string; subject: string; body: string }) => {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al crear campaña");
      return j.campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const update = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const r = await fetch(`/api/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al actualizar campaña");
      return j.campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al eliminar campaña");
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const send = useMutation({
    mutationFn: async (payload: { campaignId: string; to: string; data?: Record<string, any> }) => {
      const r = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error al enviar campaña");
      return j;
    },
  });

  return { list, create, update, remove, send };
}
