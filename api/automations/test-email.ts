import { sendEmail } from "../_lib/email.js";
import { adminDb } from "../_lib/firebase.js"; // si lo usás

export default async function handler(req: any, res: any) {
  try {
    const { to, template, key, data } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

    // Para test: si no mandan template usamos uno mínimo
    const subject = template?.subject || "Test automation";
    const html = template?.body || "<p>Hola {{nombre}}, este es un test.</p>";
    const ctx = {
      nombre: "Seba",
      ...data,
    };

    const render = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_m, k) => (ctx as any)[k] ?? "");

    const info = await sendEmail({
      to,
      subject: render(subject),
      html: render(html),
      from: template?.from, // si coincide con GMAIL_USER o alias, se respeta
    });

    res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message, response: e?.response });
  }
}
