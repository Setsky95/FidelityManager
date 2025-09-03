// IMPORTS **con .js**
import { adminDb } from "../_lib/firebase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "vg_session";

function setCookie(res: any, token: string, maxAgeSec: number) {
  const isProd = process.env.NODE_ENV === "production";
  const cookie =
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}` +
    (isProd ? "; Secure" : "");
  res.setHeader("Set-Cookie", cookie);
}

// Normaliza JWT_EXPIRES a un tipo válido para jsonwebtoken
type Exp = jwt.SignOptions["expiresIn"];
function resolveExpires(input?: string | number | null): Exp {
  if (typeof input === "number") return Math.max(1, Math.floor(input));
  const v = String(input ?? "7d").trim();
  if (/^\d+$/.test(v)) return Number(v); // segundos
  if (/^\d+(ms|s|m|h|d|w|y)$/i.test(v)) return v as Exp; // ej "7d"
  return "7d";
}

// Convierte expires a Max-Age en segundos para la cookie
function toMaxAgeSec(expires: Exp): number {
  if (typeof expires === "number") return Math.max(1, Math.floor(expires));
  const m = /^(\d+)(ms|s|m|h|d|w|y)$/i.exec(expires);
  if (!m) return 7 * 24 * 60 * 60;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mul: Record<string, number> = {
    ms: 1 / 1000,
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31536000,
  };
  return Math.max(1, Math.floor(n * (mul[unit] ?? 86400)));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { email, password } = req.body ?? {};
    if (
      !email || typeof email !== "string" || !email.includes("@") ||
      !password || typeof password !== "string"
    ) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }

    const snap = await adminDb
      .collection("suscriptores")
      .where("email", "==", email.trim().toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });
    const member: any = snap.docs[0].data();

    if (!member?.passwordHash) {
      return res.status(401).json({ ok: false, error: "Credenciales inválidas" });
    }
    const ok = await bcrypt.compare(password, member.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const payload = {
      id: member.id,
      numero: member.numero,
      email: member.email,
      nombre: member.nombre,
      apellido: member.apellido,
      profilePicture: member.profilePicture || null,
    };

    const secretEnv = process.env.JWT_SECRET;
    if (!secretEnv) {
      console.error("[/api/public/login] Falta JWT_SECRET");
      return res.status(500).json({ ok: false, error: "Config faltante: JWT_SECRET" });
    }

    const expiresIn = resolveExpires(process.env.JWT_EXPIRES || "7d");
    const token = jwt.sign(payload, secretEnv as jwt.Secret, { expiresIn }); // 👈 tipos correctos
    setCookie(res, token, toMaxAgeSec(expiresIn));

    return res.status(200).json({ ok: true, member: payload });
  } catch (e: any) {
    console.error("[/api/public/login] unhandled:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
