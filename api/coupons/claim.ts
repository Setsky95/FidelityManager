import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue } from "../_lib/firebase.js";
import jwt from "jsonwebtoken";

type Descuento = "10%" | "20%" | "40%";

function getUserFromCookie(req: VercelRequest): { id: string; email: string } | null {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)vg_session=([^;]+)/);
  if (!m) return null;

  const token = decodeURIComponent(m[1]);
  const secret = process.env.JWT_SECRET; // usa el MISMO secret que en login
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as any;
    return { id: String(payload.id ?? payload.userId), email: String(payload.email) };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = getUserFromCookie(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { descuento } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
    if (!["10%", "20%", "40%"].includes(descuento)) {
      res.status(400).json({ error: "Invalid descuento" });
      return;
    }

    const cuponesRef = adminDb.collection("cupones");

    // 1) Hacemos la QUERY fuera de la tx para obtener el docRef candidato
    const qSnap = await cuponesRef
      .where("descuento", "==", descuento)
      .where("status", "==", "disponible")
      .limit(1)
      .get();

    if (qSnap.empty) {
      res.status(404).json({ error: "No coupons available" });
      return;
    }

    const docRef = qSnap.docs[0].ref;

    // 2) Transacción: re-lee el doc y valida estado antes de actualizar
    const result = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(docRef);
      if (!fresh.exists) return null;

      const data = fresh.data() as any;
      if (data.status !== "disponible") return null;

      tx.update(docRef, {
        status: "usado",
        usadoPor: user.id,
        usadoEmail: user.email,
        usadoAt: FieldValue.serverTimestamp(),
      });

      return { codigo: String(data.codigo || "") };
    });

    if (!result) {
      res.status(409).json({ error: "Coupon already used" });
      return;
    }

    res.status(200).json(result);
  } catch (e: any) {
    console.error("[api/coupons/claim] error:", e);
    res.status(500).json({ error: "Internal error" });
  }
}
