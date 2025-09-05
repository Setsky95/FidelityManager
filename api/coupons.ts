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
      // Si tenés custom claim `admin: true`, queda disponible acá
      isAdmin: (decoded as any).admin === true,
      raw: decoded,
    };
  } catch {
    return null;
  }
}

// 2) Fallback: cookie vg_session firmada con JWT_SECRET (como ya tenías)
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
      // si guardaste role en el JWT, podés usarlo:
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

/* =========================
   Handler
   ========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // 👉 Si querés restringir solo a admins, descomentá esta línea:
  // if (!user.isAdmin) { res.status(403).json({ error: "Not authorized" }); return; }

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

        // Reclamar cupón (usuario autenticado)
    if (action === "claim") {
      const descuento = String(body?.descuento || "");
      if (!["10%", "20%", "40%"].includes(descuento)) {
        res.status(400).json({ error: "Invalid descuento" });
        return;
      }

      try {
        const result = await adminDb.runTransaction(async (tx) => {
          const q = adminDb
            .collection("cupones")
            .where("descuento", "==", descuento)
            .where("status", "==", "disponible")
            .limit(1);

          const snap = await tx.get(q);
          if (snap.empty) {
            return { ok: false as const, reason: "no_available" };
          }

          const doc = snap.docs[0];
          const ref = doc.ref;
          const data = doc.data() as any;

          // Actualizo estado a usado
          tx.update(ref, {
            status: "usado",
            usadoPor: user.id,
            usadoEmail: user.email || null,
            usadoAt: FieldValue.serverTimestamp(),
          });

          return { ok: true as const, codigo: String(data?.codigo || "") };
        });

        if (!result.ok) {
          res.status(404).json({ error: "No hay cupones disponibles para ese descuento" });
          return;
        }

        // Devuelvo el código
        res.status(200).json({ codigo: result.codigo });
      } catch (e: any) {
        // Si falta índice compuesto (descuento + status), Firestore suele tirar failed-precondition
        console.error("[POST /api/coupons claim] error", e);
        res.status(500).json({ error: "Internal error" });
      }
      return;
    }


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
