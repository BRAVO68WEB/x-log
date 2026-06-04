import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "not-needed",
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS || "2048");
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || "0.7");

function isConfigured(): boolean {
  // Either explicitly set API key, or using a local/self-hosted model
  return !!process.env.OPENAI_API_KEY || !!process.env.OPENAI_BASE_URL;
}

export async function generateTitle(content: string, model?: string): Promise<string> {
  if (!isConfigured()) {
    return generateFallbackTitle(content);
  }

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Generate a compelling, SEO-friendly blog post title from this content. Return ONLY the title, no quotes or extra text. Make it catchy but accurate.",
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    return response.choices[0]?.message?.content?.trim() || generateFallbackTitle(content);
  } catch (error) {
    console.error("AI title generation failed:", error);
    return generateFallbackTitle(content);
  }
}

export async function generateOutline(
  topic: string,
  model?: string
): Promise<{ title: string; sections: string[] }> {
  if (!isConfigured()) {
    return generateFallbackOutline(topic);
  }

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Create a blog post outline from this topic. Return a JSON object with 'title' (main title) and 'sections' (array of 4-6 section headers). Format: {title: string, sections: string[]}. No markdown, just plain text.",
        },
        {
          role: "user",
          content: topic,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        // Fallback if not valid JSON
      }
    }
  } catch (error) {
    console.error("AI outline generation failed:", error);
  }

  return generateFallbackOutline(topic);
}

export async function enhanceContent(
  content: string,
  action: "expand" | "condense" | "engaging" | "clear",
  model?: string
): Promise<string> {
  if (!isConfigured()) {
    return content;
  }

  const prompts = {
    expand:
      "Expand this content with more detail, examples, and depth while keeping the same tone.",
    condense:
      "Condense this content to its essential points, removing redundancy while preserving key information.",
    engaging: "Rewrite this content to be more engaging, compelling, and attention-grabbing.",
    clear: "Improve this content for clarity and readability, fixing any grammar issues.",
  };

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: prompts[action],
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: MAX_TOKENS * 2,
      temperature: TEMPERATURE,
    });

    return response.choices[0]?.message?.content?.trim() || content;
  } catch (error) {
    console.error(`AI ${action} enhancement failed:`, error);
    return content;
  }
}

export async function generateMeta(
  content: string,
  model?: string
): Promise<{
  title: string;
  description: string;
  hashtags: string[];
}> {
  if (!isConfigured()) {
    return generateFallbackMeta(content);
  }

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Generate SEO metadata for this content. Return JSON with: title (compelling title, max 60 chars), description (meta description, max 160 chars), hashtags (array of 3-5 relevant hashtags without #). Format: {title: string, description: string, hashtags: string[]}",
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const content_text = response.choices[0]?.message?.content;
    if (content_text) {
      try {
        const result = JSON.parse(content_text);
        return {
          title: result.title?.substring(0, 60) || "",
          description: result.description?.substring(0, 160) || "",
          hashtags: result.hashtags || [],
        };
      } catch {
        // Fallback if not valid JSON
      }
    }
  } catch (error) {
    console.error("AI meta generation failed:", error);
  }

  return generateFallbackMeta(content);
}

export async function translateContent(
  content: string,
  targetLang: string,
  model?: string
): Promise<string> {
  if (!isConfigured()) {
    return content;
  }

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `Translate this content to ${targetLang}. Preserve the formatting (markdown, links, etc.) and tone. Return only the translated content.`,
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: MAX_TOKENS * 4,
      temperature: TEMPERATURE,
    });

    return response.choices[0]?.message?.content?.trim() || content;
  } catch (error) {
    console.error("AI translation failed:", error);
    return content;
  }
}

export async function generateFirstDraft(topic: string, model?: string): Promise<string> {
  if (!isConfigured()) {
    return "";
  }

  try {
    const response = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Write a first draft of a blog post based on this topic. Use markdown formatting, include headers, and make it engaging. Write substantive content, not just an outline.",
        },
        {
          role: "user",
          content: topic,
        },
      ],
      max_tokens: MAX_TOKENS * 4,
      temperature: TEMPERATURE,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("AI draft generation failed:", error);
    return "";
  }
}

// Fallback functions when AI is not configured
function generateFallbackTitle(content: string): string {
  const firstLine = content.split("\n")[0].trim();
  return firstLine.substring(0, 100) || "Untitled Post";
}

function generateFallbackOutline(topic: string): { title: string; sections: string[] } {
  return {
    title: topic,
    sections: ["Introduction", "Main Points", "Conclusion"],
  };
}

function generateFallbackMeta(content: string): {
  title: string;
  description: string;
  hashtags: string[];
} {
  const words = content
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  return {
    title: content.substring(0, 60),
    description: content.substring(0, 160),
    hashtags: words.map((w) => w.replace(/[^a-z0-9]/gi, "").toLowerCase()),
  };
}

export { isConfigured };
