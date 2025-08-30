import { sendEmail, transporter } from "../_lib/email.js";

export default async function handler(req: any, res: any) {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

    const info = await sendEmail({
      to,
      subject: "Prueba — Van Gogh Fidelidad",
      html: "<div>Funciona 💥</div>",
    });

    res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message, code: e?.code, response: e?.response });
  }
}
