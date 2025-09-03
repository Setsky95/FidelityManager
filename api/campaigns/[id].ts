// api/campaigns/[id].ts
import { adminDb } from "../_lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ ok: false, error: "Falta id" });

  try {
    const ref = adminDb.collection("campaigns").doc(String(id));

    if (req.method === "PUT") {
      const payload = req.body || {};
      payload.updatedAt = Timestamp.now();
      await ref.set(payload, { merge: true });
      const doc = await ref.get();
      return res.status(200).json({ ok: true, campaign: doc.data() });
    }

    if (req.method === "DELETE") {
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e: any) {
    console.error("[/api/campaigns/[id]] err", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
