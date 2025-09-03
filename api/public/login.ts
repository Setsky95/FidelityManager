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

function parseMaxAge(expires: string | number | undefined): number {
  if (typeof expires === "number") return Math.max(1, Math.floor(expires));
  const val = (expires || "7d").trim().toLowerCase();
  // "7d" → días; número → segundos
  if (/^\d+d$/.test(val)) {
    const d = parseInt(val.replace("d", ""), 10);
    return Math.max(1, d * 24 * 60 * 60);
  }
  if (/^\d+$/.test(val)) {
    return Math.max(1, parseInt(val, 10));
  }
  // fallback 7 días
  return 7 * 24 * 60 * 60;
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
    const expiresEnv = process.env.JWT_EXPIRES || "7d";
    const maxAgeSec = parseMaxAge(expiresEnv);

    // 👇 Forzamos el tipo del secreto y pasamos opciones como tercer argumento
    const token = jwt.sign(payload, secretEnv as jwt.Secret, { expiresIn: expiresEnv });

    setCookie(res, token, maxAgeSec);
    return res.status(200).json({ ok: true, member: payload });
  } catch (e: any) {
    console.error("[/api/public/login] unhandled:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
