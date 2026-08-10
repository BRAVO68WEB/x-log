import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import { sessionMiddleware, requireAdmin } from "../middleware/session";
import {
  FEATURE_KEYS,
  getAllFeatures,
  getFeatureStatus,
  setFeatureEnabled,
} from "../lib/features";
import { createInvite, inviteStatus } from "../lib/invites";
import { assertUnderAuthorCap, countLocalAuthors } from "../lib/local-users";

export const adminRoutes = new Hono().use("*", sessionMiddleware);

// ── Failed deliveries ──────────────────────────────────────────────

adminRoutes.get(
  "/deliveries/failed",
  describeRoute({
    description: "List failed federation deliveries",
    tags: ["admin"],
    responses: {
      200: {
        description: "Failed deliveries",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                items: z.array(
                  z.object({
                    activity_id: z.string(),
                    remote_inbox: z.string(),
                    status: z.string(),
                    attempt_count: z.number(),
                    last_error: z.string().nullable(),
                    updated_at: z.string(),
                    activity_json: z.any().nullable(),
                  })
                ),
              })
            ),
          },
        },
      },
    },
  }),
  requireAdmin,
  async (c) => {
    const db = getDb();
    const items = await db
      .selectFrom("deliveries")
      .select([
        "activity_id",
        "remote_inbox",
        "status",
        "attempt_count",
        "last_error",
        "updated_at",
        "activity_json",
      ])
      .where("status", "=", "failed")
      .orderBy("updated_at", "desc")
      .limit(100)
      .execute();

    return c.json({
      items: items.map((item) => ({
        ...item,
        updated_at: item.updated_at.toISOString(),
      })),
    });
  }
);

// ── Feature flags ──────────────────────────────────────────────────

const FeatureItemSchema = z.object({
  feature: z.string(),
  enabled: z.boolean(),
  envOverride: z.boolean(),
  envValue: z.string().nullable(),
});

adminRoutes.get(
  "/features",
  describeRoute({
    description: "List all feature flags with their status",
    tags: ["admin", "features"],
    responses: {
      200: {
        description: "Feature flags list",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                features: z.array(FeatureItemSchema),
              })
            ),
          },
        },
      },
    },
  }),
  requireAdmin,
  async (c) => {
    const features = await getAllFeatures();
    const result = FEATURE_KEYS.map((key) => {
      const entry = features.get(key) ?? {
        enabled: false,
        envOverride: false,
        envValue: null,
      };
      return {
        feature: key,
        enabled: entry.enabled,
        envOverride: entry.envOverride,
        envValue: entry.envValue,
      };
    });

    return c.json({ features: result });
  }
);

adminRoutes.put(
  "/features/:feature",
  describeRoute({
    description: "Toggle a feature flag",
    tags: ["admin", "features"],
    responses: {
      200: {
        description: "Feature updated",
        content: {
          "application/json": {
            schema: resolver(FeatureItemSchema),
          },
        },
      },
      400: { description: "Invalid feature key" },
      409: { description: "Feature is locked by environment variable" },
    },
  }),
  validator(
    "json",
    z.object({
      enabled: z.boolean(),
    })
  ),
  requireAdmin,
  async (c) => {
    const feature = c.req.param("feature");

    if (!FEATURE_KEYS.includes(feature as (typeof FEATURE_KEYS)[number])) {
      return c.json(
        { error: `Unknown feature: ${feature}. Valid: ${FEATURE_KEYS.join(", ")}` },
        400
      );
    }

    const status = await getFeatureStatus(feature);
    if (status.envOverride) {
      return c.json(
        {
          error: `Feature "${feature}" is locked by environment variable. Remove FEATURE_${feature.toUpperCase()} to manage via UI.`,
        },
        409
      );
    }

    const body = c.req.valid("json");
    await setFeatureEnabled(feature, body.enabled);

    const updated = await getFeatureStatus(feature);
    return c.json({
      feature,
      enabled: updated.enabled,
      envOverride: updated.envOverride,
      envValue: updated.envValue,
    });
  }
);

// ── Local users ────────────────────────────────────────────────────

