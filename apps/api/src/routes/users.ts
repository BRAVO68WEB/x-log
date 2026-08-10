import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserResponseSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAuth, requireAuthor } from "../middleware/session";
import {
  createUserMcpKey,
  listUserMcpKeys,
  revokeUserMcpKey,
} from "../lib/mcp-keys";

export const usersRoutes = new Hono().use("*", sessionMiddleware);

const PasswordUpdateSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

usersRoutes.get(
  "/me",
  describeRoute({
    description: "Get current user",
    tags: ["users"],
    responses: {
      200: {
        description: "Current user",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
      },
    },
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();

    const dbUser = await db
      .selectFrom("users")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.id",
        "users.username",
        "users.email",
        "users.role",
        "users.created_at",
        "user_profiles.avatar_url",
      ])
      .where("users.id", "=", user.id)
      .executeTakeFirst();

    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const sessionExp = c.get("sessionExp");
    return c.json({
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role,
      created_at: dbUser.created_at.toISOString(),
      avatar_url: dbUser.avatar_url ?? null,
      // Session metadata (B68-91): helps clients show expiry / re-auth
      auth_method: c.get("authMethod") ?? null,
      session_expires_at:
        typeof sessionExp === "number"
          ? new Date(sessionExp * 1000).toISOString()
          : null,
    });
  }
);

usersRoutes.patch(
  "/me",
  describeRoute({
    description: "Update current user",
    tags: ["users"],
    responses: {
      200: {
        description: "User updated",
        content: {
          "application/json": {
            schema: resolver(UserResponseSchema),
          },
        },
      },
    },
  }),
  validator("json", UserResponseSchema.partial()),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const db = getDb();

    await db
      .updateTable("users")
      .set({
        email: data.email ?? undefined,
        updated_at: new Date(),
      })
      .where("id", "=", user.id)
      .execute();

    const updated = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", user.id)
      .executeTakeFirst();

    return c.json({
      id: updated!.id,
      username: updated!.username,
      email: updated!.email,
      role: updated!.role,
      created_at: updated!.created_at.toISOString(),
    });
  }
);

usersRoutes.patch(
  "/me/password",
  describeRoute({
    description: "Change current user's password",
    tags: ["users"],
    responses: {
      200: {
        description: "Password changed",
        content: {
          "application/json": {
            schema: resolver(z.object({ message: z.string() })),
          },
        },
      },
      400: { description: "Invalid request" },
      401: { description: "Unauthorized" },
    },
  }),
  validator("json", PasswordUpdateSchema),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const db = getDb();

    const dbUser = await db
      .selectFrom("users")
      .select(["id", "password_hash"])
      .where("id", "=", user.id)
      .executeTakeFirst();

    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }

    if (!dbUser.password_hash) {
      return c.json({ error: "This account does not have a password set" }, 400);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      data.current_password,
      dbUser.password_hash
    );

    if (!isCurrentPasswordValid) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    const passwordHash = await bcrypt.hash(data.new_password, 10);

    await db
      .updateTable("users")
      .set({
        password_hash: passwordHash,
        updated_at: new Date(),
      })
      .where("id", "=", user.id)
      .execute();

    return c.json({ message: "Password changed" });
  }
);

// ── MCP per-user API keys ──────────────────────────────────────────

usersRoutes.get("/me/mcp-keys", requireAuth, requireAuthor, async (c) => {
  const user = c.get("user")!;
  const keys = await listUserMcpKeys(user.id);
  return c.json({ keys });
});

usersRoutes.post(
  "/me/mcp-keys",
  requireAuth,
  requireAuthor,
  validator(
    "json",
    z.object({
      name: z.string().min(1).max(80).optional(),
      scopes: z.enum(["read", "write", "read_write"]).optional(),
    })
  ),
  async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const created = await createUserMcpKey({
      userId: user.id,
      name: body.name,
      scopes: body.scopes,
    });
    return c.json(created, 201);
  }
);

usersRoutes.delete("/me/mcp-keys/:id", requireAuth, requireAuthor, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const ok = await revokeUserMcpKey(user.id, id);
  if (!ok) return c.json({ error: "Key not found" }, 404);
  return c.json({ message: "Key revoked" });
});
