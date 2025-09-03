import { z } from "zod";

/* ========= Helpers ========= */
const nonEmpty = (msg: string) => z.string().trim().min(1, msg);
const emailNormalized = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido");

/** Coerce date: acepta Date o string ISO y lo convierte a Date */
const zCoerceDate = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v);
  return v;
}, z.date());

/* ========= Members ========= */

export const memberSchema = z.object({
  id: z.string(),                                   // "VG123"
  numero: z.number().int().nonnegative(),           // correlativo 123
  nombre: nonEmpty("El nombre es requerido"),
  apellido: nonEmpty("El apellido es requerido"),
  email: emailNormalized,
  puntos: z.number().min(0, "Los puntos no pueden ser negativos").default(0),
  profilePicture: z.string().url().nullable().optional(), // URL absoluta o null
  fechaRegistro: zCoerceDate.default(() => new Date()),
});

export type Member = z.infer<typeof memberSchema>;

export const insertMemberSchema = memberSchema.omit({
  id: true,
  fechaRegistro: true,
});
export type InsertMember = z.infer<typeof insertMemberSchema>;

/* ========= Auth (Login) ========= */

export const loginSchema = z.object({
  email: emailNormalized,
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ========= Registro público =========
   Usalo en /sumate y /api/public/register
*/
export const publicRegisterSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  profilePicture: z.string().url(), // URL absoluta (CRC externo)
});
export type PublicRegister = z.infer<typeof publicRegisterSchema>;

/* ========= Puntos ========= */

export const updatePointsSchema = z.object({
  operation: z.enum(["add", "subtract", "set"]),
  amount: z.number().min(0, "La cantidad debe ser positiva"),
  reason: z.string().optional(),
});
export type UpdatePoints = z.infer<typeof updatePointsSchema>;

export interface MemberStats {
  totalMembers: number;
  totalPoints: number;
  newThisMonth: number;
  averagePoints: number;
}

/* ========= Movements (logs) ========= */

export type MovementType =
  | "create"
  | "points_add"
  | "points_subtract"
  | "points_set"
  | "delete";

export interface Movement {
  id: string;
  memberId: string;
  memberIdNumber?: number;
  memberName?: string;
  email?: string;
  type: MovementType;
  delta?: number;          // diferencia aplicada (positivo/negativo)
  previousPoints?: number; // puntos antes del cambio
  newPoints?: number;      // puntos luego del cambio
  reason?: string | null;
  createdAt: Date;
}

/* ========= Automations (config) ========= */

export type AutomationEmailSettings = {
  enabled: boolean;
  to?: string;
  from: string;
  subject: string;
  body: string;
};

export type LevelUpEmailSettings = AutomationEmailSettings & {
  threshold: number;
};

export type AutomationsSettingsFile = {
  welcomeEmail: AutomationEmailSettings;
  pointsAddEmail: AutomationEmailSettings;
  levelUpEmail: LevelUpEmailSettings;
};
