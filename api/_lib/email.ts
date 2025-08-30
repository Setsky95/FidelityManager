// api/_lib/email.ts
import nodemailer from "nodemailer";

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  const user = process.env.GMAIL_USER!;
  const pass = process.env.GMAIL_PASS!;
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
  });

  const display = from && /@/.test(from) ? from : user;

  return transporter.sendMail({
    from: display,
    to,
    subject,
    html,
    text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    replyTo,
  });
}
