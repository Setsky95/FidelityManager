import { adminDb } from "./firebase.js"; 
import fs from "node:fs/promises";
import path from "node:path";

const AUTOMATIONS_FILE =
  process.env.AUTOMATIONS_FILE_PATH || path.join(process.cwd(), "automations.JSON");

/** Normaliza filename: acepta "1.webp" o "/Profile-Pictures/1.webp" y devuelve "1.webp" */
function normalizeProfilePicture(input: unknown): string {
  if (typeof input !== "string") return "1.webp";
  const just = input.trim().replace(/^\/?Profile-Pictures\//i, "");
  // podés validar whitelist si querés: ["1.webp","2.webp","3.webp","4.webp"]
  return just || "1.webp";
}

/** Obtiene el dominio público (absoluto) para armar URLs en emails */
function getPublicBaseUrl(): string {
  // Prioridad: PUBLIC_BASE_URL (setear en Vercel) > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL
  let base =
    process.env.PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";

  // Si viene sin protocolo (p.ej. myapp.vercel.app), prepende https://
  if (base && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  // sin barra al final
  return base.replace(/\/+$/g, "");
}

/** Arma una URL consistente para el asset (absoluta si hay dominio) */
function buildProfilePictureUrl(filename?: string): string {
  const file = normalizeProfilePicture(filename);
  const base = getPublicBaseUrl();
  // Si hay dominio, devolvé absoluta. Si no, relativa (sirve en web, NO en emails).
  return base ? `${base}/Profile-Pictures/${file}` : `/Profile-Pictures/${file}`;
}

/** Agrega variables derivadas que pueden usarse en las plantillas */
function enrichVars(vars: Record<string, any>): Record<string, any> {
  const v = { ...(vars || {}) };
  // Calculadas para avatar
  const normalized = normalizeProfilePicture(v.profilePicture);
  v.profilePicture = normalized;
  // Siempre ofrecé la absoluta (ideal para emails). Si ya vino una, respetala.
  v.profilePictureUrl = v.profilePictureUrl || buildProfilePictureUrl(normalized);
  return v;
}

export function renderTemplate(tpl: string, vars: Record<string, any>) {
  const ctx = enrichVars(vars);
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => (ctx?.[k] ?? "").toString());
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

export async function getTemplateByKey(key: string) {
  // 1) Firestore
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
          enabled: candidate.enabled !== false,
        };
      }
    }
  } catch (e) {
    console.warn("[getTemplateByKey] Firestore fallo:", e);
  }

  // 2) Archivo
  const fileData = await readAutomationsFile();
  const candidate = fileData[key] || fileData[`${key}Email`];
  if (candidate?.subject || candidate?.body) {
    return {
      from: candidate.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
      subject: candidate.subject || "",
      body: candidate.body || "",
      enabled: candidate.enabled !== false,
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

