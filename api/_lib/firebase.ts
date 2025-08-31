// api/_lib/firebase.ts
import admin from "firebase-admin";

// ---------- helpers ----------
function getProjectIdFromEnv(): string | undefined {
  try {
    if (process.env.FIREBASE_ADMIN_PROJECT_ID) return process.env.FIREBASE_ADMIN_PROJECT_ID;
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      // podría venir en JSON o en base64 del JSON
      try {
        return JSON.parse(raw).project_id as string | undefined;
      } catch {
        const decoded = Buffer.from(raw, "base64").toString("utf8");
        return JSON.parse(decoded).project_id as string | undefined;
      }
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function getServiceAccountFromEnv():
  | (admin.ServiceAccount & { private_key?: string })
  | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;

  // Puede venir:
  // 1) JSON directo
  // 2) JSON con \n escapados
  // 3) Base64 del JSON (común en plataformas de deploy)
  let text = raw;
  try {
    // si es base64 válido del JSON
    const maybe = Buffer.from(raw, "base64").toString("utf8");
    if (maybe.includes('"project_id"') && maybe.includes('"private_key"')) {
      text = maybe;
    }
  } catch {
    /* ignore */
  }

  const parsed = JSON.parse(text);
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed as admin.ServiceAccount;
}

// ---------- single init (serverless-safe) ----------
// Reusar entre invocaciones en el mismo runtime
const globalAny = globalThis as unknown as {
  _vgFirebaseApp?: admin.app.App;
};

function initApp() {
  if (globalAny._vgFirebaseApp) return globalAny._vgFirebaseApp;

  const projectId = getProjectIdFromEnv();
  const sa = getServiceAccountFromEnv();

  try {
    if (sa) {
      globalAny._vgFirebaseApp =
        admin.apps.length > 0
          ? admin.app()
          : admin.initializeApp({
              credential: admin.credential.cert(sa),
              projectId: (sa as any).project_id || projectId,
            });
    } else {
      // Fallback: ADC (Application Default Credentials)
      // Requiere que el entorno tenga un proyecto detectado.
      globalAny._vgFirebaseApp =
        admin.apps.length > 0
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

  return globalAny._vgFirebaseApp!;
}

// ---------- exports ----------
const firebaseApp = initApp();

export const adminDb = admin.firestore(firebaseApp);
adminDb.settings({ ignoreUndefinedProperties: true });

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export const adminAuth = admin.auth(firebaseApp);
