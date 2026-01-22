import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { 
  LoginSchema, 
  UserResponseSchema,
  OIDCCallbackQuerySchema,
  OIDCLinkAccountSchema,
  OIDCAccountResponseSchema
} from "@xlog/validation";
import { getDb } from "@xlog/db";
import bcrypt from "bcryptjs";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  sessionMiddleware,
} from "../middleware/session";
import { getOIDCClient } from "@xlog/libs";
import { getEnv } from "@xlog/config";

export const authRoutes = new Hono().use("*", sessionMiddleware);

authRoutes.post(
  "/login",
  describeRoute({
    description: "Login with username and password",
    tags: ["auth"],
    responses: {
      200: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
      401: {
        description: "Invalid credentials",
      },
    },
  }),
  validator("json", LoginSchema),
  async (c) => {
    const { username, password } = c.req.valid("json");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const sessionToken = await createSession(user.id);
    setSessionCookie(c, sessionToken);

    return c.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at.toISOString(),
    });
  }
);

authRoutes.post(
  "/logout",
  describeRoute({
    description: "Logout current user",
    tags: ["auth"],
    responses: {
      200: {
        description: "Logout successful",
      },
    },
  }),
  async (c) => {
    clearSessionCookie(c);
    return c.json({ message: "Logged out" });
  }
);

// OIDC Login Initiation
authRoutes.get(
  "/oidc/login",
  describeRoute({
    description: "Initiate OIDC login flow",
    tags: ["auth"],
    responses: {
      302: {
        description: "Redirect to OIDC provider",
      },
    },
  }),
  async (c) => {
    const oidcClient = getOIDCClient();
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Store state in session or Redis for validation
    // For simplicity, we'll include it in the callback validation
    const authUrl = await oidcClient.getAuthorizationUrl(state, nonce);
    console.log(authUrl);

    return c.redirect(authUrl);
  }
);

