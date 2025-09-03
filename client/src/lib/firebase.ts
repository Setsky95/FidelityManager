// src/lib/firebase.ts
import { initializeApp, FirebaseError } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  where,
  limit as qlimit,
  getDoc,
  setDoc,
  startAfter as qstartAfter,
  documentId,
  deleteDoc,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFunctions, httpsCallable } from "firebase/functions";

import type {
  Member,
  InsertMember,
  UpdatePoints,
  Movement,
  MovementType,
} from "@shared/schema";

/* =========================
   Firebase App
   ========================= */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDPFm6xzL0SRszPDavXagRoTmU7cR0iVJM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "vangogh-fidelidad.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "vangogh-fidelidad",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "vangogh-fidelidad.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "522012084948",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:522012084948:web:cf86a6cb6ee22910f38941",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8X5SLWNQGC",
};

export const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch { /* evita error en SSR/Node */ }

/* =========================
   Firestore
   ========================= */
export const db = getFirestore(app);

// Colecciones
export const membersCollection = collection(db, "suscriptores");
export const logsCollection = collection(db, "movimientos");

// === Listas ===
export const listsCollection = collection(db, "listas");
export type ListDoc = {
  id: string;
  nombre: string;
  /** CSV con IDs de socios, ej: "VG1,VG2,VG3" */
  Ids: string;
};

/* =========================
   Auth (Google)
   ========================= */
export const auth = getAuth(app);

// Persistencia en el navegador (no romper si falla en SSR)
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Proveedor Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Helpers de auth (opcionales)
export async function signInWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}
export async function signOutUser() { await signOut(auth); }

// Re-exports que usa el AuthProvider (IMPORTANTE)
export {
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut,
};
export type { User };

/* =========================
   Functions (region)
   ========================= */
export const functions = getFunctions(app, "us-central1");

/* =========================
   Utils
   ========================= */
