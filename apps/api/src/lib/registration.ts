import { getEnv } from "@xlog/config";
import { getDb, getInstanceSettings } from "@xlog/db";
import { createLocalAuthor } from "./local-users";
import { sendEmail } from "./email";
import crypto from "crypto";

/**
 * Open registration when:
 * - env OPEN_REGISTRATIONS=true (deploy override), OR
 * - instance_settings.open_registrations=true (admin UI)
 * Default: closed (invite-only).
 */
export async function isOpenRegistrationsEnabled(): Promise<boolean> {
  const env = getEnv();
  if (env.OPEN_REGISTRATIONS) return true;

  try {
    const db = getDb();
    const row = await db
      .selectFrom("instance_settings")
      .select("open_registrations")
      .where("id", "=", 1)
      .executeTakeFirst();
    return Boolean(row?.open_registrations);
  } catch {
    return false;
  }
}

export async function getRegistrationStatus() {
  const open = await isOpenRegistrationsEnabled();
  const env = getEnv();
  let authorCount = 0;
  try {
    const { countLocalAuthors } = await import("./local-users");
    authorCount = await countLocalAuthors();
  } catch {
    /* ignore */
  }
  return {
    open_registrations: open,
    max_local_authors: env.MAX_LOCAL_AUTHORS,
    active_author_count: authorCount,
    can_register: open && authorCount < env.MAX_LOCAL_AUTHORS,
  };
}

export async function registerPublicAuthor(input: {
  username: string;
  password: string;
  email?: string | null;
  fullName?: string | null;
}) {
  if (!(await isOpenRegistrationsEnabled())) {
    throw new Error("Public registration is closed");
  }

  const user = await createLocalAuthor({
    username: input.username,
    password: input.password,
    email: input.email,
    role: "author",
    fullName: input.fullName,
  });

  // Optional verification email when SMTP + email present
  if (input.email) {
    try {
      await sendRegistrationVerificationEmail(user.id, input.email, user.username);
    } catch (err) {
      console.warn("[register] verification email failed:", err);
    }
  }

  return user;
}

async function sendRegistrationVerificationEmail(
  userId: string,
  email: string,
  username: string
) {
  const settings = await getInstanceSettings();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const db = getDb();

  // Mark unverified when we attempt email verification
  try {
    await db
      .updateTable("users")
      .set({ email_verified: false, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
  } catch {
    // column may not exist pre-migration — ignore
  }

  try {
    await db
      .insertInto("email_verifications")
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })
      .execute();
  } catch {
    // table may not exist — skip email
    return;
  }

  const isDev = process.env.NODE_ENV === "development";
  const base = isDev
    ? `http://${settings.instance_domain}`
    : `https://${settings.instance_domain}`;
  const url = `${base}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: `Verify your email on ${settings.instance_name || "x-log"}`,
    text: `Hi @${username},\n\nVerify your email: ${url}\n\nThis link expires in 48 hours.`,
    html: `<p>Hi <strong>@${username}</strong>,</p>
      <p>Thanks for joining <strong>${settings.instance_name || "x-log"}</strong>.</p>
      <p><a href="${url}">Verify your email</a></p>
      <p class="muted">Link expires in 48 hours.</p>`,
  });
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const row = await db
    .selectFrom("email_verifications")
    .selectAll()
    .where("token_hash", "=", tokenHash)
    .executeTakeFirst();

  if (!row) return false;
  if (row.used_at) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;

  await db
    .updateTable("users")
    .set({ email_verified: true, updated_at: new Date() })
    .where("id", "=", row.user_id)
    .execute();

  await db
    .updateTable("email_verifications")
    .set({ used_at: new Date() })
    .where("id", "=", row.id)
    .execute();

  return true;
}
