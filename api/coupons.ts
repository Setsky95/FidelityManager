// api/coupons.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue, adminAuth } from "./_lib/firebase.js";
import jwt from "jsonwebtoken";

/* ========= Tipos / const ========= */
export type Descuento =
  | "10%"
  | "20%"
  | "40%"
  | "50%"
  | "75%"
  | "envio_gratis";

const VALID_DESCUENTOS: Descuento[] = [
  "10%",
  "20%",
  "40%",
  "50%",
  "75%",
  "envio_gratis",
];

type Costs = Partial<Record<Descuento, number>>;

/* ========= Auth helpers ========= */
async function getUserFromBearer(req: VercelRequest) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      id: decoded.uid,
      email: decoded.email || "",
      isAdmin: (decoded as any).admin === true,
      raw: decoded,
    };
  } catch {
    return null;
  }
}

function getUserFromCookie(req: VercelRequest) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)vg_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const p = jwt.verify(token, secret) as any;
    return {
      id: String(p.id ?? p.userId),
      email: String(p.email || ""),
      isAdmin: p.admin === true || p.role === "admin",
      raw: p,
    };
  } catch {
    return null;
  }
}

async function getCurrentUser(req: VercelRequest) {
  const bearer = await getUserFromBearer(req);
  if (bearer) return bearer;
  return getUserFromCookie(req);
}

/* ========= Utils ========= */
function sanitizeInt(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/* ========= Handler ========= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // === GET ?action=costs ===
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

  // === POST ===
  if (req.method === "POST") {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = String(body?.action || "");

    // --- CLAIM ---
    if (action === "claim") {
      const descuento = String(body?.descuento || "") as Descuento;
      if (!VALID_DESCUENTOS.includes(descuento)) {
        res.status(400).json({ error: "Invalid descuento" });
        return;
      }

      try {
        const result = await adminDb.runTransaction(async (tx) => {
          // 1) costo del cupón
          const pricingRef = adminDb.collection("settings").doc("couponsPricing");
          const pricingSnap = await tx.get(pricingRef);
          const pricing = (pricingSnap.exists ? pricingSnap.data() : {}) as any;
          const costRaw = Number(pricing?.costPerDiscount?.[descuento] ?? 0);
          const costo = Number.isFinite(costRaw) && costRaw > 0 ? Math.floor(costRaw) : 0;

          // 2) socio (user.id = VGxx)
          const memberRef = adminDb.collection("suscriptores").doc(String(user.id));
          const memberSnap = await tx.get(memberRef);
          if (!memberSnap.exists)
            return { ok: false as const, reason: "member_not_found" };
          const member = memberSnap.data() as any;
          const prevPoints = Number(member?.puntos ?? 0);
          if (prevPoints < costo) {
            return {
              ok: false as const,
              reason: "insufficient_points",
              need: costo,
              have: prevPoints,
            };
          }

          // 3) cupón disponible (único flag: disponible === true)
          const q = adminDb
            .collection("cupones")
            .where("descuento", "==", descuento)
            .where("disponible", "==", true)
            .limit(1);

          const cupSnap = await tx.get(q);
          if (cupSnap.empty) return { ok: false as const, reason: "no_available" };
          const cupDoc = cupSnap.docs[0];
          const cupRef = cupDoc.ref;
          const cupData = cupDoc.data() as any;

          // 4) updates atómicos
          const newPoints = prevPoints - costo;

          // 4a) descontar puntos
          tx.update(memberRef, {
            puntos: newPoints,
            ultimaActualizacion: FieldValue.serverTimestamp(),
            ultimoMotivo: `canje cupón ${descuento}`,
          });

          // 4b) log
          const logRef = adminDb.collection("movimientos").doc();
          tx.set(logRef, {
            memberId: String(user.id),
            email: user.email || null,
            type: "points_subtract",
            delta: -costo,
            previousPoints: prevPoints,
            newPoints,
            reason: `canje cupón ${descuento}`,
            createdAt: FieldValue.serverTimestamp(),
            autorUid: user.id,
          });

          // 4c) marcar cupón como usado (booleano)
          tx.update(cupRef, {
            disponible: false,
            usadoPor: user.id,
            usadoEmail: user.email || null,
            usadoAt: FieldValue.serverTimestamp(),
          });

          // 5) respuesta
          return {
            ok: true as const,
            codigo: String(cupData?.codigo || ""),
            newPoints,
            cost: costo,
          };
        });

        if (!result.ok) {
          if (result.reason === "insufficient_points") {
            res
              .status(409)
              .json({ error: "insufficient_points", need: result.need, have: result.have });
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

        res.status(200).json({
          codigo: result.codigo,
          newPoints: result.newPoints,
          cost: result.cost,
        });
      } catch (e) {
        // si Firestore pide índice (descuento+disponible) crealo desde el link del error
        console.error("[POST /api/coupons claim] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }

    // --- CREATE ---
    if (action === "create") {
      const descuento = String(body?.descuento || "") as Descuento;
      const codigo = String(body?.codigo || "").trim();

      if (!VALID_DESCUENTOS.includes(descuento)) {
        res.status(400).json({ error: "Invalid descuento" });
        return;
      }
      // Acepta cualquier combinación: solo pedimos que NO esté vacío
      if (!codigo) {
        res.status(400).json({ error: "Invalid codigo" });
        return;
      }

      try {
        const ref = await adminDb.collection("cupones").add({
          descuento,
          codigo,
          disponible: true, // ✅ único flag de disponibilidad
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

    // --- SAVE COSTS ---
    if (action === "save_costs") {
      const costPerDiscountIn = (body?.costPerDiscount ?? {}) as Costs;

      // saneamos TODAS las claves válidas
      const sanitized: Costs = {};
      for (const k of VALID_DESCUENTOS) {
        const v = Number(costPerDiscountIn[k]);
        sanitized[k] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
      }

      try {
        await adminDb
          .collection("settings")
          .doc("couponsPricing")
          .set(
            {
              costPerDiscount: sanitized,
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
