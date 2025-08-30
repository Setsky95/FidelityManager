// server/email.ts
import "dotenv/config";
import nodemailer, { type Transporter } from "nodemailer";

/** Detecta entornos serverless donde NO conviene usar pool (Vercel, Lambda, etc.) */
const IS_SERVERLESS =
  !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);

/** Flags de depuración opcionales */
const EMAIL_LOGGER = process.env.EMAIL_LOGGER === "1";
const EMAIL_DEBUG  = process.env.EMAIL_DEBUG === "1";

/** App Password o credenciales SMTP de Gmail */
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = process.env.GMAIL_PASS || "";

/** Usa pool sólo fuera de serverless, a menos que lo fuerces con EMAIL_POOL=0/1 */
const USE_POOL = !IS_SERVERLESS && process.env.EMAIL_POOL !== "0";

/** Crea el transporter (SMTP Gmail) */
export const transporter: Transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // 465 = SSL/TLS
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
  // Pool solo en procesos “long-lived” (tu servidor local o un VPS). En Vercel no sirve.
  pool: USE_POOL,
  maxConnections: 2,
  maxMessages: 50,
  // Timeouts razonables para evitar cuelgues
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
  // TLS duro (Gmail ya usa TLS moderno)
  tls: {
    minVersion: "TLSv1.2",
    servername: "smtp.gmail.com",
  },
  // Logs
  logger: EMAIL_LOGGER,
  debug: EMAIL_DEBUG,
});

/** Lista de alias permitidos para aparecer como “From” (coma separada) */
const ALLOWED = (process.env.GMAIL_ALLOWED_FROM || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/** Sanea un header simple (evita inyección de CRLF) */
function sanitizeHeaderValue(v?: string) {
  if (!v) return v;
  return v.replace(/[\r\n]+/g, " ").trim();
}

/** Parsea "Nombre <email@dom.com>" o retorna name/email según lo que venga */
function parseFrom(input?: string): { name?: string; email?: string } {
  if (!input) return {};
  const m = input.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) {
    return { name: sanitizeHeaderValue(m[1]), email: sanitizeHeaderValue(m[2]) };
  }
  if (/\S+@\S+/.test(input)) return { email: sanitizeHeaderValue(input) };
  return { name: sanitizeHeaderValue(input) };
}

/** Texto plano básico para mejorar entregabilidad */
function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza “to” a array no vacío */
function normalizeTo(to: string | string[]) {
  const arr = Array.isArray(to) ? to : [to];
  const clean = arr.map(sanitizeHeaderValue).filter(Boolean) as string[];
  if (!clean.length) throw new Error('Parámetro "to" vacío');
  return clean;
}

/**
 * Envía un email usando Gmail SMTP.
 * - Respeta el “from” si coincide con GMAIL_USER o está en GMAIL_ALLOWED_FROM.
 * - Si no, usa GMAIL_USER como “from” y pone el “from” solicitado en Reply-To.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;     // opcional: "Nombre <alias@dominio.com>"
  replyTo?: string;  // opcional
}) {
  if (!GMAIL_USER || !GMAIL_PASS) {
    throw new Error("Faltan credenciales GMAIL_USER/GMAIL_PASS");
  }

  const to = normalizeTo(opts.to);
  const subject = sanitizeHeaderValue(opts.subject) || "(sin asunto)";
  const html = String(opts.html || "");
  const text = htmlToText(html);

  // Manejo de “From” y Reply-To
  const { name, email: wanted } = parseFrom(opts.from);
  const userLc = GMAIL_USER.toLowerCase();
  const wantedLc = (wanted || "").toLowerCase();

  const isAllowed =
    !wanted || wantedLc === userLc || ALLOWED.includes(wantedLc);

  const fromEmail = isAllowed ? (wanted || GMAIL_USER) : GMAIL_USER;
  const display = name ? `"${name}" <${fromEmail}>` : fromEmail;

  const replyTo =
    isAllowed ? (sanitizeHeaderValue(opts.replyTo) || undefined)
              : (wanted || sanitizeHeaderValue(opts.replyTo) || undefined);

  const info = await transporter.sendMail({
    from: display,
    to,
    subject,
    html,
    text,
    replyTo,
  });

  return info;
}

/** Útil para el endpoint /api/email/verify */
export async function verifySmtp() {
  return transporter.verify();
}
