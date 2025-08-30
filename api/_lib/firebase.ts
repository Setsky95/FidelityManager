import admin from "firebase-admin";

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  const creds = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || creds.project_id,
  });
}

export const adminDb = admin.firestore();
export const Timestamp = admin.firestore.Timestamp;
