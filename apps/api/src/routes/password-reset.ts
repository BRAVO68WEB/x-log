import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, getInstanceSettings } from "@xlog/db";
import { isFeatureEnabled } from "../lib/features";
import { sendEmail } from "../lib/email";
import { sessionMiddleware, setSessionCookie, createSession } from "../middleware/session";

const TOKEN_BYTES = 32;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export const passwordResetRoutes = new Hono().use("*", sessionMiddleware);

// ── POST /auth/forgot-password ─────────────────────────────────────

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

passwordResetRoutes.post(
  "/forgot-password",
  describeRoute({
    description: "Request a password reset email",
    tags: ["auth"],
    responses: {
      200: { description: "Reset email sent (or would have been)" },
      403: { description: "Password reset feature disabled" },
      429: { description: "Rate limited" },
    },
  }),
  validator("json", ForgotPasswordSchema),
  async (c) => {
    const enabled = await isFeatureEnabled("password_reset");
    if (!enabled) {
      return c.json({ error: "Password reset is not enabled" }, 403);
    }

    const { email } = c.req.valid("json");
    const db = getDb();

    // Always return success to prevent email enumeration
    const successResponse = c.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });

    // Find user by email
    const user = await db
      .selectFrom("users")
      .select(["id", "username", "email"])
      .where("email", "=", email)
      .where("password_hash", "is not", null)
      .executeTakeFirst();

    if (!user) {
      return successResponse;
    }

    // Rate limit: check recent requests for this user
    const recentRequests = await db
      .selectFrom("password_resets")
      .select((eb) => eb.fn.count("id").as("count"))
      .where("user_id", "=", user.id)
      .where("created_at", ">", new Date(Date.now() - RATE_LIMIT_WINDOW_MS))
      .executeTakeFirst();

    if (recentRequests && Number(recentRequests.count) >= RATE_LIMIT_MAX) {
      return successResponse;
    }

    // Generate token
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // Invalidate any existing unused tokens for this user
    await db
      .updateTable("password_resets")
      .set({ used_at: new Date() })
      .where("user_id", "=", user.id)
      .where("used_at", "is", null)
      .execute();

    // Store hashed token
    await db
      .insertInto("password_resets")
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .execute();

    // Build reset URL
    const settings = await getInstanceSettings();
    const baseUrl = `https://${settings.instance_domain}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email
    const sent = await sendEmail({
      to: user.email!,
      subject: `Reset your ${settings.instance_name} password`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #333;">Reset your password</h2>
          <p>Hi ${user.username},</p>
          <p>You requested a password reset for your ${settings.instance_name} account.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}"
               style="background: #333; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            ${settings.instance_name} · ${settings.instance_domain}
          </p>
        </div>
      `,
      text: `Reset your ${settings.instance_name} password:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    if (!sent) {
      console.warn("[password-reset] Email send failed for user:", user.id);
    }

    return successResponse;
  }
);

// ── GET /auth/verify-reset-token ───────────────────────────────────

passwordResetRoutes.get(
  "/verify-reset-token",
  describeRoute({
    description: "Verify a password reset token is valid",
    tags: ["auth"],
    responses: {
      200: { description: "Token is valid" },
      400: { description: "Token is invalid or expired" },
      403: { description: "Password reset feature disabled" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("password_reset");
    if (!enabled) {
      return c.json({ error: "Password reset is not enabled" }, 403);
    }

    const token = c.req.query("token");
    if (!token) {
      return c.json({ error: "Missing token" }, 400);
    }

    const tokenHash = await hashToken(token);
    const db = getDb();

    const reset = await db
      .selectFrom("password_resets")
      .select(["id", "expires_at", "used_at"])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!reset) {
      return c.json({ error: "Invalid token" }, 400);
    }

    if (reset.used_at) {
      return c.json({ error: "Token already used" }, 400);
    }

    if (new Date() > reset.expires_at) {
      return c.json({ error: "Token expired" }, 400);
    }

    return c.json({ valid: true });
  }
);

// ── POST /auth/reset-password ──────────────────────────────────────

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

passwordResetRoutes.post(
  "/reset-password",
  describeRoute({
    description: "Reset password using a valid token",
    tags: ["auth"],
    responses: {
      200: { description: "Password reset successful" },
      400: { description: "Invalid token or weak password" },
      403: { description: "Password reset feature disabled" },
    },
  }),
  validator("json", ResetPasswordSchema),
  async (c) => {
    const enabled = await isFeatureEnabled("password_reset");
    if (!enabled) {
      return c.json({ error: "Password reset is not enabled" }, 403);
    }

    const { token, password } = c.req.valid("json");
    const tokenHash = await hashToken(token);
    const db = getDb();

    const reset = await db
      .selectFrom("password_resets")
      .select(["id", "user_id", "expires_at", "used_at"])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!reset) {
      return c.json({ error: "Invalid token" }, 400);
    }

    if (reset.used_at) {
      return c.json({ error: "Token already used" }, 400);
    }

    if (new Date() > reset.expires_at) {
      return c.json({ error: "Token expired" }, 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await db
      .updateTable("users")
      .set({ password_hash: passwordHash, updated_at: new Date() })
      .where("id", "=", reset.user_id)
      .execute();

    // Mark token as used
    await db
      .updateTable("password_resets")
      .set({ used_at: new Date() })
      .where("id", "=", reset.id)
      .execute();

    // Invalidate all other unused tokens for this user
    await db
      .updateTable("password_resets")
      .set({ used_at: new Date() })
      .where("user_id", "=", reset.user_id)
      .where("used_at", "is", null)
      .execute();

    // Auto-login: create session for the user
    const sessionToken = await createSession(reset.user_id);
    setSessionCookie(c, sessionToken);

    return c.json({ message: "Password reset successful" });
  }
);
