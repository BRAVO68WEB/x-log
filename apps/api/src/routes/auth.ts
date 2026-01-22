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
      200: {
        description: "OIDC authorization URL",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                auth_url: {
                  type: "string",
                  description: "URL to redirect to for OIDC authentication",
                },
              },
              required: ["auth_url"],
            },
          },
        },
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

    return c.json({ auth_url: authUrl });
  }
);

// OIDC Callback Handler
authRoutes.get(
  "/oidc/callback",
  describeRoute({
    description: "OIDC callback handler with auto-linking, manual linking, or account linking for logged-in users",
    tags: ["auth"],
    responses: {
      200: {
        description: "OIDC callback result",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["login", "link", "pending_link", "already_linked", "error"],
                  description: "Action taken by the callback",
                },
                redirect_url: {
                  type: "string",
                  description: "URL to redirect to (frontend should handle)",
                },
                user: {
                  type: "object",
                  description: "User data if logged in or linked",
                  properties: {
                    id: { type: "string" },
                    username: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                  },
                },
                link_state: {
                  type: "string",
                  description: "Pending link state for manual linking",
                },
                error: {
                  type: "string",
                  description: "Error message if action is 'error'",
                },
              },
              required: ["action", "redirect_url"],
            },
          },
        },
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
    const currentUser = c.get("user"); // Check if user is already logged in

    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    // Handle OIDC errors
    if (error) {
      console.error("OIDC error:", error, errorDescription);
      return c.json({
        action: "error",
        redirect_url: `/login?error=oidc_failed&description=${encodeURIComponent(errorDescription || error)}`,
        error: errorDescription || error,
      }, 400);
    }

    if (!code || !state) {
      return c.json({
        action: "error",
        redirect_url: "/login?error=invalid_callback",
        error: "Missing code or state parameter",
      }, 400);
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

      // Case 1: User is already logged in
      if (currentUser) {
        if (existingOIDCAccount) {
          if (existingOIDCAccount.user_id === currentUser.id) {
            // OIDC account already linked to current user
            return c.json({
              action: "already_linked",
              redirect_url: "/settings",
              user: {
                id: currentUser.id,
                username: currentUser.username,
                email: currentUser.email,
                role: currentUser.role,
              },
            });
          } else {
            // OIDC account linked to a different user
            return c.json({
              action: "error",
              redirect_url: "/settings",
              error: "This OIDC account is already linked to another user",
            }, 400);
          }
        }

        // Link OIDC account to current logged-in user
        await db
          .insertInto("oidc_accounts")
          .values({
            id: crypto.randomUUID(),
            user_id: currentUser.id,
            provider,
            provider_account_id: providerAccountId,
            email: email,
            email_verified: userInfo.email_verified || false,
            name: userInfo.name || userInfo.preferred_username || null,
            picture: userInfo.picture || null,
          })
          .execute();

        return c.json({
          action: "link",
          redirect_url: "/settings",
          user: {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
          },
        });
      }

      // Case 2: User is not logged in
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
          return c.json({
            action: "login",
            redirect_url: "/",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
          });
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
          return c.json({
            action: "login",
            redirect_url: "/?linked=success",
            user: {
              id: existingUser.id,
              username: existingUser.username,
              email: existingUser.email,
              role: existingUser.role,
            },
          });
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

      return c.json({
        action: "pending_link",
        redirect_url: `/login/link?state=${linkState}&email=${encodeURIComponent(email || '')}`,
        link_state: linkState,
      });
    } catch (error) {
      console.error("OIDC callback error:", error);
      return c.json({
        action: "error",
        redirect_url: `/login?error=oidc_processing_failed`,
        error: error instanceof Error ? error.message : "OIDC processing failed",
      }, 500);
    }
  }
);

// Manual Account Linking
authRoutes.post(
  "/oidc/link",
  describeRoute({
    description: "Manually link OIDC account to existing xLog account. If user is logged in, password is not required.",
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
        description: "Invalid credentials or unauthorized",
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
    const currentUser = c.get("user"); // Check if user is already logged in

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

    let user;

    // If user is already logged in, link to their account
    if (currentUser) {
      user = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", currentUser.id)
        .executeTakeFirst();

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Verify email matches if provided
      if (email && user.email !== email) {
        return c.json({ error: "Email does not match your account" }, 400);
      }
    } else {
      // User is not logged in - require password verification
      if (!email || !password) {
        return c.json({ error: "Email and password are required when not logged in" }, 400);
      }

      user = await db
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
    }

    // Check if this OIDC account is already linked to another user
    const existingLink = await db
      .selectFrom("oidc_accounts")
      .selectAll()
      .where("provider", "=", pendingLink.provider)
      .where("provider_account_id", "=", pendingLink.provider_account_id)
      .executeTakeFirst();

    if (existingLink) {
      if (existingLink.user_id === user.id) {
        // Already linked to this user - just delete pending link
        await db
          .deleteFrom("oidc_pending_links")
          .where("id", "=", pendingLink.id)
          .execute();

        return c.json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.created_at.toISOString(),
        });
      }
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

    // Create session if user was not logged in
    if (!currentUser) {
      const sessionToken = await createSession(user.id);
      setSessionCookie(c, sessionToken);
    }

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
