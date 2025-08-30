import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb } from "../_lib/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ref = adminDb.doc("settings/automations");

    if (req.method === "GET") {
      const snap = await ref.get();
      return res.json({ ok: true, data: snap.exists ? snap.data() : {} });
    }

    if (req.method === "PUT") {
      const body = req.body;
      if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "Payload inválido" });
      await ref.set(body, { merge: true });
      return res.json({ ok: true });
    }

    return res.status(405).end();
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Error automations/settings" });
  }
}
