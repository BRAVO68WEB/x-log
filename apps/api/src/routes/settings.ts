import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb, clearInstanceSettingsCache } from "@xlog/db";
import {
  sessionMiddleware,
  requireAuth,
  requireAdmin,
} from "../middleware/session";

const InstanceSettingsUpdateSchema = z.object({
  instance_name: z.string().min(1).optional(),
  instance_description: z.string().optional().nullable(),
  instance_domain: z.string().min(1).optional(),
  open_registrations: z.boolean().optional(),
  admin_email: z.string().email().optional().nullable(),
  smtp_url: z.string().url().optional().nullable(),
  federation_enabled: z.boolean().optional(),
});

const InstanceSettingsResponseSchema = z.object({
  id: z.number(),
  instance_name: z.string(),
  instance_description: z.string().nullable(),
  instance_domain: z.string(),
  open_registrations: z.boolean(),
  admin_email: z.string().nullable(),
  smtp_url: z.string().nullable(),
  federation_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const settingsRoutes = new Hono().use("*", sessionMiddleware);

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

    return c.json({
      id: settings.id,
      instance_name: settings.instance_name,
      instance_description: settings.instance_description,
      instance_domain: settings.instance_domain,
      open_registrations: settings.open_registrations,
      admin_email: settings.admin_email,
      smtp_url: settings.smtp_url,
      federation_enabled: settings.federation_enabled,
      created_at: settings.created_at.toISOString(),
      updated_at: settings.updated_at.toISOString(),
    });
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
    if (data.open_registrations !== undefined) {
      updateData.open_registrations = data.open_registrations;
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

    // Update settings
    await db
      .updateTable("instance_settings")
      .set(updateData)
      .where("id", "=", 1)
      .execute();

    // Clear cache so new domain is used immediately
    clearInstanceSettingsCache();

    // Fetch updated settings
    const updated = await db
      .selectFrom("instance_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    return c.json({
      id: updated!.id,
      instance_name: updated!.instance_name,
      instance_description: updated!.instance_description,
      instance_domain: updated!.instance_domain,
      open_registrations: updated!.open_registrations,
      admin_email: updated!.admin_email,
      smtp_url: updated!.smtp_url,
      federation_enabled: updated!.federation_enabled,
      created_at: updated!.created_at.toISOString(),
      updated_at: updated!.updated_at.toISOString(),
    });
  }
);

