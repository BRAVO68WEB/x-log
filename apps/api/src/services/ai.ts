import OpenAI from "openai";
import { getDb } from "@xlog/db";

let client: OpenAI | null = null;
let cachedBaseUrl: string | null = null;
let cachedApiKey: string | null = null;

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

async function getAIConfig(): Promise<AIConfig> {
  // Try database first
  try {
    const db = getDb();
    const settings = await db
      .selectFrom("instance_settings")
      .select(["ai_base_url", "ai_api_key", "ai_model", "ai_max_tokens", "ai_temperature"])
      .where("id", "=", 1)
      .executeTakeFirst();

    if (settings) {
      const baseUrl = (settings as any).ai_base_url || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      const apiKey = (settings as any).ai_api_key || process.env.OPENAI_API_KEY || "";
      const model = (settings as any).ai_model || process.env.OPENAI_MODEL || "gpt-4o";
      const maxTokens = (settings as any).ai_max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS || "2048", 10);
      const temperature = (settings as any).ai_temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || "0.7");

      return { baseUrl, apiKey, model, maxTokens, temperature };
    }
  } catch {
    // DB not available, fall through to env vars
  }

  // Fall back to env vars
  return {
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2048", 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
  };
}

async function getClient(): Promise<OpenAI | null> {
  const config = await getAIConfig();
  if (!config.apiKey) return null;

  // Recreate client if base URL or API key changed
  if (!client || cachedBaseUrl !== config.baseUrl || cachedApiKey !== config.apiKey) {
    client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
    cachedBaseUrl = config.baseUrl;
    cachedApiKey = config.apiKey;
  }

  return client;
}

export async function isAIConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  return !!config.apiKey;
}

export async function generateTitle(content: string): Promise<string> {
  const ai = await getClient();
  if (!ai) throw new Error("AI not configured");
  const config = await getAIConfig();

  const response = await ai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "Generate a compelling, SEO-friendly blog post title from this content. Return ONLY the title, no quotes or extra text.",
      },
      { role: "user", content },
    ],
    max_tokens: 100,
    temperature: config.temperature,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generateOutline(topic: string): Promise<string> {
  const ai = await getClient();
  if (!ai) throw new Error("AI not configured");
  const config = await getAIConfig();

  const response = await ai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "Generate a blog post outline for the given topic. Use markdown headings (##) and bullet points. Keep it concise and actionable.",
      },
      { role: "user", content: topic },
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function enhanceContent(
  content: string,
  action: "expand" | "condense" | "engaging" | "fix-grammar"
): Promise<string> {
  const ai = await getClient();
  if (!ai) throw new Error("AI not configured");
  const config = await getAIConfig();

  const prompts: Record<string, string> = {
    expand:
      "Expand this content with more detail, examples, and explanations. Keep the original tone and style. Return only the improved content.",
    condense:
      "Condense this content to be more concise while keeping the key points. Remove filler words and redundancies. Return only the improved content.",
    engaging:
      "Rewrite this content to be more engaging and compelling. Use active voice, vivid language, and better flow. Return only the improved content.",
    "fix-grammar":
      "Fix grammar, spelling, and punctuation errors in this content. Improve sentence structure where needed. Return only the corrected content.",
  };

  const response = await ai.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: prompts[action] },
      { role: "user", content },
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generateMeta(
  content: string
): Promise<{ title: string; description: string; tags: string[] }> {
  const ai = await getClient();
  if (!ai) throw new Error("AI not configured");
  const config = await getAIConfig();

  const response = await ai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: `Generate SEO metadata for this blog post. Return a JSON object with:
- "title": a compelling SEO title (max 60 chars)
- "description": a meta description (max 160 chars)
- "tags": array of 3-6 relevant hashtags (lowercase, no spaces)

Return ONLY valid JSON, no markdown fences.`,
      },
      { role: "user", content },
    ],
    max_tokens: 300,
    temperature: 0.5,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { title: "", description: "", tags: [] };
  }
}

export async function translateContent(
  content: string,
  targetLanguage: string
): Promise<string> {
  const ai = await getClient();
  if (!ai) throw new Error("AI not configured");
  const config = await getAIConfig();

  const response = await ai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: `Translate the following content to ${targetLanguage}. Preserve all markdown formatting, links, and code blocks. Return only the translated content.`,
      },
      { role: "user", content },
    ],
    max_tokens: config.maxTokens,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