function toDateSafe(value: any): Date | null {
  if (value && typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  return null;
}

// Crea un log dentro de una transacción
function setLogTx(
  tx: any,
  data: {
    memberId: string;
    memberIdNumber?: number;
    memberName?: string;
    email?: string;
    type: MovementType;
    delta?: number;
    previousPoints?: number;
    newPoints?: number;
    reason?: string | null;
  }
) {
  const logRef = doc(logsCollection); // id aleatorio
  tx.set(logRef, { ...data, createdAt: serverTimestamp() });
}

/* =========================
   Servicio
   ========================= */
export class FirebaseService {
  /** Trae socios por IDs (en chunks de 10 por límite de Firestore). */
  static async getMembersByIds(ids: string[]): Promise<Member[]> {
    const clean = (ids ?? []).map((x) => x.trim()).filter(Boolean);
    if (clean.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < clean.length; i += 10) chunks.push(clean.slice(i, i + 10));

    const results: Member[] = [];
    for (const group of chunks) {
      const qRef = query(membersCollection, where(documentId(), "in", group));
      const snap = await getDocs(qRef);
      snap.forEach((d) => {
        const data: any = d.data();
        results.push({
          id: d.id,
          nombre: data?.nombre ?? "",
          apellido: data?.apellido ?? "",
          email: data?.email ?? "",
          puntos: Number(data?.puntos ?? 0),
          fechaRegistro: toDateSafe(data?.fechaRegistro) ?? new Date(0),
        });
      });
    }

    const orderMap = new Map(clean.map((id, idx) => [id, idx]));
    results.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    return results;
  }

  /** Paginado ordenado por 'numero'. */
  static async getMembersPage(opts: {
    limit: number;
    startAfterNumero?: number | null;
  }): Promise<{ items: Member[]; nextCursor: number | null }> {
    const { limit, startAfterNumero } = opts;
    const constraints: any[] = [orderBy("numero", "asc"), qlimit(limit)];
    if (typeof startAfterNumero === "number") constraints.push(qstartAfter(startAfterNumero));

    const snap = await getDocs(query(membersCollection, ...constraints));
    const items: Member[] = snap.docs.map((d) => {
      const data: any = d.data();
      const fecha = toDateSafe(data?.fechaRegistro);
      return {
        id: d.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        puntos: Number(data.puntos ?? 0),
        fechaRegistro: fecha ?? new Date(0),
      };
    });

    const last = snap.docs.at(-1);
    const nextCursor =
      last && typeof (last.data() as any)?.numero === "number"
        ? Number((last.data() as any).numero)
        : null;

    return { items, nextCursor };
  }

  static async getMembers(): Promise<Member[]> {
    const qMembers = query(membersCollection, orderBy("numero", "asc"));
    const snapshot = await getDocs(qMembers);
    return snapshot.docs.map((d) => {
      const data = d.data() as any;
      const fecha = toDateSafe(data?.fechaRegistro);
      return {
        id: d.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        puntos: Number(data.puntos ?? 0),
        fechaRegistro: fecha ?? new Date(0),
      } as Member;
    });
  }

  /** Alta con ID correlativo VG{n} + log. */
  static async addMember(member: InsertMember): Promise<string> {
    const newId = await runTransaction(db, async (tx) => {
      const seqRef = doc(db, "meta", "sequences");
      const seqSnap = await tx.get(seqRef);

      let next = 1;
      if (!seqSnap.exists()) {
        tx.set(seqRef, { membersNext: 2 });
        next = 1;
      } else {
        const current = Number(seqSnap.data()?.membersNext ?? 1);
        next = current;
        tx.update(seqRef, { membersNext: current + 1 });
      }

      const memberId = `VG${next}`;
      const ref = doc(db, "suscriptores", memberId);
      const clean = {
        nombre: member.nombre.trim(),
        apellido: member.apellido.trim(),
        email: member.email.trim().toLowerCase(),
        puntos: Number(member.puntos || 0),
      };

      tx.set(ref, {
        ...clean,
        id: memberId,
        numero: next,
        fechaRegistro: serverTimestamp(),
      });

      setLogTx(tx, {
        memberId,
        memberIdNumber: next,
        memberName: `${clean.nombre} ${clean.apellido}`.trim(),
        email: clean.email,
        type: "create",
        delta: 0,
        previousPoints: 0,
        newPoints: clean.puntos,
        reason: null,
      });

      return memberId;
    });

    return newId;
  }

  /** Borra una lista. */
  static async deleteList(listId: string): Promise<void> {
    const ref = doc(listsCollection, listId);
    await deleteDoc(ref);
  }

  /** Update de puntos + log. */
  static async updateMemberPoints(
    memberId: string,
    _currentPoints: number,
    update: UpdatePoints
  ): Promise<void> {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "suscriptores", memberId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Socio no encontrado");

      const data: any = snap.data();
      const prev = Number(data?.puntos ?? 0);

      let nextPoints = prev;
      let delta = 0;
      let type: MovementType = "points_set";

      if (update.operation === "add") {
        delta = update.amount;
        nextPoints = prev + update.amount;
        type = "points_add";
      } else if (update.operation === "subtract") {
        delta = -update.amount;
        nextPoints = Math.max(0, prev - update.amount);
        type = "points_subtract";
      } else if (update.operation === "set") {
        nextPoints = update.amount;
        delta = nextPoints - prev;
        type = "points_set";
      } else {
        throw new Error("Operación inválida");
      }

      tx.update(ref, {
        puntos: nextPoints,
        ultimaActualizacion: serverTimestamp(),
        ...(update.reason && { ultimoMotivo: update.reason }),
      });

      setLogTx(tx, {
        memberId,
        memberIdNumber: data?.numero,
        memberName: `${data?.nombre ?? ""} ${data?.apellido ?? ""}`.trim(),
        email: data?.email ?? undefined,
        type,
        delta,
        previousPoints: prev,
        newPoints: nextPoints,
        reason: update.reason ?? null,
      });
    });
  }

  /** Elimina socio + log. */
  static async deleteMember(memberId: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "suscriptores", memberId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      const data: any = snap.data();
      tx.delete(ref);

      setLogTx(tx, {
        memberId,
        memberIdNumber: data?.numero,
        memberName: `${data?.nombre ?? ""} ${data?.apellido ?? ""}`.trim(),
        email: data?.email ?? undefined,
        type: "delete",
        delta: 0,
        previousPoints: Number(data?.puntos ?? 0),
        newPoints: 0,
        reason: null,
      });
    });
  }

  /** Lectura de logs con filtros, con fallback si falta índice. */
  static async getMovements(opts: {
    memberId?: string;
    type?: MovementType;
    from?: Date;
    to?: Date;
    limit?: number;
  } = {}): Promise<Movement[]> {
    const { memberId, type, from, to, limit = 200 } = opts;

    const filters: any[] = [];
    if (memberId) filters.push(where("memberId", "==", memberId));
    if (type) filters.push(where("type", "==", type));
    if (from) filters.push(where("createdAt", ">=", Timestamp.fromDate(from)));
    if (to) filters.push(where("createdAt", "<", Timestamp.fromDate(to)));

    try {
      const qLogs = query(
        logsCollection,
        ...filters,
        orderBy("createdAt", "desc"),
        qlimit(limit)
      );

      const snap = await getDocs(qLogs);
      return snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() ?? new Date(0),
        } as Movement;
      });
    } catch (err) {
      const isIndexIssue =
        err instanceof FirebaseError && err.code === "failed-precondition";

      if (isIndexIssue) {
        console.warn("[getMovements] Falta índice. Fallback en cliente.", err);
        const qAll = query(logsCollection, orderBy("createdAt", "desc"), qlimit(limit));
        const snap = await getDocs(qAll);
        let items = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.() ?? new Date(0),
          } as Movement;
        });
        if (memberId) items = items.filter((x) => x.memberId === memberId);
        if (type) items = items.filter((x) => x.type === type);
        if (from) items = items.filter((x) => x.createdAt >= from);
        if (to) items = items.filter((x) => x.createdAt < to);
        return items;
      }
      throw err;
    }
  }

  /** Stats calculados en cliente. */
  static async getMemberStats(): Promise<{
    totalMembers: number;
    totalPoints: number;
    newThisMonth: number;
    averagePoints: number;
  }> {
    const snap = await getDocs(membersCollection);

    let totalPoints = 0;
    let newThisMonth = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    snap.forEach((d) => {
      const data: any = d.data();
      const puntos = Number(data?.puntos ?? 0);
      totalPoints += isNaN(puntos) ? 0 : puntos;

      const fecha = toDateSafe(data?.fechaRegistro);
      if (fecha && fecha >= startOfMonth) newThisMonth += 1;
    });

    const totalMembers = snap.size;
    const averagePoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;
    return { totalMembers, totalPoints, newThisMonth, averagePoints };
  }

  /* ========= Automations (settings + test) ========= */
  static async getAutomationSettings(): Promise<any> {
    const ref = doc(db, "settings", "automations");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  }

  static async saveAutomationSettings(settings: any): Promise<void> {
    const ref = doc(db, "settings", "automations");
    await setDoc(ref, settings, { merge: true });
  }

  static async sendTestWelcomeEmail(
    to: string,
    welcome: { enabled: boolean; from: string; subject: string; body: string }
  ) {
    const call = httpsCallable(functions, "sendTestWelcomeEmail");
    await call({ to, welcome });
  }

  /* ========= Listas ========= */
  static async getLists(): Promise<ListDoc[]> {
    const qLists = query(listsCollection, orderBy("nombre", "asc"));
    const snap = await getDocs(qLists);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return { id: d.id, nombre: String(data?.nombre ?? ""), Ids: String(data?.Ids ?? "") };
    });
  }

  static async createList(nombre: string, ids: string[]): Promise<string> {
    const ref = doc(listsCollection);
    await setDoc(ref, {
      nombre: nombre.trim(),
      Ids: (ids ?? []).join(","),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
}

/* =========================
   Índices recomendados (Firestore)
   =========================
   Colección: movimientos
   1) Single-field: createdAt DESC
   2) Compuesto: type ASC, createdAt DESC
   3) (opcional) Compuesto: memberId ASC, createdAt DESC
   4) (opcional) Compuesto: memberId ASC, type ASC, createdAt DESC
*/
