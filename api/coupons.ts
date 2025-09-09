// api/coupons.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue, adminAuth } from "./_lib/firebase.js";
import jwt from "jsonwebtoken";
import { log } from "node:console";

// 🔒 Fuerza runtime Node (Firebase Admin no funciona en Edge)
export const config = { runtime: "nodejs" };

/* ========= Tipos / Const ========= */
export type Descuento = "10%" | "20%" | "40%" | "50%" | "75%" | "envio_gratis";

const VALID_DESCUENTOS: Descuento[] = [
  "10%",
  "20%",
  "40%",
  "50%",
  "75%",
  "envio_gratis",
];

/** Normaliza entradas del front a las claves válidas del backend */
function normalizeDescuento(input: unknown): Descuento | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "envio_gratis" || s === "envío_gratis" || s === "envio__gratis") return "envio_gratis";
  if (s === "10%") return "10%";
  if (s === "20%") return "20%";
  if (s === "40%") return "40%";
  if (s === "50%") return "50%";
  if (s === "75%") return "75%";
  return null;
}

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
  } catch (e) {
    console.error("[auth bearer] verifyIdToken error:", e);
    return null;
  }
}

function getUserFromCookie(req: VercelRequest) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)vg_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn("JWT_SECRET missing (cookie auth no disponible)");
    return null;
  }
  try {
    const p = jwt.verify(token, secret) as any;
    return {
      id: String(p.id ?? p.userId),
      email: String(p.email || ""),
      isAdmin: p.admin === true || p.role === "admin",
      raw: p,
    };
  } catch (e) {
    console.error("[auth cookie] jwt.verify error:", e);
    return null;
  }
}

async function getCurrentUser(req: VercelRequest) {
  const bearer = await getUserFromBearer(req);
  if (bearer) return bearer;
  return getUserFromCookie(req);
}

/* ========= Utils ========= */
function sanitizeInt(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/* ========= Handler ========= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Autenticación requerida para todas las acciones de este endpoint
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // === GET ===
  if (req.method === "GET") {
    const action = String((req.query?.action ?? "") as any);

    // --- GET ?action=costs ---
    if (action === "costs") {
      try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          console.error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
        }
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
      } catch (e: any) {
        console.error("[GET /api/coupons?action=costs] error:", e);
        res.status(500).json({ error: `Internal error: ${e?.message || String(e)}` });
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

    // --- POST claim ---
    if (action === "claim") {
      const descuento = normalizeDescuento(body?.descuento);
      if (!descuento || !VALID_DESCUENTOS.includes(descuento)) {
        res.status(400).json({ error: `Invalid descuento` });
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

          // 2) socio
          const memberRef = adminDb.collection("suscriptores").doc(String(user.id));
          log("memberRef", memberRef);
          log("user.id", user.id);
          log("user.data.id", user.data.id);


          const memberSnap = await tx.get(memberRef);
          if (!memberSnap.exists) return { ok: false as const, reason: "member_not_found" };
          const member = memberSnap.data() as any;
          const prevPoints = Number(member?.puntos ?? 0);
          if (prevPoints < costo) {
            return { ok: false as const, reason: "insufficient_points", need: costo, have: prevPoints };
          }

          // 3) cupón disponible
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

          // 4c) marcar cupón como usado
          tx.update(cupRef, {
            disponible: false,
            usadoPor: user.id,
            usadoEmail: user.email || null,
            usadoAt: FieldValue.serverTimestamp(),
          });

          return {
            ok: true as const,
            codigo: String(cupData?.codigo || ""),
            newPoints,
            cost: costo,
          };
        });

        if (!result.ok) {
          if ((result as any).reason === "insufficient_points") {
            res.status(409).json({
              error: "insufficient_points",
              need: (result as any).need,
              have: (result as any).have,
            });
            return;
          }
          if ((result as any).reason === "no_available") {
            res.status(404).json({ error: "no_available" });
            return;
          }
          if ((result as any).reason === "member_not_found") {
            res.status(404).json({ error: "member_not_found" });
            return;
          }
          res.status(400).json({ error: "bad_request" });
          return;
        }

        res.status(200).json({
          codigo: (result as any).codigo,
          newPoints: (result as any).newPoints,
          cost: (result as any).cost,
        });
      } catch (e: any) {
        console.error("[POST /api/coupons claim] error:", e);
        res.status(500).json({ error: `Internal error: ${e?.message || String(e)}` });
      }
      return;
    }

    // --- POST create ---
    if (action === "create") {
      try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          return res.status(500).json({ error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON" });
        }

        const descuento = normalizeDescuento(body?.descuento);
        const codigo = String(body?.codigo || "").trim();

        if (!descuento || !VALID_DESCUENTOS.includes(descuento)) {
          return res.status(400).json({ error: `Invalid descuento` });
        }
        if (!codigo) {
          return res.status(400).json({ error: "Invalid codigo" });
        }

        const ref = await adminDb.collection("cupones").add({
          descuento,
          codigo,
          disponible: true,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: user.email || null,
        });

        res.status(200).json({ id: ref.id });
      } catch (e: any) {
        console.error("[POST /api/coupons create] error:", e);
        res.status(500).json({ error: `Internal error: ${e?.message || String(e)}` });
      }
      return;
    }

    // --- POST save_costs ---
    if (action === "save_costs") {
      try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          return res.status(500).json({ error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON" });
        }

        const costPerDiscountIn = (body?.costPerDiscount ?? {}) as Costs;

        // saneamos TODAS las claves válidas
        const sanitized: Costs = {};
        for (const k of VALID_DESCUENTOS) {
          const v = sanitizeInt(costPerDiscountIn[k]);
          sanitized[k] = v;
        }

        await adminDb
          .collection("settings")
          .doc("couponsPricing")
          .set(
            {
              costPerDiscount: sanitized,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: user.email || null,
            },
            { merge: true }
          );

        res.status(200).json({ ok: true });
      } catch (e: any) {
        console.error("[POST /api/coupons save_costs] error:", e);
        res.status(500).json({ error: `Internal error: ${e?.message || String(e)}` });
      }
      return;
    }

    res.status(400).json({ error: "Invalid POST action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
