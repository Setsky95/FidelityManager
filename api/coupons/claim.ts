// api/coupons/claim.ts
import type { VercelRequest, VercelResponse } from "@vercel/node"; // ajustá si usás otro runtime
import { adminDb, FieldValue } from "../_lib/firebase";
import jwt from "jsonwebtoken";

type Descuento = "10%" | "20%" | "40%";

// ✅ lee la cookie vg_session y valida el JWT
function getUserFromCookie(req: VercelRequest): { id: string; email: string } | null {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)vg_session=([^;]+)/);
  if (!m) return null;

  const token = decodeURIComponent(m[1]);
  const secret = process.env.JWT_SECRET; // usa EL MISMO secret que en api/public/login.ts
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as any;
    // adapta estos campos a lo que firmás en login.ts
    return { id: String(payload.id ?? payload.userId), email: String(payload.email) };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = getUserFromCookie(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { descuento } = (req.body || {}) as { descuento?: Descuento };
  if (!descuento || !["10%", "20%", "40%"].includes(descuento)) {
    res.status(400).json({ error: "Invalid descuento" });
    return;
  }

  try {
    const cuponesRef = adminDb.collection("cupones");

    const result = await adminDb.runTransaction(async (tx) => {
      const q = cuponesRef
        .where("descuento", "==", descuento)
        .where("status", "==", "disponible")
        .limit(1);

      const snap = await tx.get(q);
      if (snap.empty) return null;

      const doc = snap.docs[0];
      const data = doc.data() as any;

      if (data.status !== "disponible") return null;

      tx.update(doc.ref, {
        status: "usado",
        usadoPor: user.id,
        usadoEmail: user.email,
        usadoAt: FieldValue.serverTimestamp(),
      });

      return { codigo: String(data.codigo || "") };
    });

    if (!result) {
      res.status(404).json({ error: "No coupons available" });
      return;
    }

    res.status(200).json(result);
  } catch (e) {
    console.error("[claim] error", e);
    res.status(500).json({ error: "Internal error" });
  }
}
