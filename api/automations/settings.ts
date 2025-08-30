// api/automations/settings.ts
import { adminDb } from "../_lib/firebase.js";

// (Opcional) CORS simple si pegás desde otro origen
function applyCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") return res.status(200).end();

    const ref = adminDb.doc("settings/automations");

    if (req.method === "GET") {
      const snap = await ref.get();
      return res.status(200).json({ ok: true, data: snap.exists ? snap.data() : {} });
    }

    if (req.method === "PUT") {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ ok: false, error: "Payload inválido" });
      }
      await ref.set(body, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    console.error("[api/automations/settings] error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Error automations/settings" });
  }
}
