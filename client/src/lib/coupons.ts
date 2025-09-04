// client/src/lib/coupons.ts
export type Descuento = "10%" | "20%" | "40%";

export async function claimCoupon({ descuento }: { descuento: Descuento }) {
  const res = await fetch("/api/coupons/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // 🔑 envía vg_session
    body: JSON.stringify({ descuento }),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Error al asignar el cupón.");
  }

  return (await res.json()) as { codigo: string };
}
