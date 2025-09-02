// IMPORTS **con .js**
import { adminDb } from "../_lib/firebase.js";
import { sendEmail } from "../_lib/email.js";
import { getTemplateByKey, renderTemplate } from "../_lib/templates.js";
import { Timestamp } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const ALLOWED_PROFILE_PICTURES = new Set(["1.webp", "2.webp", "3.webp", "4.webp"]);

/** Normaliza el valor recibido:
 *  - Acepta "1.webp" o "/Profile-Pictures/1.webp"
 *  - Devuelve siempre "1.webp" (solo el filename)
 *  - Si no es válido, devuelve el default ("1.webp")
 */
function normalizeProfilePicture(input: unknown): string {
  if (typeof input !== "string") return "1.webp";
  const trimmed = input.trim();
  const justFile = trimmed.replace(/^\/?Profile-Pictures\//i, "");
  return ALLOWED_PROFILE_PICTURES.has(justFile) ? justFile : "1.webp";
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

    // 👉 normalizamos/validamos la foto de perfil
    const profilePic = normalizeProfilePicture(profilePicture);

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
        // 🆕 guarda el filename elegido (el frontend arma la URL con /Profile-Pictures/${filename})
        profilePicture: profilePic,
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

      return { id, numero, nombre: clean.nombre, apellido: clean.apellido, email: clean.email, profilePicture: profilePic };
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
          // si querés usar la imagen en la plantilla:
          profilePicture: result.profilePicture, // opcional
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
