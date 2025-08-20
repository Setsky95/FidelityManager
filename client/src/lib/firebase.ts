import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import type { Member, InsertMember, UpdatePoints } from "@shared/schema";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDPFm6xzL0SRszPDavXagRoTmU7cR0iVJM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "vangogh-fidelidad.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "vangogh-fidelidad",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "vangogh-fidelidad.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "522012084948",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:522012084948:web:cf86a6cb6ee22910f38941",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8X5SLWNQGC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

// Collection reference
export const membersCollection = collection(db, "socios");

// Firebase service functions
export class FirebaseService {
  static async getMembers(): Promise<Member[]> {
    const q = query(membersCollection, orderBy("fechaRegistro", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        puntos: data.puntos || 0,
        fechaRegistro: data.fechaRegistro?.toDate() || new Date(),
      };
    });
  }

  static async addMember(member: InsertMember): Promise<string> {
    const docData = {
      ...member,
      fechaRegistro: Timestamp.fromDate(new Date()),
    };
    
    const docRef = await addDoc(membersCollection, docData);
    return docRef.id;
  }

  static async updateMemberPoints(memberId: string, currentPoints: number, update: UpdatePoints): Promise<void> {
    const memberRef = doc(db, "socios", memberId);
    
    let newPoints: number;
    switch (update.operation) {
      case "add":
        newPoints = currentPoints + update.amount;
        break;
      case "subtract":
        newPoints = Math.max(0, currentPoints - update.amount);
        break;
      case "set":
        newPoints = update.amount;
        break;
      default:
        throw new Error("Operación inválida");
    }

    await updateDoc(memberRef, {
      puntos: newPoints,
      ultimaActualizacion: Timestamp.fromDate(new Date()),
      ...(update.reason && { ultimoMotivo: update.reason }),
    });
  }

  static async deleteMember(memberId: string): Promise<void> {
    const memberRef = doc(db, "socios", memberId);
    await deleteDoc(memberRef);
  }

  static async getMemberStats(): Promise<{
    totalMembers: number;
    totalPoints: number;
    newThisMonth: number;
    averagePoints: number;
  }> {
    const members = await this.getMembers();
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalMembers = members.length;
    const totalPoints = members.reduce((sum, member) => sum + member.puntos, 0);
    const newThisMonth = members.filter(member => 
      member.fechaRegistro >= startOfMonth
    ).length;
    const averagePoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;

    return {
      totalMembers,
      totalPoints,
      newThisMonth,
      averagePoints,
    };
  }
}
