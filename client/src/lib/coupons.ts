// client/src/lib/coupons.ts
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

export type Descuento = "10%" | "20%" | "40%";

export interface CouponDoc extends DocumentData {
  codigo: string;
  descuento: Descuento | string;
  status: "disponible" | "usado";
  usadoPor?: string | null;
  usadoEmail?: string | null;
  usadoAt?: any; // Firestore Timestamp
}

/** Busca 1 cupón disponible del % indicado, lo marca como usado y devuelve el código. */
export async function claimCoupon(opts: {
  descuento: Descuento;
  userId: string;
  userEmail: string;
}): Promise<{ codigo: string } | null> {
  const { descuento, userId, userEmail } = opts;

  // 1) Query: un cupón disponible con ese descuento
  const cuponesRef = collection(db, "cupones");
  const q = query(
    cuponesRef,
    where("descuento", "==", descuento),    // ⚠️ Debe coincidir exactamente con lo que guardás ("10%")
    where("status", "==", "disponible"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const cuponDoc = snap.docs[0];

  // 2) Transacción: marcar como usado (evita carreras)
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(cuponDoc.ref);
    if (!fresh.exists()) throw new Error("El cupón ya no existe.");
    const data = fresh.data() as CouponDoc;
    if (data.status !== "disponible") throw new Error("El cupón ya fue utilizado.");

    tx.update(cuponDoc.ref, {
      status: "usado",
      usadoPor: userId ?? null,
      usadoEmail: userEmail ?? null,
      usadoAt: serverTimestamp(),
    });
  });

  const codigo = (cuponDoc.data() as CouponDoc).codigo;
  if (!codigo) throw new Error("El cupón no posee campo 'codigo'.");
  return { codigo };
}
