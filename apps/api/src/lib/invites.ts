import crypto from "crypto";
import { getDb } from "@xlog/db";
import { createLocalAuthor } from "./local-users";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createInvite(opts: {
  invitedBy: string;
  email?: string | null;
  role?: "author";
}) {
  const db = getDb();
  const token = generateInviteToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db
    .insertInto("user_invites")
    .values({
      id,
      token_hash: hashInviteToken(token),
      email: opts.email || null,
      role: opts.role || "author",
      invited_by: opts.invitedBy,
      expires_at: expiresAt,
      accepted_at: null,
      accepted_user_id: null,
      revoked_at: null,
    })
    .execute();

  return { id, token, expires_at: expiresAt.toISOString() };
}

export async function getInviteByToken(token: string) {
  const db = getDb();
  return db
    .selectFrom("user_invites")
    .selectAll()
    .where("token_hash", "=", hashInviteToken(token))
    .executeTakeFirst();
}

export function inviteStatus(invite: {
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}): "valid" | "expired" | "accepted" | "revoked" {
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "valid";
}

export async function acceptInvite(opts: {
  token: string;
  username: string;
  password: string;
  fullName?: string | null;
}) {
  const invite = await getInviteByToken(opts.token);
  if (!invite) {
    throw new Error("Invalid invite");
  }
  const status = inviteStatus(invite);
  if (status !== "valid") {
    throw new Error(`Invite is ${status}`);
  }

  const user = await createLocalAuthor({
    username: opts.username,
    password: opts.password,
    email: invite.email,
    role: "author",
    fullName: opts.fullName,
  });

  const db = getDb();
  await db
    .updateTable("user_invites")
    .set({
      accepted_at: new Date(),
      accepted_user_id: user.id,
    })
    .where("id", "=", invite.id)
    .execute();

  return user;
}
