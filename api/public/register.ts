import { Timestamp } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { adminDb } from "../_lib/firebase";
import { sendEmail } from "../_lib/email";
import { getTemplateByKey, renderTemplate } from "../_lib/templates";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { nombre, apellido, email, password } = req.body ?? {};
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
      return res.status(400).json({ ok: false, error: "Password inválido" });
    }

    const clean = {
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      email: String(email).trim().toLowerCase(),
    };
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await adminDb.runTransaction(async (tx) => {
      const seqRef = adminDb.doc("meta/sequences");
      const seqSnap = await tx.get(seqRef);
      const current = seqSnap.exists ? Number(seqSnap.data()?.membersNext || 1) : 1;
      const next = current + 1;
      tx.set(seqRef, { membersNext: next }, { merge: true });

      const numero = current;
      const id = `VG${numero}`;
      const now = Timestamp.now();
      const memberRef = adminDb.doc(`suscriptores/${id}`);

      tx.set(memberRef, {
        id, numero,
        nombre: clean.nombre,
        apellido: clean.apellido,
        email: clean.email,
        puntos: 0,
        passwordHash,
        fechaRegistro: now,
        ultimaActualizacion: now,
        ultimoMotivo: "Registro público",
      });

      const movRef = adminDb.collection("movimientos").doc();
      tx.set(movRef, {
        memberId: id,
        memberIdNumber: numero,
        memberName: `${clean.nombre} ${clean.apellido}`.trim(),
        email: clean.email,
        type: "create",
        delta: 0,
        previousPoints: 0,
        newPoints: 0,
        reason: "Registro público",
        createdAt: now,
      });

      return { id, numero, nombre: clean.nombre, apellido: clean.apellido, email: clean.email };
    });

    // 🔔 Welcome (no bloqueante)
    (async () => {
      try {
        const tpl = await getTemplateByKey("welcome");
        if (tpl.enabled !== false) {
          const data = { ...result, puntos: 0, delta: 0 };
          const subject = renderTemplate(tpl.subject, data);
          const html    = renderTemplate(tpl.body, data);
          console.log("[welcome] sending to", result.email);
          await sendEmail({ to: result.email, subject, html, from: tpl.from });
          console.log("[welcome] sent");
        } else {
          console.log("[welcome] template disabled");
        }
      } catch (e) {
        console.warn("[welcome] error (non-blocking):", e);
      }
    })();

    return res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    console.error("[/api/public/register] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Error al registrar" });
  }
}