adminRoutes.get("/users", requireAdmin, async (c) => {
  const db = getDb();
  const env = getEnv();
  const users = await db
    .selectFrom("users")
    .select(["id", "username", "email", "role", "is_active", "created_at"])
    .orderBy("created_at", "asc")
    .execute();

  const authorCount = await countLocalAuthors();

  return c.json({
    max_local_authors: env.MAX_LOCAL_AUTHORS,
    active_author_count: authorCount,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      is_active: u.is_active !== false,
      created_at: u.created_at.toISOString(),
    })),
  });
});

adminRoutes.patch(
  "/users/:id",
  requireAdmin,
  validator(
    "json",
    z.object({
      is_active: z.boolean().optional(),
      role: z.enum(["admin", "author"]).optional(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const admin = c.get("user")!;
    const db = getDb();

    const target = await db
      .selectFrom("users")
      .select(["id", "username", "role", "is_active"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!target) {
      return c.json({ error: "User not found" }, 404);
    }

    // Cannot deactivate yourself
    if (body.is_active === false && id === admin.id) {
      return c.json({ error: "Cannot deactivate your own account" }, 400);
    }

    // Cannot demote last admin
    if (body.role === "author" && target.role === "admin") {
      const admins = await db
        .selectFrom("users")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("role", "=", "admin")
        .where("is_active", "=", true)
        .executeTakeFirst();
      if (Number(admins?.count || 0) <= 1) {
        return c.json({ error: "Cannot demote the last active admin" }, 400);
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date() };
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.role !== undefined) update.role = body.role;

    await db.updateTable("users").set(update).where("id", "=", id).execute();

    const updated = await db
      .selectFrom("users")
      .select(["id", "username", "email", "role", "is_active", "created_at"])
      .where("id", "=", id)
      .executeTakeFirst();

    return c.json({
      id: updated!.id,
      username: updated!.username,
      email: updated!.email,
      role: updated!.role,
      is_active: updated!.is_active !== false,
      created_at: updated!.created_at.toISOString(),
    });
  }
);

// ── Invites ────────────────────────────────────────────────────────

adminRoutes.get("/invites", requireAdmin, async (c) => {
  const db = getDb();
  const rows = await db
    .selectFrom("user_invites")
    .leftJoin("users as inviter", "inviter.id", "user_invites.invited_by")
    .select([
      "user_invites.id",
      "user_invites.email",
      "user_invites.role",
      "user_invites.expires_at",
      "user_invites.accepted_at",
      "user_invites.revoked_at",
      "user_invites.created_at",
      "user_invites.accepted_user_id",
      "inviter.username as invited_by_username",
    ])
    .orderBy("user_invites.created_at", "desc")
    .limit(50)
    .execute();

  return c.json({
    invites: rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: inviteStatus(r),
      expires_at: new Date(r.expires_at).toISOString(),
      accepted_at: r.accepted_at ? new Date(r.accepted_at).toISOString() : null,
      revoked_at: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      invited_by_username: r.invited_by_username,
      accepted_user_id: r.accepted_user_id,
    })),
  });
});

adminRoutes.post(
  "/invites",
  requireAdmin,
  validator(
    "json",
    z.object({
      email: z.string().email().optional().nullable(),
    })
  ),
  async (c) => {
    const admin = c.get("user")!;
    const body = c.req.valid("json");

    try {
      await assertUnderAuthorCap();
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Author cap reached" },
        403
      );
    }

    const invite = await createInvite({
      invitedBy: admin.id,
      email: body.email,
      role: "author",
    });

    // Token returned once; store hash only
    return c.json(
      {
        id: invite.id,
        token: invite.token,
        expires_at: invite.expires_at,
        invite_path: `/invite/${invite.token}`,
        email: body.email || null,
      },
      201
    );
  }
);

adminRoutes.delete("/invites/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const invite = await db
    .selectFrom("user_invites")
    .select(["id", "accepted_at", "revoked_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!invite) {
    return c.json({ error: "Invite not found" }, 404);
  }
  if (invite.accepted_at) {
    return c.json({ error: "Invite already accepted" }, 400);
  }

  await db
    .updateTable("user_invites")
    .set({ revoked_at: new Date() })
    .where("id", "=", id)
    .execute();

  return c.json({ message: "Invite revoked" });
});
