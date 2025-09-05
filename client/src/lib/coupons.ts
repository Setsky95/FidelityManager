// client/src/lib/coupons.ts
import { getAuth } from "firebase/auth";

export type Descuento = "10%" | "20%" | "40%";

export async function claimCoupon({ descuento }: { descuento: Descuento }) {
  // Intentamos tomar el ID token de Firebase (admin)
  let token: string | null = null;
  try {
    const auth = getAuth();
    token = (await auth.currentUser?.getIdToken()) || null;
  } catch {
    token = null;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/coupons", {
    method: "POST",
    headers,
    credentials: "include", // <-- para enviar la cookie vg_session
    body: JSON.stringify({ action: "claim", descuento }),
  });

  if (res.status === 404) return null; // no disponible
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "No se pudo reclamar el cupón.");
  }
  return (await res.json()) as { codigo: string };
}
