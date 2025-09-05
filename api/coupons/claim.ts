// Puente para /api/coupons/claim que fuerza action="claim"
import baseHandler from "../coupons.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Aseguramos body como objeto
  let body: any = {};
  if (typeof req.body === "string") {
    try { body = JSON.parse(req.body || "{}"); } catch { body = {}; }
  } else {
    body = req.body || {};
  }

  req.body = { ...body, action: body.action ?? "claim" };

  return baseHandler(req, res);
}
