// api/coupons.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue, adminAuth } from "./_lib/firebase.js";
import jwt from "jsonwebtoken";

export type Descuento = "10%" | "20%" | "40%" | "50%" | "75%" | "envio_gratis";

const VALID_DESCUENTOS: Descuento[] = ["10%", "20%", "40%", "50%", "75%", "envio_gratis"];

function normalizeDescuento(input: any): Descuento | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, "_"); // pasa "Envio gratis" -> "envio_gratis"
  // normalizar casos comunes
  if (s === "envio_gratis" || s === "envío_gratis" || s === "envio__gratis") return "envio_gratis";
  if (s === "10%") return "10%";
  if (s === "20%") return "20%";
  if (s === "40%") return "40%";
  if (s === "50%") return "50%";
  if (s === "75%") return "75%";
  return null;
}

// ... helpers de auth iguales ...

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (req.method === "GET") {
    const action = String((req.query?.action ?? "") as any);
    if (action === "costs") {
      try {
        const ref = adminDb.collection("settings").doc("couponsPricing");
        const snap = await ref.get();
        const data = snap.exists ? (snap.data() as any) : {};
        const src = data?.costPerDiscount ?? {};

        const out: Record<Descuento, number> = {
          "10%": Number(src["10%"] ?? 0),
          "20%": Number(src["20%"] ?? 0),
          "40%": Number(src["40%"] ?? 0),
          "50%": Number(src["50%"] ?? 0),
          "75%": Number(src["75%"] ?? 0),
          "envio_gratis": Number(src["envio_gratis"] ?? 0),
        };

        res.status(200).json({ costPerDiscount: out });
      } catch (e) {
        console.error("[GET /api/coupons?action=costs] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }
    res.status(400).json({ error: "Invalid GET action" });
    return;
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = String(body?.action || "");

    if (action === "claim") {
      const descuentoNorm = normalizeDescuento(body?.descuento);
      if (!descuentoNorm || !VALID_DESCUENTOS.includes(descuentoNorm)) {
        res.status(400).json({ error: "Invalid descuento" });
        return;
      }

      try {
        const result = await adminDb.runTransaction(async (tx) => {
          // costo
          const pricingRef = adminDb.collection("settings").doc("couponsPricing");
          const pricingSnap = await tx.get(pricingRef);
          const pricing = (pricingSnap.exists ? pricingSnap.data() : {}) as any;
          const costRaw = Number(pricing?.costPerDiscount?.[descuentoNorm] ?? 0);
          const costo = Number.isFinite(costRaw) && costRaw > 0 ? Math.floor(costRaw) : 0;

          // socio
          const memberRef = adminDb.collection("suscriptores").doc(String(user.id));
          const memberSnap = await tx.get(memberRef);
          if (!memberSnap.exists) return { ok: false as const, reason: "member_not_found" };
          const member = memberSnap.data() as any;
          const prevPoints = Number(member?.puntos ?? 0);
          if (prevPoints < costo) {
            return { ok: false as const, reason: "insufficient_points", need: costo, have: prevPoints };
          }

          // cupón disponible
          const q = adminDb
            .collection("cupones")
            .where("descuento", "==", descuentoNorm)
            .where("disponible", "==", true)
            .limit(1);

          const cupSnap = await tx.get(q);
          if (cupSnap.empty) return { ok: false as const, reason: "no_available" };
          const cupDoc = cupSnap.docs[0];
          const cupRef = cupDoc.ref;
          const cupData = cupDoc.data() as any;

          // updates atómicos
          const newPoints = prevPoints - costo;
          tx.update(memberRef, { puntos: newPoints, ultimaActualizacion: FieldValue.serverTimestamp(), ultimoMotivo: `canje cupón ${descuentoNorm}` });

          const logRef = adminDb.collection("movimientos").doc();
          tx.set(logRef, {
            memberId: String(user.id),
            email: user.email || null,
            type: "points_subtract",
            delta: -costo,
            previousPoints: prevPoints,
            newPoints,
            reason: `canje cupón ${descuentoNorm}`,
            createdAt: FieldValue.serverTimestamp(),
            autorUid: user.id,
          });

          tx.update(cupRef, {
            disponible: false,
            usadoPor: user.id,
            usadoEmail: user.email || null,
            usadoAt: FieldValue.serverTimestamp(),
          });

          return { ok: true as const, codigo: String(cupData?.codigo || ""), newPoints, cost: costo };
        });

        if (!result.ok) {
          if (result.reason === "insufficient_points") {
            res.status(409).json({ error: "insufficient_points", need: (result as any).need, have: (result as any).have });
            return;
          }
          if (result.reason === "no_available") {
            res.status(404).json({ error: "no_available" });
            return;
          }
          if (result.reason === "member_not_found") {
            res.status(404).json({ error: "member_not_found" });
            return;
          }
          res.status(400).json({ error: "bad_request" });
          return;
        }

        res.status(200).json({ codigo: result.codigo, newPoints: result.newPoints, cost: result.cost });
      } catch (e) {
        console.error("[POST /api/coupons claim] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }

    // create y save_costs quedan igual…
    // ...
  }

  res.status(405).json({ error: "Method not allowed" });
}