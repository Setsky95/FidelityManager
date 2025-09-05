// client/src/lib/coupons.ts
import { getAuth } from "firebase/auth";

export type Descuento = "10%" | "20%" | "40%";

export async function claimCoupon({ descuento }: { descuento: Descuento }) {
  // Token si el usuario también está autenticado con Firebase (admin)
  let token: string | null = null;
  try {
    const auth = getAuth();
    token = (await auth.currentUser?.getIdToken()) || null;
  } catch { token = null; }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/coupons", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ action: "claim", descuento }),
  });

  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === "no_available") return { noAvailable: true } as const;
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === "insufficient_points") {
      const need = Number(body.need ?? 0);
      const have = Number(body.have ?? 0);
      return { insufficient: true, need, have } as const;
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "No se pudo reclamar el cupón.");
  }

  // { codigo, newPoints, cost }
  return (await res.json()) as { codigo: string; newPoints: number; cost: number };
}