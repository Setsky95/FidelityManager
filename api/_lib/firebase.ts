 // api/_lib/firebase.ts
import admin from "firebase-admin";

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON faltante");
  try {
    // Acepta tanto con \n escapados como multilínea
    const json = JSON.parse(raw);
    if (typeof json.private_key === "string") {
      json.private_key = json.private_key.replace(/\\n/g, "\n");
    }
    return json;
  } catch (e: any) {
    // Si vino multilínea válida pero falló por alguna razón, reintento simple
    const fixed = raw.replace(/\\n/g, "\n");
    return JSON.parse(fixed);
  }
}

// Evita re-inicializar en caliente (capa global de la función)
const app =
  admin.apps.length > 0
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(loadServiceAccount() as any),
        projectId:
          process.env.FIREBASE_ADMIN_PROJECT_ID ||
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}")
            .project_id,
      });

export const adminDb = admin.firestore(app);
adminDb.settings({ ignoreUndefinedProperties: true });
