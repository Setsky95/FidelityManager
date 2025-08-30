import admin from "firebase-admin";

let app: admin.app.App | undefined;

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");

  const sa = JSON.parse(raw);
  app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || sa.project_id,
  });
} else {
  app = admin.app();
}

export const adminDb = admin.firestore();
export const Timestamp = admin.firestore.Timestamp;
