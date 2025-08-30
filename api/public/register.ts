// api/public/register.ts
import bcrypt from "bcryptjs";
import { adminDb, Timestamp } from "../_lib/firebase";
import { getTemplateByKey, renderTemplate } from "../_lib/templates"; // si los tenés ahí
import { sendEmail } from "../_lib/email"; // no debe tirar la respuesta si falla

// Helper: leer JSON del body en Vercel
async function readJson(req: any) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const e: any = new Error("Invalid JSON");
    e.status = 400;
    throw e;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const { nombre, apellido, email, password } = await readJson(req);

    // Validación mínima
    if (
      !nombre || typeof nombre !== "string" || !nombre.trim() ||
      !apellido || typeof apellido !== "string" || !apellido.trim() ||
      !email || typeof email !== "string" || !email.includes("@") ||
      !password || typeof password !== "string" || password.length < 8 || password.length > 72
    ) {
      res.status(400).json({ ok: false, error: "Datos inválidos" });
      return;
    }

    const clean = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim().toLowerCase(),
    };

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await adminDb.runTransaction(async (tx) => {
      // correlativo
      const seqRef = adminDb.doc("meta/sequences");
      const seqSnap = await tx.get(seqRef);
      const current = seqSnap.exists ? Number(seqSnap.data()?.membersNext || 1) : 1;
      const next = current + 1;
      tx.set(seqRef, { membersNext: next }, { merge: true });

      // socio
      const numero = current;
      const id = `VG${numero}`;
      const now = Timestamp.now();
      const memberRef = adminDb.doc(`suscriptores/${id}`);
      tx.set(memberRef, {
        id,
        numero,
        nombre: clean.nombre,
        apellido: clean.apellido,
        email: clean.email,
        puntos: 0,
        passwordHash,
        fechaRegistro: now,
        ultimaActualizacion: now,
        ultimoMotivo: "Registro público",
      });

      // log
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

    // Email de bienvenida (no bloqueante)
    (async () => {
      try {
        const tpl = await getTemplateByKey("welcome");
        if (tpl?.enabled !== false) {
          const ctx = { ...result, puntos: 0, delta: 0 };
          const subject = renderTemplate(tpl.subject || "¡Bienvenido/a, {{nombre}}!", ctx);
          const html = renderTemplate(tpl.body || "<p>Hola {{nombre}}</p>", ctx);
          await sendEmail({ to: result.email, subject, html, from: tpl.from });
        }
      } catch (e) {
        console.warn("[welcome email] fallo no bloqueante:", e);
      }
    })().catch(() => { /* no-op */ });

    res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    console.error("[/api/public/register] error:", e);
    const status = e?.status || 500;
    res.status(status).json({ ok: false, error: e?.message || "Server error" });
  }
}
