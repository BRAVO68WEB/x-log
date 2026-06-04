import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  generateTitle,
  generateOutline,
  enhanceContent,
  generateMeta,
  translateContent,
  generateFirstDraft,
  isConfigured,
} from "../services/ai";
import { sessionMiddleware, requireAuth } from "../middleware/session";

export const aiRoutes = new Hono().use("*", sessionMiddleware);

const TitleSchema = z.object({
  content: z.string().min(1),
  model: z.string().optional(),
});

const OutlineSchema = z.object({
  topic: z.string().min(1),
  model: z.string().optional(),
});

const EnhanceSchema = z.object({
  content: z.string().min(1),
  action: z.enum(["expand", "condense", "engaging", "clear"]),
  model: z.string().optional(),
});

const MetaSchema = z.object({
  content: z.string().min(1),
  model: z.string().optional(),
});

const TranslateSchema = z.object({
  content: z.string().min(1),
  target_lang: z.string().min(2),
  model: z.string().optional(),
});

const DraftSchema = z.object({
  topic: z.string().min(1),
  model: z.string().optional(),
});

aiRoutes.post(
  "/title",
  describeRoute({
    description: "Generate a title from content",
    tags: ["ai"],
    responses: {
      200: {
        description: "Generated title",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                title: z.string(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", TitleSchema),
  async (c) => {
    const { content, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const title = await generateTitle(content, model);
    return c.json({ title, configured: true });
  }
);

aiRoutes.post(
  "/outline",
  describeRoute({
    description: "Generate an outline from a topic",
    tags: ["ai"],
    responses: {
      200: {
        description: "Generated outline",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                title: z.string(),
                sections: z.array(z.string()),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", OutlineSchema),
  async (c) => {
    const { topic, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const outline = await generateOutline(topic, model);
    return c.json({ ...outline, configured: true });
  }
);

aiRoutes.post(
  "/enhance",
  describeRoute({
    description: "Enhance content (expand, condense, make engaging, or clearer)",
    tags: ["ai"],
    responses: {
      200: {
        description: "Enhanced content",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                content: z.string(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", EnhanceSchema),
  requireAuth,
  async (c) => {
    const { content, action, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const enhanced = await enhanceContent(content, action, model);
    return c.json({ content: enhanced, configured: true });
  }
);

aiRoutes.post(
  "/meta",
  describeRoute({
    description: "Generate SEO metadata (title, description, hashtags)",
    tags: ["ai"],
    responses: {
      200: {
        description: "Generated metadata",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                title: z.string(),
                description: z.string(),
                hashtags: z.array(z.string()),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", MetaSchema),
  async (c) => {
    const { content, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const meta = await generateMeta(content, model);
    return c.json({ ...meta, configured: true });
  }
);

aiRoutes.post(
  "/translate",
  describeRoute({
    description: "Translate content to another language",
    tags: ["ai"],
    responses: {
      200: {
        description: "Translated content",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                content: z.string(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", TranslateSchema),
  requireAuth,
  async (c) => {
    const { content, target_lang, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const translated = await translateContent(content, target_lang, model);
    return c.json({ content: translated, configured: true });
  }
);

aiRoutes.post(
  "/draft",
  describeRoute({
    description: "Generate a first draft from a topic",
    tags: ["ai"],
    responses: {
      200: {
        description: "Generated draft",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                content: z.string(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("json", DraftSchema),
  requireAuth,
  async (c) => {
    const { topic, model } = c.req.valid("json");

    if (!isConfigured()) {
      return c.json({
        error: "AI not configured. Set OPENAI_API_KEY or OPENAI_BASE_URL environment variable.",
        configured: false,
      });
    }

    const draft = await generateFirstDraft(topic, model);
    return c.json({ content: draft, configured: true });
  }
);

aiRoutes.get(
  "/status",
  describeRoute({
    description: "Check AI service configuration status",
    tags: ["ai"],
    responses: {
      200: {
        description: "Configuration status",
      },
    },
  }),
  async (c) => {
    return c.json({
      configured: isConfigured(),
      base_url: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o",
    });
  }
);
