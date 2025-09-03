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
    const doc = snap.docs[0];
    const member: any = doc.data();

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

    const secret = process.env.JWT_SECRET!;
    const expires = process.env.JWT_EXPIRES || "7d";
    const maxAgeSec =
      typeof expires === "string" && expires.endsWith("d")
        ? parseInt(expires) * 24 * 60 * 60
        : 7 * 24 * 60 * 60;

    const token = jwt.sign(payload, secret, { expiresIn: expires });
    setCookie(res, token, maxAgeSec);

    return res.status(200).json({ ok: true, member: payload });
  } catch (e: any) {
    console.error("[/api/public/login] unhandled:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
