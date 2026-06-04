import { Hono } from "hono";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAdmin } from "../middleware/session";
import {
  Feature,
  isFeatureEnabledAsync,
  clearFeatureCacheFor,
  isEnvOverrideActive,
  getFeatureEnvKey,
} from "../lib/features";

export const adminRoutes = new Hono().use("*", sessionMiddleware);

adminRoutes.get("/deliveries/failed", requireAdmin, async (c) => {
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

  return c.json({ items });
});

// Feature flags management
adminRoutes.get("/features", requireAdmin, async (c) => {
  const features = await Promise.all(
    Object.values(Feature).map(async (feature) => ({
      feature,
      enabled: await isFeatureEnabledAsync(feature),
      envOverride: isEnvOverrideActive(feature),
      envValue: process.env[getFeatureEnvKey(feature)] || null,
    }))
  );
  return c.json({ features });
});

adminRoutes.put("/features/:feature", requireAdmin, async (c) => {
  const feature = c.req.param("feature") as Feature;
  const { enabled } = await c.req.json<{ enabled: boolean }>();

  // Check if feature is a valid enum value
  if (!Object.values(Feature).includes(feature)) {
    return c.json({ error: "Invalid feature" }, 400);
  }

  const db = getDb();
  // Use Kysely's insert/update pattern
  await db
    .insertInto("feature_flags")
    .values({
      feature,
      enabled,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("feature").doUpdateSet({
        enabled,
        updated_at: new Date(),
      })
    )
    .execute();

  // Clear cache for this feature
  clearFeatureCacheFor(feature);

  return c.json({ feature, enabled });
});
