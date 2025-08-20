import { z } from "zod";

export const memberSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  puntos: z.number().min(0, "Los puntos no pueden ser negativos").default(0),
  fechaRegistro: z.date().default(() => new Date()),
});

export const insertMemberSchema = memberSchema.omit({ id: true, fechaRegistro: true });

export const updatePointsSchema = z.object({
  operation: z.enum(["add", "subtract", "set"]),
  amount: z.number().min(0, "La cantidad debe ser positiva"),
  reason: z.string().optional(),
});

export type Member = z.infer<typeof memberSchema>;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type UpdatePoints = z.infer<typeof updatePointsSchema>;

export interface MemberStats {
  totalMembers: number;
  totalPoints: number;
  newThisMonth: number;
  averagePoints: number;
}
