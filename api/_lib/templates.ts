import fs from "node:fs/promises";
import path from "node:path";
import { adminDb } from "./firebase";

const AUTOMATIONS_FILE =
  process.env.AUTOMATIONS_FILE_PATH || path.join(process.cwd(), "automations.JSON");

export function renderTemplate(tpl: string, vars: Record<string, any>) {
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars?.[k] ?? "").toString());
}

async function readAutomationsFile(): Promise<any> {
  try {
    const raw = await fs.readFile(AUTOMATIONS_FILE, "utf-8");
    const text = raw.replace(/^\uFEFF/, "");
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function getTemplateByKey(key: string): Promise<{
  from: string; subject: string; body: string; enabled?: boolean;
}> {
  // 1) Firestore settings/automations
  try {
    const ref = adminDb.doc("settings/automations");
    const snap = await ref.get();
    if (snap.exists) {
      const data: any = snap.data() || {};
      const candidate = data[key] || data[`${key}Email`];
      if (candidate?.subject || candidate?.body) {
        return {
          from: candidate.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
          subject: candidate.subject || "",
          body: candidate.body || "",
          enabled: candidate.enabled,
        };
      }
    }
  } catch (e) {
    console.warn("[getTemplateByKey] Firestore fallo:", e);
  }

  // 2) Archivo local
  const fileData = await readAutomationsFile();
  const candidate = fileData[key] || fileData[`${key}Email`];
  if (candidate?.subject || candidate?.body) {
    return {
      from: candidate.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
      subject: candidate.subject || "",
      body: candidate.body || "",
      enabled: candidate.enabled,
    };
  }

  // 3) Fallback
  return {
    from: `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: `Notificación: ${key}`,
    body: `<div>Hola {{nombre}}, este es un mensaje de ${key}.</div>`,
    enabled: true,
  };
}
