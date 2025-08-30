// client/src/hooks/use-automations.ts
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutomationsSettingsFile } from "@/../shared/schema";

const API = ""; // usamos rutas relativas -> Vite proxy manda a 5000

async function getSettings(): Promise<AutomationsSettingsFile | null> {
  // 1) Firestore settings
  try {
    const r = await fetch(`${API}/api/automations/settings`);
    if (r.ok) {
      const j = await r.json();
      // servidor devuelve { ok:true, data:{...} }
      return (j?.data ?? null) as AutomationsSettingsFile | null;
    }
  } catch {}
  // 2) Archivo automations.JSON
  try {
    const r = await fetch(`${API}/api/automations`);
    if (r.ok) return (await r.json()) as AutomationsSettingsFile;
  } catch {}
  return null;
}

async function putSettings(body: AutomationsSettingsFile): Promise<void> {
  // 1) Guardar en Firestore
  const r = await fetch(`${API}/api/automations/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.ok) return;

  // 2) Fallback a archivo automations.JSON
  const r2 = await fetch(`${API}/api/automations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r2.ok) {
    let msg = "No se pudo guardar automations";
    try {
      const j = await r2.json();
      msg = j?.message || j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
}

type SendTestArgs = {
  to: string;
  template: {
    enabled: boolean;
    to?: string;
    from: string;
    subject: string;
    body: string;
  };
  // opcional: extra data para placeholders
  data?: Record<string, any>;
  // opcional: clave (welcome | pointsAdd | levelUp)
  key?: string;
};

async function postTestEmail({ to, template, data, key }: SendTestArgs) {
  const payload = {
    to,
    template: {
      from: template.from,
      subject: template.subject,
      body: template.body,
    },
    data: {
      // defaults para que la preview coincida con tu card
      nombre: "Sebastián",
      apellido: "Pavlotsky",
      email: to,
      id: "VG123",
      puntos: 8,
      delta: 1,
      ...(data || {}),
    },
    key, // opcional (el server acepta key o template)
  };

  const r = await fetch(`${API}/api/automations/test-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || "Fallo el test de automation");
  }
  return j; // { ok:true, messageId: "<...>" }
}

export function useAutomations() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["automations-settings"],
    queryFn: getSettings,
  });

  const save = useMutation({
    mutationFn: (body: AutomationsSettingsFile) => putSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations-settings"] });
    },
  });

  const sendTest = useMutation({
    mutationFn: postTestEmail,
  });

  return useMemo(
    () => ({
      settings: settingsQ.data ?? null,
      isLoading: settingsQ.isLoading,
      save,
      sendTest,
    }),
    [settingsQ.data, settingsQ.isLoading, save, sendTest]
  );
}
