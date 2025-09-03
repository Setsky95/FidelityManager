// api/automations/test-emails.ts
import { sendEmail } from "../_lib/email.js";
import { getTemplateByKey, renderTemplate } from "../_lib/templates.js";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { to, template, key, data } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

    // 1) Resolver plantilla: prioridad a key; si no, usar template inline; si no, fallback simple
    const tpl = key
      ? await getTemplateByKey(key)
      : (template ?? {
          from: undefined,
          subject: "Test automation",
          body: "<p>Hola {{nombre}}, este es un test.</p>",
          enabled: true,
        });

    // 2) Datos sample (se pueden sobrescribir con `data`)
    const sampleCtx = {
      nombre: "Seba",
      apellido: "User",
      email: to,
      id: "VG999",
      puntos: 123,
      delta: 50,
      threshold: 200,
      // 👇 importante para probar avatar. Puede venir como "1.webp" o "/Profile-Pictures/1.webp"
      profilePicture: "1.webp",
      // Permito override desde el body
      ...(data || {}),
    };

    // 3) Render de subject + body (renderTemplate ya agrega profilePictureUrl)
    const subject = renderTemplate(tpl.subject || "Test automation", sampleCtx);
    const html = renderTemplate(tpl.body || "<p>Hola {{nombre}}, este es un test.</p>", sampleCtx);

    // 4) Envío
    const info = await sendEmail({
      to,
      subject,
      html,
      from: tpl.from, // si coincide con GMAIL_USER o está en GMAIL_ALLOWED_FROM, se respeta
    });

    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    console.error("[/api/automations/test-emails] error:", e);
    return res.status(500).json({ ok: false, error: e?.message, response: e?.response });
  }
}
