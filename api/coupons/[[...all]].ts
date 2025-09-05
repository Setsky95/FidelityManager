// api/coupons/[[...all]].ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
// IMPORTANTE: con "moduleResolution": "NodeNext" importá el .js
import baseHandler from "../coupons.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Normalizá /api/coupons/claim -> body.action="claim"
  const pathname = (req.url || "").split("?")[0];         // e.g. /api/coupons/claim
  const last = pathname.split("/").filter(Boolean).at(-1); // 'claim'

  if (req.method === "POST" && last === "claim") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    req.body = { ...body, action: body.action ?? "claim" };
  }

  // delega todo al handler real
  return (baseHandler as any)(req, res);
}
