// src/lib/members.ts
import {
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { InsertMember } from "@shared/schema";
import { app } from "@/lib/firebase"; // tu initializeApp exportado

const db = getFirestore(app);

/**
 * Crea un socio con ID VG{n} usando una transacción.
 * - meta/sequences.membersNext arranca en 1 (si no existe, se inicializa).
 * - Crea el doc en suscriptores/VG{n} y guarda { numero: n } para ordenar.
 * Devuelve el id asignado (VG{n}).
 */
export async function createMemberWithSequentialId(data: InsertMember) {
  const id = await runTransaction(db, async (tx) => {
    const seqRef = doc(db, "meta", "sequences");
    const seqSnap = await tx.get(seqRef);

    let next = 1;

    if (!seqSnap.exists()) {
      // primera vez: asignamos 1 al nuevo socio y dejamos preparado el 2
      next = 1;
      tx.set(seqRef, { membersNext: 2 });
    } else {
      const current = Number(seqSnap.data().membersNext ?? 1);
      next = current;
      tx.update(seqRef, { membersNext: current + 1 });
    }

    const memberId = `VG${next}`;
    const memberRef = doc(db, "suscriptores", memberId);

    tx.set(memberRef, {
      ...data,
      puntos: Number(data.puntos || 0),
      id: memberId,      // opcional pero útil para mostrar
      numero: next,      // para ordenar numéricamente
      fechaRegistro: serverTimestamp(),
    });

    return memberId;
  });

  return id;
}
