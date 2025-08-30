// api/email/verify.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { transporter } from "../_lib/email";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    await transporter.verify();
    res.json({ ok: true, msg: "SMTP listo 👌" });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message, code: e?.code, response: e?.response });
  }
}
