import { sendEmail, transporter } from "../_lib/email.js";

export default async function handler(_req: any, res: any) {
  try {
    await transporter.verify();
    res.status(200).json({ ok: true, msg: "SMTP listo 👌" });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message, code: e?.code, response: e?.response });
  }
}
