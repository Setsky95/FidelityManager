// client/src/lib/coupons.ts
import { getAuth } from "firebase/auth";

export type Descuento = "10%" | "20%" | "40%";

export async function claimCoupon(params: { descuento: Descuento }): Promise<{ codigo: string } | null> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Debés iniciar sesión.");

  const res = await fetch("/api/coupons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "claim", descuento: params.descuento }),
  });

  if (res.status === 404) return null; // no available
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "No se pudo reclamar el cupón.");
  }
  return res.json(); // { codigo }
}
