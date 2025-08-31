import { sendEmail } from "../_lib/email.js";
import { getTemplateByKey, renderTemplate } from "../_lib/templates.js";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { to, data, key, template } = req.body ?? {};
    if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

    const tpl = template && (template.subject || template.body)
      ? { from: template.from, subject: String(template.subject || ""), body: String(template.body || ""), enabled: true }
      : await getTemplateByKey(key || "pointsAdd");

    if (tpl.enabled === false) return res.status(400).json({ ok: false, error: "Template deshabilitado" });

    const subject = renderTemplate(tpl.subject, data || {});
    const html = renderTemplate(tpl.body, data || {});
    const info = await sendEmail({ to, subject, html, from: tpl.from });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    console.error("[automations.points-add] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
