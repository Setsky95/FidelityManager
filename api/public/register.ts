// IMPORTS **con .js**
import { adminDb } from "../_lib/firebase.js";
import { sendEmail } from "../_lib/email.js";
import { getTemplateByKey, renderTemplate } from "../_lib/templates.js";
import { Timestamp } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

/** Helpers URL */
function isAbsoluteUrl(v?: string) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function getPublicBaseUrl(): string {
  let base =
    process.env.PROFILE_PICTURES_BASE_URL || // opcional: CDN/host externo para avatares
    process.env.PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/+$/g, "");
}

/** Normaliza el valor recibido:
 *  - Si es URL absoluta, la deja tal cual (ideal para CRC tipo imgfz.com).
 *  - Si es filename (1.jpg / 1.webp o con /Profile-Pictures/), normaliza a .jpg
 *    y arma una URL absoluta usando la base pública.
 *  - Si no viene o es inválido, usa 1.jpg
 */
function normalizeProfilePicture(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    input = "1.jpg";
  }
  let v = input.trim();

  // Caso 1: ya es URL absoluta (p.ej., https://imgfz.com/i/xxx.jpeg)
  if (isAbsoluteUrl(v)) return v;

  // Caso 2: filename / ruta relativa -> normalizar a .jpg
  const just = v.replace(/^\/?Profile-Pictures\//i, "");
  const m = /^([1-4])\.(jpe?g|webp)$/i.exec(just);
  const file = m ? `${m[1]}.jpg` : "1.jpg";

  const base = getPublicBaseUrl();
  // Si hay base, devolvemos absoluta (recomendado para emails); si no, relativa
  return base ? `${base}/Profile-Pictures/${file}` : `/Profile-Pictures/${file}`;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { nombre, apellido, email, password, profilePicture } = req.body ?? {};
    if (
      !nombre || typeof nombre !== "string" || !nombre.trim() ||
      !apellido || typeof apellido !== "string" || !apellido.trim() ||
      !email || typeof email !== "string" || !email.includes("@") ||
      !password || typeof password !== "string" || password.length < 8 || password.length > 72
    ) {
      return res.status(400).json({ ok: false, error: "Datos inválidos" });
    }

    // 👉 normalizamos/validamos la foto de perfil a URL (absoluta si es posible)
    const profilePicUrl = normalizeProfilePicture(profilePicture);

    const clean = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim().toLowerCase(),
    };

    // Duplicado por email
    const dup = await adminDb
      .collection("suscriptores")
      .where("email", "==", clean.email)
      .limit(1)
      .get();
    if (!dup.empty) return res.status(409).json({ ok: false, error: "El email ya está registrado" });

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
        // 🆕 guarda el URL (absoluto si hay base)
        profilePicture: profilePicUrl,
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

      return {
        id,
        numero,
        nombre: clean.nombre,
        apellido: clean.apellido,
        email: clean.email,
        profilePicture: profilePicUrl,
      };
    });

    // Email de bienvenida (no bloqueante)
    try {
      const tpl = await getTemplateByKey("welcome");
      if (tpl.enabled) {
        const ctx = {
          nombre: result.nombre,
          apellido: result.apellido,
          email: result.email,
          id: result.id,
          puntos: 0,
          delta: 0,
          // Para plantillas:
          profilePicture: result.profilePicture,     // por compatibilidad
          profilePictureUrl: result.profilePicture,  // asegura absoluta en el template
          year: new Date().getFullYear(),
        };
        await sendEmail({
          to: result.email,
          subject: renderTemplate(tpl.subject, ctx),
          html: renderTemplate(tpl.body, ctx),
          from: tpl.from,
        });
      }
    } catch (e) {
      console.warn("[welcome email] fallo no bloqueante:", e);
    }

    return res.status(201).json({ ok: true, member: result });
  } catch (e: any) {
    console.error("[/api/public/register] unhandled:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
