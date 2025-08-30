// api/public/register.ts
import { adminDb } from "../_lib/firebase";
import bcrypt from "bcryptjs";

function bad(res: any, code: number, msg: string) {
  res.status(code).json({ ok: false, error: msg });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return bad(res, 405, "Method not allowed");
  }

  try {
    const { nombre, apellido, email, password } = req.body || {};

    if (
      !nombre || typeof nombre !== "string" || !nombre.trim() ||
      !apellido || typeof apellido !== "string" || !apellido.trim() ||
      !email || typeof email !== "string" || !email.includes("@") ||
      !password || typeof password !== "string" || password.length < 8 || password.length > 72
    ) {
      return bad(res, 400, "Datos inválidos");
    }

    const clean = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim().toLowerCase(),
    };

    const passwordHash = await bcrypt.hash(password, 12);

    // === Transacción: generar secuencia y crear socio ===
    const result = await adminDb.runTransaction(async (tx) => {
      const seqRef = adminDb.doc("meta/sequences");
      const seqSnap = await tx.get(seqRef);
      const current = seqSnap.exists
        ? Number((seqSnap.data() as any)?.membersNext || 1)
        : 1;
      const next = current + 1;
      tx.set(seqRef, { membersNext: next }, { merge: true });

      const numero = current;
      const id = `VG${numero}`;
      const now = new Date();
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

    // (Opcional) Si querés disparar el mail acá, hacelo try/catch y NO bloquees la respuesta.
    // import { sendEmail } from "../_lib/email";  // si lo tenés
    // sendEmail({ to: result.email, subject, html }).catch(e => console.warn("[welcome email]", e));

    return res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    console.error("[/api/public/register] error:", e);
    // <<< Devuelve SIEMPRE JSON, así tu onSubmit lo muestra bien >>>
    return bad(res, 500, e?.message || "Server error");
  }
}
