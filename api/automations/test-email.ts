import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getTemplateByKey, renderTemplate } from "../_lib/templates";
import { sendEmail } from "../email";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { to, template, key, data } = req.body ?? {};
    if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

    const tpl = template && (template.subject || template.body)
      ? {
          from: template.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
          subject: String(template.subject || ""),
          body: String(template.body || ""),
          enabled: true,
        }
      : await getTemplateByKey(key || "welcome");

    if (tpl.enabled === false) return res.status(400).json({ ok: false, error: "Template deshabilitado" });

    const sample = { nombre: "Seba", apellido: "Pavlotsky", email: to, id: "VG999", puntos: 123, delta: 45, threshold: 200 };
    const ctx = { ...sample, ...(data || {}) };
    const subject = renderTemplate(tpl.subject || "Test automation", ctx);
    const html = renderTemplate(tpl.body || "<p>Hola {{nombre}}, este es un test.</p>", ctx);

    const info = await sendEmail({ to, subject, html, from: tpl.from });
    return res.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Error automations/test-email" });
  }
}
