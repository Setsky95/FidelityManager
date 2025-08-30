// server/firebase.ts
import { getApps, initializeApp, applicationDefault, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { adminDb } from "./firebase";

function initAdmin(): App {
  if (getApps().length) {
    return getApps()[0]!;
  }

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const explicitProjectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID;

  if (inlineJson) {
    // ➜ Credenciales por ENV con JSON inline
    let creds: any;
    try {
      creds = JSON.parse(inlineJson);
    } catch (e) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido. Verificá comillas/escapes."
      );
    }

    if (!creds.project_id && !explicitProjectId) {
      throw new Error(
        "Falta projectId: agregá project_id dentro del JSON o seteá GOOGLE_CLOUD_PROJECT/FIREBASE_ADMIN_PROJECT_ID."
      );
    }

    return initializeApp({
      credential: cert(creds),
      projectId: creds.project_id || explicitProjectId, // 👈 fuerza projectId
    });
  }

  // ➜ Credenciales por archivo (GOOGLE_APPLICATION_CREDENTIALS)
  if (!explicitProjectId) {
    // applicationDefault no siempre infiere el projectId en local
    // lo pedimos explícito para evitar el error de Project Id
    console.warn(
      "[firebase-admin] No se detectó FIREBASE_SERVICE_ACCOUNT_JSON. Usando applicationDefault(). " +
        "Seteá GOOGLE_CLOUD_PROJECT o FIREBASE_ADMIN_PROJECT_ID para evitar 'Unable to detect a Project Id'."
    );
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: explicitProjectId, // 👈 si no viene del entorno de gcloud, lo forzamos
  });
}

const adminApp = initAdmin();
export const adminDb = getFirestore(adminApp);
