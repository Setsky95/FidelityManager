// client/src/lib/coupons.ts
import { getAuth } from "firebase/auth";

export type Descuento = "10%" | "20%" | "40%";

type ClaimOk = { ok: true; codigo: string; newPoints: number; cost: number };
type ClaimNoAvailable = { ok: false; reason: "no_available" };
type ClaimInsufficient = { ok: false; reason: "insufficient_points"; need: number; have: number };
type ClaimUnauth = { ok: false; reason: "unauthenticated" };
type ClaimError = { ok: false; reason: "error"; message: string };
export type ClaimResult = ClaimOk | ClaimNoAvailable | ClaimInsufficient | ClaimUnauth | ClaimError;

export async function claimCoupon({ descuento }: { descuento: Descuento }): Promise<ClaimResult> {
  let token: string | null = null;
  try {
    const auth = getAuth();
    token = (await auth.currentUser?.getIdToken()) || null;
  } catch { token = null; }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/coupons", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ action: "claim", descuento }),
    });
  } catch (e: any) {
    return { ok: false, reason: "error", message: e?.message || "Fallo de red" };
  }

  if (res.status === 401) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (res.status === 404) {
    // nuestro handler devuelve { error: "no_available" } con 404
    const body = await res.json().catch(() => ({}));
    if (body?.error === "no_available") return { ok: false, reason: "no_available" };
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === "insufficient_points") {
      const need = Number(body.need ?? 0);
      const have = Number(body.have ?? 0);
      return { ok: false, reason: "insufficient_points", need, have };
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, reason: "error", message: err?.error || "No se pudo reclamar el cupón." };
  }

  const data = await res.json();
  return { ok: true, codigo: data.codigo, newPoints: data.newPoints, cost: data.cost };
}