// OIDC Callback Handler
authRoutes.get(
  "/oidc/callback",
  describeRoute({
    description: "OIDC callback handler with auto-linking or manual linking flow",
    tags: ["auth"],
    responses: {
      302: {
        description: "Redirect based on linking status",
      },
      400: {
        description: "Invalid callback parameters",
      },
    },
  }),
  async (c) => {
    const env = getEnv();
    const db = getDb();
    const oidcClient = getOIDCClient();

    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    // Handle OIDC errors
    if (error) {
      console.error("OIDC error:", error, errorDescription);
      return c.redirect(`/login?error=oidc_failed&description=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !state) {
      return c.redirect("/login?error=invalid_callback");
    }

    try {
      // Complete OIDC flow and get user info
      const userInfo = await oidcClient.completeFlow(code);
      const providerAccountId = userInfo.sub;
      const email = userInfo.email;
      const provider = new URL(env.OIDC_DISCOVERY_URL).hostname; // Use hostname as provider identifier

      // Check if OIDC account is already linked
      const existingOIDCAccount = await db
        .selectFrom("oidc_accounts")
        .selectAll()
        .where("provider", "=", provider)
        .where("provider_account_id", "=", providerAccountId)
        .executeTakeFirst();

      if (existingOIDCAccount) {
        // Auto-login: OIDC account already linked
        const user = await db
          .selectFrom("users")
          .selectAll()
          .where("id", "=", existingOIDCAccount.user_id)
          .executeTakeFirst();

        if (user) {
          const sessionToken = await createSession(user.id);
          setSessionCookie(c, sessionToken);
          return c.redirect("/");
        }
      }

      // Check if email matches an existing user for auto-linking
      if (email) {
        const existingUser = await db
          .selectFrom("users")
          .selectAll()
          .where("email", "=", email)
          .executeTakeFirst();

        if (existingUser) {
          // Auto-link: Email matches
          await db
            .insertInto("oidc_accounts")
            .values({
              id: crypto.randomUUID(),
              user_id: existingUser.id,
              provider,
              provider_account_id: providerAccountId,
              email: email,
              email_verified: userInfo.email_verified || false,
              name: userInfo.name || userInfo.preferred_username || null,
              picture: userInfo.picture || null,
            })
            .execute();

          const sessionToken = await createSession(existingUser.id);
          setSessionCookie(c, sessionToken);
          return c.redirect("/?linked=success");
        }
      }

      // No auto-link possible: Create pending link for manual linking
      const linkState = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await db
        .insertInto("oidc_pending_links")
        .values({
          id: crypto.randomUUID(),
          state: linkState,
          provider,
          provider_account_id: providerAccountId,
          email: email || null,
          name: userInfo.name || userInfo.preferred_username || null,
          picture: userInfo.picture || null,
          email_verified: userInfo.email_verified || false,
          oidc_data: userInfo as any,
          expires_at: expiresAt,
        })
        .execute();

      // Redirect to manual linking page
      return c.redirect(`/login/link?state=${linkState}&email=${encodeURIComponent(email || '')}`);
    } catch (error) {
      console.error("OIDC callback error:", error);
      return c.redirect(`/login?error=oidc_processing_failed`);
    }
  }
);

// Manual Account Linking
authRoutes.post(
  "/oidc/link",
  describeRoute({
    description: "Manually link OIDC account to existing xLog account",
    tags: ["auth"],
    responses: {
      200: {
        description: "Account linked successfully",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
      400: {
        description: "Invalid request",
      },
      401: {
        description: "Invalid credentials",
      },
      404: {
        description: "Pending link not found or expired",
      },
    },
  }),
  validator("json", OIDCLinkAccountSchema),
  async (c) => {
    const { email, password, state } = c.req.valid("json");
    const db = getDb();

    // Find pending link
    const pendingLink = await db
      .selectFrom("oidc_pending_links")
      .selectAll()
      .where("state", "=", state)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();

    if (!pendingLink) {
      return c.json({ error: "Pending link not found or expired" }, 404);
    }

    // Verify user credentials
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Check if this OIDC account is already linked to another user
    const existingLink = await db
      .selectFrom("oidc_accounts")
      .selectAll()
      .where("provider", "=", pendingLink.provider)
      .where("provider_account_id", "=", pendingLink.provider_account_id)
      .executeTakeFirst();

    if (existingLink) {
      return c.json({ error: "OIDC account already linked to another user" }, 400);
    }

    // Create OIDC account link
    await db
      .insertInto("oidc_accounts")
      .values({
        id: crypto.randomUUID(),
        user_id: user.id,
        provider: pendingLink.provider,
        provider_account_id: pendingLink.provider_account_id,
        email: pendingLink.email,
        email_verified: pendingLink.email_verified,
        name: pendingLink.name,
        picture: pendingLink.picture,
      })
      .execute();

    // Delete pending link
    await db
      .deleteFrom("oidc_pending_links")
      .where("id", "=", pendingLink.id)
      .execute();

    // Create session and login
    const sessionToken = await createSession(user.id);
    setSessionCookie(c, sessionToken);

    return c.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at.toISOString(),
    });
  }
);

// Get linked OIDC accounts for current user
authRoutes.get(
  "/oidc/accounts",
  describeRoute({
    description: "Get OIDC accounts linked to current user",
    tags: ["auth"],
    responses: {
      200: {
        description: "List of linked OIDC accounts",
        content: {
          "application/json": {
            schema: resolver(OIDCAccountResponseSchema.array()),
          },
        },
      },
      401: {
        description: "Unauthorized",
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = getDb();
    const accounts = await db
      .selectFrom("oidc_accounts")
      .selectAll()
      .where("user_id", "=", user.id)
      .execute();

    return c.json(
      accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        email: account.email,
        name: account.name,
        created_at: account.created_at.toISOString(),
      }))
    );
  }
);

// Unlink OIDC account
authRoutes.delete(
  "/oidc/accounts/:accountId",
  describeRoute({
    description: "Unlink an OIDC account from current user",
    tags: ["auth"],
    responses: {
      200: {
        description: "Account unlinked successfully",
      },
      401: {
        description: "Unauthorized",
      },
      404: {
        description: "Account not found",
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const accountId = c.req.param("accountId");
    const db = getDb();

    // Verify account belongs to user
    const account = await db
      .selectFrom("oidc_accounts")
      .selectAll()
      .where("id", "=", accountId)
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    // Delete OIDC account link
    await db
      .deleteFrom("oidc_accounts")
      .where("id", "=", accountId)
      .execute();

    return c.json({ message: "Account unlinked successfully" });
  }
);
