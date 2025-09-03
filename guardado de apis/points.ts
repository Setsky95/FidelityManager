import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../api/_lib/firebase";
import { getTemplateByKey, renderTemplate } from "../api/_lib/templates";
import { sendEmail } from "../api/_lib/email";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { id, delta, reason } = req.body ?? {};
    const nDelta = Number(delta);
    if (!id || !Number.isFinite(nDelta)) {
      return res.status(400).json({ ok: false, error: "Payload inválido" });
    }

    const result = await adminDb.runTransaction(async (tx) => {
      const ref = adminDb.doc(`suscriptores/${id}`);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Socio no encontrado");

      const doc: any = snap.data();
      const prev = Number(doc.puntos || 0);
      const next = Math.max(0, prev + nDelta);
      const now = Timestamp.now();

      tx.set(ref, {
        puntos: next,
        ultimaActualizacion: now,
        ultimoMotivo: reason || (nDelta >= 0 ? "Suma de puntos" : "Ajuste"),
      }, { merge: true });

      const movRef = adminDb.collection("movimientos").doc();
      tx.set(movRef, {
        memberId: doc.id,
        memberIdNumber: doc.numero,
        memberName: `${doc.nombre} ${doc.apellido}`.trim(),
        email: doc.email,
        type: nDelta >= 0 ? "add" : "remove",
        delta: nDelta,
        previousPoints: prev,
        newPoints: next,
        reason: reason || null,
        createdAt: now,
      });

      return {
        id: doc.id,
        email: doc.email,
        nombre: doc.nombre,
        apellido: doc.apellido,
        newPoints: next,
        delta: nDelta,
      };
    });

    // 🔔 pointsAdd (solo si delta > 0)
    (async () => {
      if (result.delta > 0) {
        try {
          const tpl = await getTemplateByKey("pointsAdd");
          if (tpl.enabled !== false) {
            const data = {
              nombre: result.nombre,
              apellido: result.apellido,
              email: result.email,
              id: result.id,
              puntos: result.newPoints,
              delta: result.delta,
            };
            const subject = renderTemplate(tpl.subject, data);
            const html    = renderTemplate(tpl.body, data);
            console.log("[pointsAdd] sending to", result.email);
            await sendEmail({ to: result.email, subject, html, from: tpl.from });
            console.log("[pointsAdd] sent");
          } else {
            console.log("[pointsAdd] template disabled");
          }
        } catch (e) {
          console.warn("[pointsAdd] error (non-blocking):", e);
        }
      }
    })();

    return res.json({ ok: true, id: result.id, puntos: result.newPoints });
  } catch (e: any) {
    console.error("[/api/members/points] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Error al actualizar puntos" });
  }
}
