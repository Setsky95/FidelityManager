const COOKIE_NAME = "vg_session";

export default async function handler(_req: any, res: any) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`
  );
  res.status(200).json({ ok: true });
}
