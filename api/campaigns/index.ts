// api/campaigns/index.ts
import { adminDb } from "../_lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const snap = await adminDb.collection("campaigns").orderBy("createdAt", "desc").get();
      const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, campaigns });
    }

    if (req.method === "POST") {
      const { name, from, subject, body } = req.body || {};
      if (!name || !subject || !body) return res.status(400).json({ ok: false, error: "Faltan campos" });
      const now = Timestamp.now();
      const ref = adminDb.collection("campaigns").doc();
      await ref.set({
        id: ref.id,
        name: String(name),
        enabled: true,
        from: from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
        subject: String(subject),
        body: String(body),
        createdAt: now,
        updatedAt: now,
      });
      const doc = await ref.get();
      return res.status(201).json({ ok: true, campaign: doc.data() });
    }

    return res.status(405).end();
  } catch (e: any) {
    console.error("[/api/campaigns] err", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
