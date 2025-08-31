import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_PASS!,
  },
  pool: true,
});

const ALLOWED = (process.env.GMAIL_ALLOWED_FROM || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function parseFrom(input?: string): { name?: string; email?: string } {
  if (!input) return {};
  const m = input.match(/^\s*([^<]+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  if (/\S+@\S+/.test(input)) return { email: input.trim() };
  return { name: input.trim() };
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  const user = String(process.env.GMAIL_USER || "").toLowerCase();
  const { name, email: wanted } = parseFrom(opts.from);
  const wantedLc = (wanted || "").toLowerCase();

  const isAllowed = !wanted || wantedLc === user || ALLOWED.includes(wantedLc);
  const fromEmail = isAllowed ? (wanted || user) : user;
  const display = name ? `"${name}" <${fromEmail}>` : fromEmail;
  const replyTo = isAllowed ? (opts.replyTo || undefined) : (wanted || opts.replyTo || undefined);

  return transporter.sendMail({
    from: display,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    replyTo,
  });
}
