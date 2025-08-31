// api/_lib/firebase.ts
import * as admin from "firebase-admin";

// ---------- helpers ----------
function getProjectIdFromEnv(): string | undefined {
  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID) return process.env.FIREBASE_ADMIN_PROJECT_ID;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) return JSON.parse(raw).project_id as string | undefined;
  } catch {/* ignore */}
  return undefined;
}

function getServiceAccountFromEnv():
  | (admin.ServiceAccount & { private_key?: string })
  | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;

  // soporta \n escapados
  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed as admin.ServiceAccount;
}

// ---------- single init (serverless-safe) ----------
let app: admin.app.App | undefined;

function initApp() {
  if (app) return app;

  const projectId = getProjectIdFromEnv();

  try {
    const sa = getServiceAccountFromEnv();
    if (sa) {
      app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert(sa),
            projectId: (sa as any).project_id || projectId,
          });
    } else {
      // fallback si no hay JSON en env
      app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId,
          });
    }
  } catch (e) {
    console.error("[firebase] init failed:", e);
    throw e;
  }

  return app;
}

// ---------- exports ----------
const firebaseApp = initApp();

export const adminDb = admin.firestore(firebaseApp);
adminDb.settings({ ignoreUndefinedProperties: true });

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
