// api/coupons.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, FieldValue, adminAuth } from "./_lib/firebase.js";
import jwt from "jsonwebtoken";

type Descuento = "10%" | "20%" | "40%";
type Costs = { ["10%"]?: number; ["20%"]?: number; ["40%"]?: number };

/* =========================
   Auth helpers
   ========================= */

// 1) Preferimos Firebase ID Token en Authorization: Bearer <token>
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

// 2) Fallback: cookie vg_session firmada con JWT_SECRET
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

// 3) Unifica: intenta Bearer y, si no, cookie
async function getCurrentUser(req: VercelRequest) {
  const bearer = await getUserFromBearer(req);
  if (bearer) return bearer;
  return getUserFromCookie(req);
}

/* =========================
   Utils
   ========================= */
function sanitizeInt(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function json(res: VercelResponse, code: number, data: any) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(data));
}

/** Normaliza la acción tanto si llega por `?action=` / body.action
 *  como si llegó a `/api/coupons/claim` (vía catch-all). */
function normalizeAction(req: VercelRequest) {
  // por URL (catch-all)
  try {
    const path = (req.url || "").split("?")[0];
    const last = path.split("/").filter(Boolean).at(-1);
    if (last && last !== "coupons") return last; // p.ej. 'claim'
  } catch {
    /* ignore */
  }

  // por query
  const qAction = (req.query?.action ?? "") as string;
  if (qAction) return String(qAction);

  // por body
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    if (body?.action) return String(body.action);
  }

  return "";
}

function safeParse(s: string) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

/* =========================
   Handler
   ========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth para todo este endpoint (admin panel y dashboard emiten cookie o bearer)
  const user = await getCurrentUser(req);
  if (!user) return json(res, 401, { error: "Not authenticated" });

  // 👉 Si querés restringir sólo a admins algunas acciones, podés gatearlas con user.isAdmin

  // === GET ?action=costs -> leer costos ===
  if (req.method === "GET") {
    const action = normalizeAction(req) || String((req.query?.action ?? "") as any);
    if (action === "costs") {
      try {
        const ref = adminDb.collection("settings").doc("couponsPricing");
        const snap = await ref.get();
        const data = snap.exists ? (snap.data() as any) : {};
        return json(res, 200, {
          costPerDiscount: {
            ["10%"]: data?.costPerDiscount?.["10%"] ?? 0,
            ["20%"]: data?.costPerDiscount?.["20%"] ?? 0,
            ["40%"]: data?.costPerDiscount?.["40%"] ?? 0,
          },
        });
      } catch (e) {
        console.error("[GET /api/coupons?action=costs] error", e);
        return json(res, 500, { error: "Internal error" });
      }
    }

    return json(res, 400, { error: "Invalid GET action" });
  }

  // === POST con action en body o en subruta ===
  if (req.method === "POST") {
    // parse body con seguridad
    const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
    const action = normalizeAction(req) || String(body?.action || "");

    /* ====== CLAIM (descuenta puntos + asigna cupón) ====== */
    if (action === "claim") {
      const descuento = String(body?.descuento || "");
      if (!["10%", "20%", "40%"].includes(descuento)) {
        return json(res, 400, { error: "Invalid descuento" });
      }

      try {
        const result = await adminDb.runTransaction(async (tx) => {
          // 1) Precio del cupón
          const pricingRef = adminDb.collection("settings").doc("couponsPricing");
          const pricingSnap = await tx.get(pricingRef);
          const pricing = (pricingSnap.exists ? pricingSnap.data() : {}) as any;
          const cost = Number(pricing?.costPerDiscount?.[descuento] ?? 0);
          const costo = Number.isFinite(cost) && cost > 0 ? Math.floor(cost) : 0;

          // 2) Socio (user.id = VGxx)
          const memberRef = adminDb.collection("suscriptores").doc(String(user.id));
          const memberSnap = await tx.get(memberRef);
          if (!memberSnap.exists) {
            return { ok: false as const, reason: "member_not_found" };
          }
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

          // 3) Un cupón disponible
          const q = adminDb
            .collection("cupones")
            .where("descuento", "==", descuento)
            .where("status", "==", "disponible")
            .limit(1);
          const cupSnap = await tx.get(q);
          if (cupSnap.empty) {
            return { ok: false as const, reason: "no_available" };
          }
          const cupDoc = cupSnap.docs[0];
          const cupRef = cupDoc.ref;
          const cupData = cupDoc.data() as any;

          // 4) Actualizaciones atómicas
          const newPoints = prevPoints - costo;

          // 4a) Descontar puntos del socio
          tx.update(memberRef, {
            puntos: newPoints,
            ultimaActualizacion: FieldValue.serverTimestamp(),
            ultimoMotivo: `canje cupón ${descuento}`,
          });

          // 4b) Log de movimiento
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

          // 4c) Marcar cupón como usado
          tx.update(cupRef, {
            status: "usado",
            usadoPor: user.id,
            usadoEmail: user.email || null,
            usadoAt: FieldValue.serverTimestamp(),
          });

          // 5) Respuesta
          return { ok: true as const, codigo: String(cupData?.codigo || ""), newPoints, cost: costo };
        });

        if (!result.ok) {
          if (result.reason === "insufficient_points") {
            return json(res, 409, {
              error: "insufficient_points",
              need: (result as any).need,
              have: (result as any).have,
            });
          }
          if (result.reason === "no_available") {
            return json(res, 404, { error: "no_available" });
          }
          if (result.reason === "member_not_found") {
            return json(res, 404, { error: "member_not_found" });
          }
          return json(res, 400, { error: "bad_request" });
        }

        return json(res, 200, {
          codigo: result.codigo,
          newPoints: result.newPoints,
          cost: result.cost,
        });
      } catch (e) {
        // Si Firestore pide índice compuesto (descuento + status), crealo desde el link del error
        console.error("[POST /api/coupons claim] error", e);
        return json(res, 500, { error: "Internal error" });
      }
    }

    /* ====== CREATE ====== */
    if (action === "create") {
      const descuento = body?.descuento as Descuento;
      const codigo = String(body?.codigo || "").trim();

      if (!["10%", "20%", "40%"].includes(descuento as any)) {
        return json(res, 400, { error: "Invalid descuento" });
      }
      if (!codigo) {
        return json(res, 400, { error: "Invalid codigo" });
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
        return json(res, 200, { id: ref.id });
      } catch (e) {
        console.error("[POST /api/coupons create] error", e);
        return json(res, 500, { error: "Internal error" });
      }
    }

    /* ====== SAVE COSTS ====== */
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
        return json(res, 200, { ok: true });
      } catch (e) {
        console.error("[POST /api/coupons save_costs] error", e);
        return json(res, 500, { error: "Internal error" });
      }
    }

    return json(res, 400, { error: "Invalid POST action" });
  }

  return json(res, 405, { error: "Method not allowed" });
}
