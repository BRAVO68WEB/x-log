import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  getDb,
  clearInstanceSettingsCache,
  getPrimaryUser,
  setPrimaryUserId,
  countLocalUsers,
  deriveInstanceMode,
} from "@xlog/db";
import { sessionMiddleware, requireAuth, requireAdmin } from "../middleware/session";
import { followRemoteActor } from "../lib/activitypub";

const InstanceSettingsUpdateSchema = z.object({
  instance_name: z.string().min(1).optional(),
  instance_description: z.string().optional().nullable(),
  instance_domain: z.string().min(1).optional(),
  admin_email: z.string().email().optional().nullable(),
  smtp_url: z.string().url().optional().nullable(),
  federation_enabled: z.boolean().optional(),
  following_enabled: z.boolean().optional(),
  use_profile_as_landing: z.boolean().optional(),
  primary_user_id: z.string().uuid().optional().nullable(),
  theme_id: z
    .enum([
      "system",
      "xlog-default",
      "blues",
      "marigold",
      "aurora",
      "sunburst",
      "monochrome",
      "mocha",
      "amoled",
      "off-white",
      "dracula",
      "mint-grove",
      "neon-circuit",
      "signal",
      "retro-classic",
    ])
    .optional(),
  ai_base_url: z.string().url().optional().nullable(),
  ai_api_key: z.string().optional().nullable(),
  ai_model: z.string().optional().nullable(),
  ai_max_tokens: z.number().int().min(1).max(128000).optional().nullable(),
  ai_temperature: z.number().min(0).max(2).optional().nullable(),
});

