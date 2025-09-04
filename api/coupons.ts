// api/coupons.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue } from "./_lib/firebase.js";
import jwt from "jsonwebtoken";

type Descuento = "10%" | "20%" | "40%";
type Costs = { ["10%"]?: number; ["20%"]?: number; ["40%"]?: number };

function getUserFromCookie(req: VercelRequest): { id: string; email: string; role?: string } | null {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)vg_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const p = jwt.verify(token, secret) as any;
    return { id: String(p.id ?? p.userId), email: String(p.email), role: p.role };
  } catch {
    return null;
  }
}

function sanitizeInt(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getUserFromCookie(req);
  if (!user /* || user.role !== "admin" */) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // === GET ?action=costs -> leer costos ===
  if (req.method === "GET") {
    const action = String((req.query?.action ?? "") as any);
    if (action === "costs") {
      try {
        const ref = adminDb.collection("settings").doc("couponsPricing");
        const snap = await ref.get();
        const data = snap.exists ? (snap.data() as any) : {};
        res.status(200).json({
          costPerDiscount: {
            ["10%"]: data?.costPerDiscount?.["10%"] ?? 0,
            ["20%"]: data?.costPerDiscount?.["20%"] ?? 0,
            ["40%"]: data?.costPerDiscount?.["40%"] ?? 0,
          },
        });
      } catch (e) {
        console.error("[GET /api/coupons?action=costs] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }

    res.status(400).json({ error: "Invalid GET action" });
    return;
  }

  // === POST con action en body ===
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = String(body?.action || "");

    // Crear cupón
    if (action === "create") {
      const descuento = body?.descuento as Descuento;
      const codigo = String(body?.codigo || "").trim();

      if (!["10%", "20%", "40%"].includes(descuento as any)) {
        res.status(400).json({ error: "Invalid descuento" });
        return;
      }
      if (!codigo) {
        res.status(400).json({ error: "Invalid codigo" });
        return;
      }

      try {
        const ref = await adminDb.collection("cupones").add({
          descuento,
          codigo,
          status: "disponible",
          disponible: true,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: user.email,
        });
        res.status(200).json({ id: ref.id });
      } catch (e) {
        console.error("[POST /api/coupons create] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }

    // Guardar costos
    if (action === "save_costs") {
      const costPerDiscount = (body?.costPerDiscount ?? {}) as Costs;
      try {
        await adminDb.collection("settings").doc("couponsPricing").set(
          {
            costPerDiscount: {
              ["10%"]: sanitizeInt(costPerDiscount["10%"]),
              ["20%"]: sanitizeInt(costPerDiscount["20%"]),
              ["40%"]: sanitizeInt(costPerDiscount["40%"]),
            },
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: user.email,
          },
          { merge: true }
        );
        res.status(200).json({ ok: true });
      } catch (e) {
        console.error("[POST /api/coupons save_costs] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }

    res.status(400).json({ error: "Invalid POST action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
