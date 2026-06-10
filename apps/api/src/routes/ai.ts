import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";
import {
  isAIConfigured,
  generateTitle,
  generateOutline,
  enhanceContent,
  generateMeta,
  translateContent,
} from "../services/ai";

export const aiRoutes = new Hono().use("*", sessionMiddleware);

async function checkAI(c: any): Promise<boolean> {
  const enabled = await isFeatureEnabled("ai_writer");
  if (!enabled) {
    c.json({ error: "AI writer feature is not enabled" }, 403);
    return false;
  }
  if (!isAIConfigured()) {
    c.json({ error: "AI is not configured. Set OPENAI_API_KEY." }, 503);
    return false;
  }
  return true;
}

// ── POST /ai/title ─────────────────────────────────────────────────

aiRoutes.post(
  "/title",
  describeRoute({
    description: "Generate a title from content",
    tags: ["ai"],
    responses: {
      200: { description: "Generated title" },
      403: { description: "Feature disabled" },
      503: { description: "AI not configured" },
    },
  }),
  validator(
    "json",
    z.object({ content: z.string().min(1).max(50000) })
  ),
  requireAuth,
  async (c) => {
    if (!(await checkAI(c))) return;
    const { content } = c.req.valid("json");
    const title = await generateTitle(content);
    return c.json({ title });
  }
);

// ── POST /ai/outline ───────────────────────────────────────────────

aiRoutes.post(
  "/outline",
  describeRoute({
    description: "Generate an outline from a topic",
    tags: ["ai"],
    responses: {
      200: { description: "Generated outline" },
      403: { description: "Feature disabled" },
      503: { description: "AI not configured" },
    },
  }),
  validator(
    "json",
    z.object({ topic: z.string().min(1).max(5000) })
  ),
  requireAuth,
  async (c) => {
    if (!(await checkAI(c))) return;
    const { topic } = c.req.valid("json");
    const outline = await generateOutline(topic);
    return c.json({ outline });
  }
);

// ── POST /ai/enhance ───────────────────────────────────────────────

aiRoutes.post(
  "/enhance",
  describeRoute({
    description: "Enhance existing content",
    tags: ["ai"],
    responses: {
      200: { description: "Enhanced content" },
      403: { description: "Feature disabled" },
      503: { description: "AI not configured" },
    },
  }),
  validator(
    "json",
    z.object({
      content: z.string().min(1).max(50000),
      action: z.enum(["expand", "condense", "engaging", "fix-grammar"]),
    })
  ),
  requireAuth,
  async (c) => {
    if (!(await checkAI(c))) return;
    const { content, action } = c.req.valid("json");
    const enhanced = await enhanceContent(content, action);
    return c.json({ content: enhanced });
  }
);

// ── POST /ai/meta ──────────────────────────────────────────────────

aiRoutes.post(
  "/meta",
  describeRoute({
    description: "Generate SEO metadata from content",
    tags: ["ai"],
    responses: {
      200: { description: "Generated metadata" },
      403: { description: "Feature disabled" },
      503: { description: "AI not configured" },
    },
  }),
  validator(
    "json",
    z.object({ content: z.string().min(1).max(50000) })
  ),
  requireAuth,
  async (c) => {
    if (!(await checkAI(c))) return;
    const { content } = c.req.valid("json");
    const meta = await generateMeta(content);
    return c.json(meta);
  }
);

// ── POST /ai/translate ─────────────────────────────────────────────

aiRoutes.post(
  "/translate",
  describeRoute({
    description: "Translate content to another language",
    tags: ["ai"],
    responses: {
      200: { description: "Translated content" },
      403: { description: "Feature disabled" },
      503: { description: "AI not configured" },
    },
  }),
  validator(
    "json",
    z.object({
      content: z.string().min(1).max(50000),
      language: z.string().min(1).max(50),
    })
  ),
  requireAuth,
  async (c) => {
    if (!(await checkAI(c))) return;
    const { content, language } = c.req.valid("json");
    const translated = await translateContent(content, language);
    return c.json({ content: translated, language });
  }
);
