import { Hono } from "hono";
import { z } from "zod";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import {
  clientIpFromHeaders,
  collectPageView,
  getAnalyticsSummary,
  isAnalyticsEnabled,
} from "../services/analytics";

export const analyticsRoutes = new Hono();

const CollectSchema = z.object({
  path: z.string().min(1).max(2048),
  post_id: z.string().optional().nullable(),
  referrer: z.string().max(2048).optional().nullable(),
  session_id: z.string().max(128).optional().nullable(),
});

/**
 * Public collect endpoint — no auth.
 * POST /api/analytics/collect
 */
analyticsRoutes.post("/collect", async (c) => {
  if (!(await isAnalyticsEnabled())) {
    return c.json({ ok: true, recorded: false }, 200);
  }

  let body: z.infer<typeof CollectSchema>;
  try {
    body = CollectSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid body" }, 400);
  }

  const dnt =
    c.req.header("dnt") === "1" ||
    c.req.header("DNT") === "1";
  const gpc =
    c.req.header("sec-gpc") === "1" ||
    c.req.header("Sec-GPC") === "1";

  const recorded = await collectPageView({
    path: body.path,
    postId: body.post_id,
    referrer: body.referrer ?? c.req.header("referer") ?? null,
    sessionId: body.session_id,
    userAgent: c.req.header("user-agent"),
    ip: clientIpFromHeaders({
      get: (n) => c.req.header(n),
    }),
    dnt,
    gpc,
  });

  return c.json({ ok: true, recorded }, recorded ? 201 : 200);
});

/**
 * Public: whether first-party analytics beacons should fire.
 * GET /api/analytics/status
 */
analyticsRoutes.get("/status", async (c) => {
  const enabled = await isAnalyticsEnabled();
  return c.json({ enabled });
});

/**
 * Operator / author summary (authenticated).
 * GET /api/analytics/summary?days=30
 * Admin: all views; author: own posts only.
 * 404 when feature flag `analytics` is off.
 */
analyticsRoutes.get(
  "/summary",
  sessionMiddleware,
  requireAuth,
  async (c) => {
    if (!(await isAnalyticsEnabled())) {
      return c.json({ error: "Analytics disabled" }, 404);
    }

    const user = c.get("user")!;
    const days = Math.min(365, Math.max(1, Number(c.req.query("days") || 30)));

    // Authors only see own posts; admin sees all
    const authorId = user.role === "admin" ? undefined : user.id;
    const summary = await getAnalyticsSummary({ authorId, days });
    return c.json(summary);
  }
);
