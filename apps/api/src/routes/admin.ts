import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAdmin } from "../middleware/session";
import {
  FEATURE_KEYS,
  getAllFeatures,
  getFeatureStatus,
  setFeatureEnabled,
} from "../lib/features";

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
