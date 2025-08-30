import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER!;
const pass = process.env.GMAIL_PASS!;
const ALLOWED = (process.env.GMAIL_ALLOWED_FROM || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
  pool: true,
});

function parseFrom(input?: string): { name?: string; email?: string } {
  if (!input) return {};
  const m = input.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  if (/\S+@\S+/.test(input)) return { email: input.trim() };
  return { name: input.trim() };
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  const { name, email: wanted } = parseFrom(opts.from);
  const wantedLc = (wanted || "").toLowerCase();
  const isAllowed = !wanted || wantedLc === user.toLowerCase() || ALLOWED.includes(wantedLc);
  const fromEmail = isAllowed ? (wanted || user) : user;
  const display = name ? `"${name}" <${fromEmail}>` : fromEmail;
  const replyTo = isAllowed ? (opts.replyTo || undefined) : (wanted || opts.replyTo || undefined);

  const info = await transporter.sendMail({
    from: display,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: htmlToText(opts.html),
    replyTo,
  });

  return info;
}
