// scripts/seedMembers.mjs
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

async function getCredential() {
  // 1) JSON inline por env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  // 2) ruta al archivo (env o service-account.json por defecto)
  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve("service-account.json");
  try {
    const raw = await fs.readFile(credPath, "utf8");
    return cert(JSON.parse(raw));
  } catch {
    // 3) fallback: applicationDefault (requiere GOOGLE_APPLICATION_CREDENTIALS seteado en el entorno)
    return applicationDefault();
  }
}

initializeApp({ credential: await getCredential() });
const db = getFirestore();

const nombres = [
  "Juan","Ana","Pedro","Lucía","Carlos","Sofía","Diego","Mariana","Luis","Valentina",
  "Nicolás","Camila","Gonzalo","Paula","Martín","Florencia","Ezequiel","Carla","Matías","Julieta"
];
const apellidos = [
  "Pérez","Gómez","Rodríguez","Fernández","López","Martínez","Sánchez","Díaz","Torres","Ramírez",
  "Suárez","Herrera","Godoy","Navarro","Molina","Vega","Rojas","Silva","Castro","Aguilar"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedMembers(count = 30) {
  const seqRef = db.doc("meta/sequences");
  const seqSnap = await seqRef.get();
  let current = seqSnap.exists ? Number(seqSnap.data()?.membersNext ?? 1) : 1;

  for (let i = 0; i < count; i++) {
    const nombre = pick(nombres);
    const apellido = pick(apellidos);
    const memberId = `VG${current}`;
    const email = `${nombre.toLowerCase()}.${apellido.toLowerCase()}${current}@test.com`;

    const ref = db.collection("suscriptores").doc(memberId);
    await ref.set({
      id: memberId,
      numero: current,
      nombre,
      apellido,
      email,
      puntos: Math.floor(Math.random() * 100),
      fechaRegistro: FieldValue.serverTimestamp(),
    });

    console.log(`✅ ${memberId} - ${nombre} ${apellido} <${email}>`);
    current++;
  }

  await seqRef.set({ membersNext: current }, { merge: true });
  console.log(`🎉 Listo: generados ${count} socios.`);
}

seedMembers(30).catch((e) => {
  console.error("❌ Error en seed:", e);
  process.exit(1);
});
