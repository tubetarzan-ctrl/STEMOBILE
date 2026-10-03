import "server-only";
import { Resend } from "resend";

const from = process.env.EMAIL_FROM ?? "StarTech Electronics <hello@startech.pk>";

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email:mock] → ${opts.to} :: ${opts.subject}`);
    return { id: "mock" };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html, attachments: opts.attachments });
  if (error) throw new Error(`email_failed: ${error.message}`);
  return { id: data?.id };
}
