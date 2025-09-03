// api/campaigns.ts
import { adminDb } from "../_lib/firebase.js";
import { sendEmail } from "../_lib/email.js";
import { renderTemplate } from "../_lib/templates.js";

// Colección en Firestore
const COLLECTION = "campaigns";

export default async function handler(req: any, res: any) {
  try {
    const { method, query, body } = req;
    const { id } = query || {};

    switch (method) {
      case "GET": {
        if (id) {
          // 🔹 Traer 1 campaña
          const snap = await adminDb.collection(COLLECTION).doc(id).get();
          if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
          return res.json({ ok: true, campaign: snap.data() });
        } else {
          // 🔹 Listar campañas
          const snap = await adminDb.collection(COLLECTION).get();
          const campaigns = snap.docs.map((d) => d.data());
          return res.json({ ok: true, campaigns });
        }
      }

      case "POST": {
        if (id) {
          // 🔹 Enviar campaña existente
          const snap = await adminDb.collection(COLLECTION).doc(id).get();
          if (!snap.exists) return res.status(404).json({ ok: false, error: "Not found" });
          const campaign: any = snap.data();

          // mandá a todos o a lista fija
          for (const to of campaign.recipients || []) {
            await sendEmail({
              to,
              subject: renderTemplate(campaign.subject, campaign),
              html: renderTemplate(campaign.body, campaign),
              from: campaign.from,
            });
          }

          return res.json({ ok: true, sent: true });
        } else {
          // 🔹 Crear nueva campaña
          const ref = adminDb.collection(COLLECTION).doc();
          const campaign = { id: ref.id, ...body, createdAt: new Date().toISOString() };
          await ref.set(campaign);
          return res.status(201).json({ ok: true, campaign });
        }
      }

      case "PUT": {
        if (!id) return res.status(400).json({ ok: false, error: "Falta id" });
        await adminDb.collection(COLLECTION).doc(id).update(body);
        return res.json({ ok: true });
      }

      case "DELETE": {
        if (!id) return res.status(400).json({ ok: false, error: "Falta id" });
        await adminDb.collection(COLLECTION).doc(id).delete();
        return res.json({ ok: true });
      }

      default:
        return res.status(405).end();
    }
  } catch (e: any) {
    console.error("[/api/campaigns] unhandled:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
