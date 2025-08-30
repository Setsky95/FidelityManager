// server/storage.ts
import { type Member, type InsertMember } from "@shared/schema";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

/* =========================
   Members en memoria (lo que ya tenías)
   ========================= */
export interface IStorage {
  getMember(id: string): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
}

export class MemStorage implements IStorage {
  private members: Map<string, Member> = new Map();

  async getMember(id: string): Promise<Member | undefined> {
    return this.members.get(id);
  }

  async getMemberByEmail(email: string): Promise<Member | undefined> {
    return Array.from(this.members.values()).find((m) => m.email === email);
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const id = randomUUID();
    const member: Member = { ...insertMember, id, fechaRegistro: new Date() };
    this.members.set(id, member);
    return member;
  }
}

export const storage = new MemStorage();

/* =========================
   Automations: lectura/escritura de JSON
   ========================= */

// Tipos locales (no hace falta agregarlos a shared)
export type AutomationEmailSettings = {
  enabled: boolean;
  to?: string;
  from: string;
  subject: string;
  body: string; // HTML o texto
};

export type AutomationsSettings = {
  welcomeEmail: AutomationEmailSettings;
  pointsAddEmail: AutomationEmailSettings;
};

// Ruta del archivo JSON (está en la raíz del repo)
const AUTOMATIONS_PATH = path.resolve(process.cwd(), "automations.JSON");

// Defaults seguros (se mezclan con lo que exista en el archivo)
export const AUTOMATIONS_DEFAULTS: AutomationsSettings = {
  welcomeEmail: {
    enabled: true,
    to: "",
    from: "Van Gogh Fidelidad <no-reply@tudominio.com>",
    subject: "¡Bienvenido/a, {{nombre}}!",
    body: "<h1>Hola {{nombre}}</h1><p>Tu ID es {{id}}</p>",
  },
  pointsAddEmail: {
    enabled: false,
    to: "",
    from: "Van Gogh Fidelidad <no-reply@tudominio.com>",
    subject: "¡Sumaste {{delta}} puntos!",
    body:
      "<p>Hola {{nombre}}, acabás de sumar <b>{{delta}}</b> puntos. Tu total ahora es <b>{{puntos}}</b>.</p>",
  },
};

function mergeAutomations(
  partial?: Partial<AutomationsSettings>
): AutomationsSettings {
  return {
    welcomeEmail: {
      ...AUTOMATIONS_DEFAULTS.welcomeEmail,
      ...(partial?.welcomeEmail || {}),
    },
    pointsAddEmail: {
      ...AUTOMATIONS_DEFAULTS.pointsAddEmail,
      ...(partial?.pointsAddEmail || {}),
    },
  };
}

// Asegura que el archivo existe
async function ensureFile(): Promise<void> {
  try {
    await fs.access(AUTOMATIONS_PATH);
  } catch {
    const initial = JSON.stringify(AUTOMATIONS_DEFAULTS, null, 2);
    await fs.writeFile(AUTOMATIONS_PATH, initial, "utf-8");
  }
}

export async function readAutomationsFile(): Promise<AutomationsSettings> {
  await ensureFile();
  const raw = await fs.readFile(AUTOMATIONS_PATH, "utf-8");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // si está corrupto, lo regeneramos
    await fs.writeFile(
      AUTOMATIONS_PATH,
      JSON.stringify(AUTOMATIONS_DEFAULTS, null, 2),
      "utf-8"
    );
    return AUTOMATIONS_DEFAULTS;
  }
  return mergeAutomations(parsed);
}

export async function writeAutomationsFile(
  settings: AutomationsSettings
): Promise<void> {
  await ensureFile();
  const merged = mergeAutomations(settings);
  await fs.writeFile(
    AUTOMATIONS_PATH,
    JSON.stringify(merged, null, 2),
    "utf-8"
  );
}
