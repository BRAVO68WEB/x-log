import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  if (!client) {
    client = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey,
    });
  }
  return client;
}

function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}

function getMaxTokens(): number {
  return parseInt(process.env.OPENAI_MAX_TOKENS || "2048", 10);
}

function getTemperature(): number {
  return parseFloat(process.env.OPENAI_TEMPERATURE || "0.7");
}

export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function generateTitle(content: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error("AI not configured");

  const response = await ai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content:
          "Generate a compelling, SEO-friendly blog post title from this content. Return ONLY the title, no quotes or extra text.",
      },
      { role: "user", content },
    ],
    max_tokens: 100,
    temperature: getTemperature(),
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generateOutline(topic: string): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error("AI not configured");

  const response = await ai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content:
          "Generate a blog post outline for the given topic. Use markdown headings (##) and bullet points. Keep it concise and actionable.",
      },
      { role: "user", content: topic },
    ],
    max_tokens: getMaxTokens(),
    temperature: getTemperature(),
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function enhanceContent(
  content: string,
  action: "expand" | "condense" | "engaging" | "fix-grammar"
): Promise<string> {
  const ai = getClient();
  if (!ai) throw new Error("AI not configured");

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
    model: getModel(),
    messages: [
      { role: "system", content: prompts[action] },
      { role: "user", content },
    ],
    max_tokens: getMaxTokens(),
    temperature: getTemperature(),
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function generateMeta(
  content: string
): Promise<{ title: string; description: string; tags: string[] }> {
  const ai = getClient();
  if (!ai) throw new Error("AI not configured");

  const response = await ai.chat.completions.create({
    model: getModel(),
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
  const ai = getClient();
  if (!ai) throw new Error("AI not configured");

  const response = await ai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: `Translate the following content to ${targetLanguage}. Preserve all markdown formatting, links, and code blocks. Return only the translated content.`,
      },
      { role: "user", content },
    ],
    max_tokens: getMaxTokens(),
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
