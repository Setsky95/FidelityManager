// IMPORTS **con .js**
import { adminDb } from "../_lib/firebase.js";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "vg_session";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "GET") return res.status(405).end();
    const cookie = req.headers.cookie || "";
    const raw = cookie.split("; ").find((c: string) => c.startsWith(`${COOKIE_NAME}=`));
    if (!raw) return res.status(401).json({ ok: false, error: "No auth" });

    const token = raw.split("=")[1];
    const data: any = jwt.verify(token, process.env.JWT_SECRET!);

    // traemos datos “live” (puntos, foto, etc.)
    const ref = adminDb.doc(`suscriptores/${data.id}`);
    const snap = await ref.get();
    if (!snap.exists) return res.status(401).json({ ok: false, error: "No auth" });

    const m: any = snap.data();
    return res.status(200).json({
      ok: true,
      member: {
        id: m.id,
        numero: m.numero,
        email: m.email,
        nombre: m.nombre,
        apellido: m.apellido,
        puntos: m.puntos ?? 0,
        profilePicture: m.profilePicture || null,
        fechaRegistro: m.fechaRegistro?.toDate?.()?.toISOString?.() || null,
      },
    });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: "No auth" });
  }
}
