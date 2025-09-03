import { adminDb } from "./firebase.js";
import fs from "node:fs/promises";
import path from "node:path";

// ---------- CONFIG Y HELPERS DE RUTA ----------

const DEFAULT_CANDIDATE_FILES = [
  "automations.JSON",   // tu default actual
  "automation.json",    // singular
  "automations.json",   // minúsculas
];

const AUTOMATIONS_SOURCE = (process.env.AUTOMATIONS_SOURCE || "firestore-first").toLowerCase();
// Valores válidos: "file-first" | "file-only" | "firestore-first" | "firestore-only"

function resolveAutomationsFilePath(): string[] {
  // 1) Si viene env, úsalo primero (puede ser relativo o absoluto)
  const envPath = process.env.AUTOMATIONS_FILE_PATH;
  const list: string[] = [];
  if (envPath) list.push(path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath));
  // 2) Candidatos por defecto en el cwd
  for (const f of DEFAULT_CANDIDATE_FILES) {
    list.push(path.join(process.cwd(), f));
  }
  return list;
}

// ---------- AVATAR HELPERS ----------

/** Normaliza filename: acepta "1.webp" o "/Profile-Pictures/1.webp" y devuelve "1.webp" */
function normalizeProfilePicture(input: unknown): string {
  if (typeof input !== "string") return "1.jpg";
  const just = input.trim().replace(/^\/?Profile-Pictures\//i, "");
  // Podrías validar whitelist aquí: ["1.webp","2.webp","3.webp","4.webp"]
  return just || "1.jpg";
}

/** Obtiene el dominio público (absoluto) para armar URLs en emails */
function getPublicBaseUrl(): string {
  // Prioridad: PUBLIC_BASE_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL
  let base =
    process.env.PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";

  // Si viene sin protocolo (p.ej. myapp.vercel.app), prepende https://
  if (base && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  // Sin barra al final
  return base.replace(/\/+$/g, "");
}

/** Arma una URL consistente para el asset (absoluta si hay dominio) */
function buildProfilePictureUrl(filename?: string): string {
  const file = normalizeProfilePicture(filename);
  const base = getPublicBaseUrl();
  // En emails necesitás absoluta; si no hay dominio configurado, quedará relativa.
  return base ? `${base}/Profile-Pictures/${file}` : `/Profile-Pictures/${file}`;
}

/** Agrega variables derivadas que pueden usarse en las plantillas */
function enrichVars(vars: Record<string, any>): Record<string, any> {
  const v = { ...(vars || {}) };
  const normalized = normalizeProfilePicture(v.profilePicture);
  v.profilePicture = normalized;
  v.profilePictureUrl = v.profilePictureUrl || buildProfilePictureUrl(normalized);
  return v;
}

export function renderTemplate(tpl: string, vars: Record<string, any>) {
  const ctx = enrichVars(vars);
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => (ctx?.[k] ?? "").toString());
}

// ---------- LECTURA DE PLANTILLAS DESDE ARCHIVO O FIRESTORE ----------

async function readFirstExistingJson(fileCandidates: string[]): Promise<any> {
  for (const p of fileCandidates) {
    try {
      const raw = await fs.readFile(p, "utf-8");
      const text = raw.replace(/^\uFEFF/, "");
      if (text.trim()) {
        return JSON.parse(text);
      }
    } catch {
      // probar siguiente candidato
    }
  }
  return {};
}

async function readAutomationsFile(): Promise<any> {
  const candidates = resolveAutomationsFilePath();
  return readFirstExistingJson(candidates);
}

function normalizeTemplate(candidate: any) {
  return {
    from: candidate?.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: candidate?.subject || "",
    body: candidate?.body || "",
    enabled: candidate?.enabled !== false,
  };
}

async function getFromFile(key: string) {
  const fileData = await readAutomationsFile();
  const candidate = fileData[key] || fileData[`${key}Email`];
  return candidate?.subject || candidate?.body ? normalizeTemplate(candidate) : null;
}

async function getFromFirestore(key: string) {
  try {
    const ref = adminDb.doc("settings/automations");
    const snap = await ref.get();
    if (snap.exists) {
      const data: any = snap.data() || {};
      const candidate = data[key] || data[`${key}Email`];
      return candidate?.subject || candidate?.body ? normalizeTemplate(candidate) : null;
    }
  } catch (e) {
    console.warn("[getTemplateByKey] Firestore fallo:", e);
  }
  return null;
}

export async function getTemplateByKey(key: string) {
  let tpl = null;

  if (AUTOMATIONS_SOURCE === "file-first") {
    tpl = (await getFromFile(key)) || (await getFromFirestore(key));
  } else if (AUTOMATIONS_SOURCE === "file-only") {
    tpl = await getFromFile(key);
  } else if (AUTOMATIONS_SOURCE === "firestore-only") {
    tpl = await getFromFirestore(key);
  } else {
    // default: "firestore-first"
    tpl = (await getFromFirestore(key)) || (await getFromFile(key));
  }

  if (tpl) return tpl;

  // Fallback
  return {
    from: `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: `Notificación: ${key}`,
    body: `<div>Hola {{nombre}}, este es un mensaje de ${key}.</div>`,
    enabled: true,
  };
}
