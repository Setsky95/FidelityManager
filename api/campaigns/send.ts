// api/campaigns/send.ts
import { adminDb } from "../_lib/firebase.js";
import { sendEmail } from "../_lib/email.js";
import { renderTemplate } from "../_lib/templates.js";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { campaignId, to, data } = req.body || {};
    if (!campaignId || !to) return res.status(400).json({ ok: false, error: "Falta campaignId o to" });

    const doc = await adminDb.collection("campaigns").doc(String(campaignId)).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "Campaña no encontrada" });
    const c: any = doc.data();

    // Contexto para placeholders (promoTexto, promoPrecio, promoFecha, + cualquier otro)
    const ctx = {
      promoTexto: c.promoTexto || "",
      promoPrecio: c.promoPrecio || "",
      promoFecha: c.promoFecha || "",
      ...(data || {}), // permite sobreescribir al enviar
    };

    const subject = renderTemplate(c.subject || "", ctx);
    const html = renderTemplate(c.body || "", ctx);

    const info = await sendEmail({
      to,
      subject,
      html,
      from: c.from,
    });

    return res.status(200).json({ ok: true, messageId: info?.messageId });
  } catch (e: any) {
    console.error("[/api/campaigns/send] err", e?.response || e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error", response: e?.response });
  }
}
