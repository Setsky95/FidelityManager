// api/members/points-add.ts
// Suma puntos a un socio y dispara:
//  - pointsAdd (siempre que amount > 0)
//  - pointsThreshold (si cruza el umbral configurado)

import { adminDb, Timestamp } from "../_lib/firebase.js";
import { sendEmail } from "../_lib/email.js";

/** Reemplazo de {{variable}} simple */
function renderTemplate(tpl: string, vars: Record<string, any>) {
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) =>
    (vars?.[k] ?? "").toString()
  );
}

async function readAutomationsSettings(): Promise<any> {
  try {
    const ref = adminDb.doc("settings/automations");
    const snap = await ref.get();
    return snap.exists ? (snap.data() || {}) : {};
  } catch {
    return {};
  }
}

/** Toma una plantilla de settings/automations.
 *  Acepta tanto "pointsAdd" como "pointsAddEmail" (backcompat) */
function pickTemplate(settings: any, key: string) {
  const c = settings?.[key] || settings?.[`${key}Email`] || {};
  return {
    from: c.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: c.subject || "",
    body: c.body || "",
    enabled: c.enabled !== false,
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { memberId, amount, reason } = req.body ?? {};
    const delta = Number(amount);
    if (!memberId || !Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }

    const now = Timestamp.now();
    const memberRef = adminDb.doc(`suscriptores/${memberId}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(memberRef);
      if (!snap.exists) throw new Error("Socio no encontrado");

      const data = snap.data() as any;
      const prev = Number(data?.puntos || 0);
      const next = prev + delta;

      // update socio
      tx.update(memberRef, {
        puntos: next,
        ultimaActualizacion: now,
        ultimoMotivo: reason || "Carga rápida",
      });

      // log movimiento
      const movRef = adminDb.collection("movimientos").doc();
      tx.set(movRef, {
        memberId,
        memberIdNumber: Number(data?.numero || 0),
        memberName: `${data?.nombre || ""} ${data?.apellido || ""}`.trim(),
        email: data?.email || "",
        type: "add",
        delta,
        previousPoints: prev,
        newPoints: next,
        reason: reason || "Carga rápida",
        createdAt: now,
      });

      return {
        member: {
          id: data.id,
          numero: Number(data.numero || 0),
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          email: data.email || "",
          profilePicture: data.profilePicture || null, // 👈 añadimos por si lo usa el template
        },
        prev,
        next,
      };
    });

    // ====== Emails (NO BLOQUEANTES) ======
    const settings = await readAutomationsSettings();

    // 1) pointsAdd
    try {
      const tplAdd = pickTemplate(settings, "pointsAdd");
      if (tplAdd.enabled && result.member.email) {
        const ctx = {
          nombre: result.member.nombre,
          apellido: result.member.apellido,
          email: result.member.email,
          id: result.member.id,
          puntos: result.next, // total actual
          delta,               // lo que se sumó
          profilePicture: result.member.profilePicture,
          profilePictureUrl: result.member.profilePicture,
        };
        const subject = renderTemplate(tplAdd.subject || "¡Sumaste puntos!", ctx);
        const html = renderTemplate(
          tplAdd.body || "<p>Hola {{nombre}}, sumaste {{delta}} puntos. Total: {{puntos}}.</p>",
          ctx
        );
        await sendEmail({ to: result.member.email, subject, html, from: tplAdd.from });
      }
    } catch (e) {
      console.warn("[pointsAdd email] fallo no bloqueante:", e);
      // no interrumpe la respuesta
    }

    // 2) pointsThreshold — sólo si cruzó el umbral (prev < thr <= next)
    try {
      const threshold =
        Number(settings?.pointsThreshold?.threshold ??
               settings?.pointsThresholdEmail?.threshold ??
               settings?.threshold ??
               200);

      const crossed =
        Number.isFinite(threshold) && result.prev < threshold && result.next >= threshold;

      if (crossed) {
        const tplThr = pickTemplate(settings, "pointsThreshold");
        if (tplThr.enabled && result.member.email) {
          const ctx = {
            nombre: result.member.nombre,
            apellido: result.member.apellido,
            email: result.member.email,
            id: result.member.id,
            puntos: result.next,
            delta,
            threshold,
            profilePicture: result.member.profilePicture,
            profilePictureUrl: result.member.profilePicture,
          };
          const subject = renderTemplate(
            tplThr.subject || "¡Llegaste a {{threshold}} puntos! 🎉",
            ctx
          );
          const html = renderTemplate(
            tplThr.body ||
              "<p>Hola {{nombre}}, alcanzaste {{threshold}} puntos. Tu total actual es {{puntos}}.</p>",
            ctx
          );
          await sendEmail({ to: result.member.email, subject, html, from: tplThr.from });
        }
      }

      return res.json({
        ok: true,
        memberId: result.member.id,
        previousPoints: result.prev,
        newPoints: result.next,
        delta,
        thresholdCrossed: crossed || false,
      });
    } catch (e) {
      console.warn("[pointsThreshold email] fallo no bloqueante:", e);
      // devolvemos igual éxito de suma de puntos
      return res.json({
        ok: true,
        memberId: result.member.id,
        previousPoints: result.prev,
        newPoints: result.next,
        delta,
        thresholdCrossed: false,
      });
    }
  } catch (e: any) {
    console.error("[api/members/points-add] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Error al sumar puntos" });
  }
}
