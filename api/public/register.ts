// api/public/register.ts
import { adminDb, Timestamp } from "../_lib/firebase";
import { sendEmail } from "../_lib/email";

function renderTemplate(tpl: string, vars: Record<string, any>) {
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => (vars?.[k] ?? "").toString());
}

async function getTemplateByKey(key: string) {
  try {
    const ref = adminDb.doc("settings/automations");
    const snap = await ref.get();
    if (snap.exists) {
      const data: any = snap.data() || {};
      const c = data[key] || data[`${key}Email`];
      if (c?.subject || c?.body) {
        return {
          from: c.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
          subject: c.subject || "",
          body: c.body || "",
          enabled: c.enabled !== false,
        };
      }
    }
  } catch (e) {
    console.warn("[getTemplateByKey] firestore error:", e);
  }
  return {
    from: `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: `Bienvenido`,
    body: `<p>Hola {{nombre}}, tu ID es {{id}}.</p>`,
    enabled: true,
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { nombre, apellido, email, password } = req.body ?? {};
    if (
      !nombre || !String(nombre).trim() ||
      !apellido || !String(apellido).trim() ||
      !email || !String(email).includes("@") ||
      !password || String(password).length < 8 || String(password).length > 72
    ) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }

    const clean = {
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      email: String(email).trim().toLowerCase(),
    };

    // Duplicado por email
    const dup = await adminDb
      .collection("suscriptores")
      .where("email", "==", clean.email)
      .limit(1)
      .get();
    if (!dup.empty) {
      return res.status(409).json({ ok: false, error: "El email ya está registrado" });
    }

    // Hash (en serverless usá bcryptjs del server si ya lo tenés)
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(String(password), 12);

    // Transacción
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

    // Email (no bloqueante)
    try {
      const tpl = await getTemplateByKey("welcome");
      if (tpl.enabled) {
        const ctx = { ...result, puntos: 0, delta: 0 };
        const subject = renderTemplate(tpl.subject, ctx);
        const html = renderTemplate(tpl.body, ctx);
        await sendEmail({ to: result.email, subject, html, from: tpl.from });
      }
    } catch (e) {
      console.warn("[welcome email] fallo no bloqueante:", e);
    }

    return res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    // 👇 Esto aparece en **Functions Logs** de Vercel
    console.error("[api/public/register] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Error al registrar" });
  }
}
