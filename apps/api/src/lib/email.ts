import nodemailer from "nodemailer";
import { getDb } from "@xlog/db";
import { getInstanceSettings } from "@xlog/db";

let transporter: nodemailer.Transporter | null = null;

async function getSmtpUrl(): Promise<string | null> {
  // Check env var first
  if (process.env.SMTP_URL) {
    return process.env.SMTP_URL;
  }

  // Fall back to database
  const db = getDb();
  const settings = await db
    .selectFrom("instance_settings")
    .select(["smtp_url"])
    .where("id", "=", 1)
    .executeTakeFirst();

  return settings?.smtp_url ?? null;
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const smtpUrl = await getSmtpUrl();

  if (!smtpUrl) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport(smtpUrl);
  }

  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const transport = await getTransporter();
  if (!transport) {
    console.warn("[email] SMTP not configured, skipping email send");
    return false;
  }

  const settings = await getInstanceSettings();
  const fromName = settings.instance_name || "x-log";
  const db = getDb();
  const adminRow = await db
    .selectFrom("instance_settings")
    .select(["admin_email"])
    .where("id", "=", 1)
    .executeTakeFirst();
  const adminEmail = adminRow?.admin_email ?? null;
  const from = adminEmail
    ? `${fromName} <${adminEmail}>`
    : `noreply@${settings.instance_domain}`;

  try {
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    return false;
  }
}

export function resetEmailTransporter(): void {
  transporter = null;
}
