import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, Timestamp } from "../_lib/firebase";
import { getTemplateByKey, renderTemplate } from "../_lib/templates";
import { sendEmail } from "../email";
import bcrypt from "bcryptjs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { nombre, apellido, email, password } = req.body ?? {};
    if (!nombre?.trim() || !apellido?.trim() || !email?.includes("@") || typeof password !== "string" || password.length < 8)
      return res.status(400).json({ ok: false, error: "Datos inválidos" });

    const clean = { nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim().toLowerCase() };
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await adminDb.runTransaction(async (tx) => {
      const seqRef = adminDb.doc("meta/sequences");
      const seqSnap = await tx.get(seqRef);
      const current = seqSnap.exists ? Number(seqSnap.data()?.membersNext || 1) : 1;
      tx.set(seqRef, { membersNext: current + 1 }, { merge: true });

      const id = `VG${current}`;
      const now = Timestamp.now();

      tx.set(adminDb.doc(`suscriptores/${id}`), {
        id, numero: current, nombre: clean.nombre, apellido: clean.apellido, email: clean.email,
        puntos: 0, passwordHash, fechaRegistro: now, ultimaActualizacion: now, ultimoMotivo: "Registro público",
      });

      const movRef = adminDb.collection("movimientos").doc();
      tx.set(movRef, {
        memberId: id, memberIdNumber: current, memberName: `${clean.nombre} ${clean.apellido}`.trim(),
        email: clean.email, type: "create", delta: 0, previousPoints: 0, newPoints: 0, reason: "Registro público", createdAt: now,
      });

      return { id, numero: current, nombre: clean.nombre, apellido: clean.apellido, email: clean.email };
    });

    try {
      const tpl = await getTemplateByKey("welcome");
      if (tpl.enabled) {
        const ctx = { nombre: result.nombre, apellido: result.apellido, email: result.email, id: result.id, puntos: 0, delta: 0 };
        await sendEmail({ to: result.email, subject: renderTemplate(tpl.subject, ctx), html: renderTemplate(tpl.body, ctx), from: tpl.from });
      }
    } catch {}

    return res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Error al registrar" });
  }
}