const InstanceSettingsResponseSchema = z.object({
  id: z.number(),
  instance_name: z.string(),
  instance_description: z.string().nullable(),
  instance_domain: z.string(),
  admin_email: z.string().nullable(),
  smtp_url: z.string().nullable(),
  federation_enabled: z.boolean(),
  following_enabled: z.boolean(),
  use_profile_as_landing: z.boolean(),
  primary_user_id: z.string().nullable(),
  primary_username: z.string().nullable(),
  instance_mode: z.enum(["solo", "multi"]),
  local_user_count: z.number().int(),
  theme_id: z.enum([
    "system",
    "xlog-default",
    "blues",
    "marigold",
    "aurora",
    "sunburst",
    "monochrome",
    "mocha",
    "amoled",
    "off-white",
    "dracula",
    "mint-grove",
    "neon-circuit",
    "signal",
    "retro-classic",
  ]),
  ai_base_url: z.string().nullable(),
  ai_api_key: z.string().nullable(),
  ai_model: z.string().nullable(),
  ai_max_tokens: z.number().nullable(),
  ai_temperature: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

async function formatSettingsResponse(settings: any) {
  const primary = await getPrimaryUser();
  const userCount = await countLocalUsers();
  return {
    id: settings.id,
    instance_name: settings.instance_name,
    instance_description: settings.instance_description,
    instance_domain: settings.instance_domain,
    admin_email: settings.admin_email,
    smtp_url: settings.smtp_url,
    federation_enabled: settings.federation_enabled,
    following_enabled: settings.following_enabled,
    use_profile_as_landing: settings.use_profile_as_landing,
    primary_user_id: settings.primary_user_id ?? primary?.id ?? null,
    primary_username: primary?.username ?? null,
    instance_mode: deriveInstanceMode(userCount),
    local_user_count: userCount,
    theme_id: settings.theme_id,
    ai_base_url: settings.ai_base_url ?? null,
    ai_api_key: settings.ai_api_key ?? null,
    ai_model: settings.ai_model ?? null,
    ai_max_tokens: settings.ai_max_tokens ?? null,
    ai_temperature: settings.ai_temperature ?? null,
    created_at: settings.created_at.toISOString(),
    updated_at: settings.updated_at.toISOString(),
  };
}

export const settingsRoutes = new Hono().use("*", sessionMiddleware);

settingsRoutes.post(
  "/following",
  describeRoute({
    description: "Follow a remote ActivityPub actor from the instance primary profile",
    tags: ["settings"],
    responses: {
      202: {
        description: "Follow request sent",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
                actor: z.string(),
                inbox_url: z.string(),
                accepted: z.boolean(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", z.object({ remote: z.string().min(1) })),
  requireAuth,
  requireAdmin,
  async (c) => {
    const db = getDb();
    const settings = await db
      .selectFrom("instance_settings")
      .select(["following_enabled"])
      .where("id", "=", 1)
      .executeTakeFirst();

    if (!settings?.following_enabled) {
      return c.json({ error: "Following is currently disabled" }, 403);
    }

    const primaryProfile = await getPrimaryUser();
    if (!primaryProfile) {
      return c.json({ error: "No primary profile found" }, 404);
    }

    try {
      const result = await followRemoteActor({
        db,
        localUser: { id: primaryProfile.id, username: primaryProfile.username },
        remote: c.req.valid("json").remote,
      });
      return c.json({ success: true, ...result }, 202);
    } catch (error) {
      return c.json({ error: String(error) }, 400);
    }
  }
);

settingsRoutes.get(
  "/",
  describeRoute({
    description: "Get instance settings",
    tags: ["settings"],
    responses: {
      200: {
        description: "Instance settings",
        content: {
          "application/json": {
            schema: resolver(InstanceSettingsResponseSchema),
          },
        },
      },
      404: {
        description: "Settings not found",
      },
    },
  }),
  requireAuth,
  requireAdmin,
  async (c) => {
    const db = getDb();

    const settings = await db
      .selectFrom("instance_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    if (!settings) {
      return c.json({ error: "Settings not found" }, 404);
    }

    return c.json(await formatSettingsResponse(settings));
  }
);

settingsRoutes.patch(
  "/",
  describeRoute({
    description: "Update instance settings",
    tags: ["settings"],
    responses: {
      200: {
        description: "Settings updated",
        content: {
          "application/json": {
            schema: resolver(InstanceSettingsResponseSchema),
          },
        },
      },
      404: {
        description: "Settings not found",
      },
    },
  }),
  validator("json", InstanceSettingsUpdateSchema),
  requireAuth,
  requireAdmin,
  async (c) => {
    const db = getDb();
    const data = c.req.valid("json");

    // Check if settings exist
    const existing = await db
      .selectFrom("instance_settings")
      .select("id")
      .where("id", "=", 1)
      .executeTakeFirst();

    if (!existing) {
      return c.json({ error: "Settings not found" }, 404);
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.instance_name !== undefined) {
      updateData.instance_name = data.instance_name;
    }
    if (data.instance_description !== undefined) {
      updateData.instance_description = data.instance_description;
    }
    if (data.instance_domain !== undefined) {
      updateData.instance_domain = data.instance_domain;
    }
    if (data.admin_email !== undefined) {
      updateData.admin_email = data.admin_email;
    }
    if (data.smtp_url !== undefined) {
      updateData.smtp_url = data.smtp_url;
    }
    if (data.federation_enabled !== undefined) {
      updateData.federation_enabled = data.federation_enabled;
    }
    if (data.following_enabled !== undefined) {
      updateData.following_enabled = data.following_enabled;
    }
    if (data.use_profile_as_landing !== undefined) {
      updateData.use_profile_as_landing = data.use_profile_as_landing;
    }
    if (data.primary_user_id !== undefined && data.primary_user_id !== null) {
      try {
        await setPrimaryUserId(data.primary_user_id);
      } catch {
        return c.json({ error: "primary_user_id must be an existing local user" }, 400);
      }
    }
    if (data.theme_id !== undefined) {
      updateData.theme_id = data.theme_id;
    }
    if (data.ai_base_url !== undefined) {
      updateData.ai_base_url = data.ai_base_url;
    }
    if (data.ai_api_key !== undefined) {
      updateData.ai_api_key = data.ai_api_key;
    }
    if (data.ai_model !== undefined) {
      updateData.ai_model = data.ai_model;
    }
    if (data.ai_max_tokens !== undefined) {
      updateData.ai_max_tokens = data.ai_max_tokens;
    }
    if (data.ai_temperature !== undefined) {
      updateData.ai_temperature = data.ai_temperature;
    }

    // Update settings
    await db.updateTable("instance_settings").set(updateData).where("id", "=", 1).execute();

    // Clear cache so new domain is used immediately
    clearInstanceSettingsCache();

    // Fetch updated settings
    const updated = await db
      .selectFrom("instance_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    return c.json(await formatSettingsResponse(updated!));
  }
);
