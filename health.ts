import { adminDb } from "../_lib/firebase.js";

export default async function handler(_req: any, res: any) {
  try {
    // comprobar lectura en Firestore
    await adminDb.collection("_").limit(1).get();
    return res.json({
      ok: true,
      envs: {
        FIREBASE_SERVICE_ACCOUNT_JSON: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
        FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID || null,
        GMAIL_USER: process.env.GMAIL_USER || null,
        JWT_SECRET: !!process.env.JWT_SECRET,
      }
    });
  } catch (e: any) {
    console.error("[debug/health] error:", e);
    return res.status(500).json({ ok: false, error: e?.message });
  }
}
