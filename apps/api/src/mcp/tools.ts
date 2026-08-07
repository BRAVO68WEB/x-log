import { z } from "zod";
import { getDb, getInstanceSettings } from "@xlog/db";
import {
  createPost,
  updatePost,
  publishPost,
  deletePost,
  PostServiceError,
} from "../services/posts";
import type { McpToolContext } from "./context";

export type McpContentResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  inputZod: z.ZodTypeAny;
  handler: (args: any, ctx: McpToolContext) => Promise<McpContentResult>;
};

function textResult(data: unknown, isError = false): McpContentResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

function errorResult(message: string): McpContentResult {
  return textResult({ error: message }, true);
}

const GetPostsSchema = z.object({
  author: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

const GetPostSchema = z.object({
  id: z.string().min(1),
});

const GetProfileSchema = z.object({
  username: z.string().min(1),
});

const SearchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(["post", "profile"]).optional(),
});

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content_markdown: z.string().min(1),
  summary: z.string().optional(),
  hashtags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).optional().default([]),
  visibility: z.enum(["public", "unlisted", "private"]).optional().default("public"),
  banner_url: z.string().url().optional(),
});

const UpdatePostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  content_markdown: z.string().min(1).optional(),
  summary: z.string().optional().nullable(),
  hashtags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  banner_url: z.string().url().optional().nullable(),
});

const IdSchema = z.object({
  id: z.string().min(1),
});

function zodToJsonSchema(schema: z.ZodTypeAny, name: string): Record<string, unknown> {
  // Minimal JSON Schema for MCP tools/list (avoid extra deps)
  const def = (schema as any)._def;
  if (def?.typeName === "ZodObject") {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape) as [string, z.ZodTypeAny][]) {
      properties[key] = zodPropToJson(value);
      if (!isOptionalZod(value)) required.push(key);
    }
    return {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    };
  }
  return { type: "object", properties: {}, description: name };
}

function isOptionalZod(schema: z.ZodTypeAny): boolean {
  const t = (schema as any)._def?.typeName;
  if (t === "ZodOptional" || t === "ZodDefault") return true;
  if (t === "ZodNullable") return isOptionalZod((schema as any)._def.innerType);
  return false;
}

function zodPropToJson(schema: z.ZodTypeAny): Record<string, unknown> {
  let current: any = schema;
  let description: string | undefined;
  // unwrap optional/default/nullable
  while (
    current._def?.typeName === "ZodOptional" ||
    current._def?.typeName === "ZodDefault" ||
    current._def?.typeName === "ZodNullable"
  ) {
    current = current._def.innerType;
  }
  const t = current._def?.typeName;
  if (t === "ZodString") {
    const out: Record<string, unknown> = { type: "string" };
    if (current._def.checks) {
      for (const c of current._def.checks) {
        if (c.kind === "min") out.minLength = c.value;
        if (c.kind === "max") out.maxLength = c.value;
        if (c.kind === "url") out.format = "uri";
      }
    }
    return out;
  }
  if (t === "ZodNumber") {
    return { type: "number" };
  }
  if (t === "ZodBoolean") {
    return { type: "boolean" };
  }
  if (t === "ZodEnum") {
    return { type: "string", enum: current._def.values };
  }
  if (t === "ZodArray") {
    return { type: "array", items: zodPropToJson(current._def.type) };
  }
  if (description) return { type: "string", description };
  return {};
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "get_posts",
    description: "List published public posts. Optionally filter by author username.",
    inputSchema: {},
    inputZod: GetPostsSchema,
    handler: async (raw) => {
      const args = GetPostsSchema.parse(raw);
      const db = getDb();
      let query = db
        .selectFrom("posts")
        .innerJoin("users", "posts.author_id", "users.id")
        .select([
          "posts.id",
          "posts.title",
          "posts.summary",
          "posts.banner_url",
          "posts.hashtags",
          "posts.like_count",
          "posts.published_at",
          "posts.visibility",
          "users.username as author_username",
        ])
        .where("posts.visibility", "=", "public")
        .where("posts.published_at", "is not", null)
        .orderBy("posts.published_at", "desc")
        .limit(args.limit);

      if (args.author) {
        query = query.where("users.username", "=", args.author);
      }
      if (args.cursor) {
        query = query.where("posts.published_at", "<", new Date(args.cursor));
      }

      const posts = await query.execute();
      return textResult({
        items: posts.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.summary,
          banner_url: p.banner_url,
          hashtags: p.hashtags,
          like_count: p.like_count,
          published_at: p.published_at?.toISOString() ?? null,
          author: { username: p.author_username },
        })),
        hasMore: posts.length === args.limit,
        nextCursor:
          posts.length > 0 ? posts[posts.length - 1].published_at?.toISOString() : null,
      });
    },
  },
  {
    name: "get_post",
    description: "Get a post by ID. Public posts always; drafts only for the MCP actor.",
    inputSchema: {},
    inputZod: GetPostSchema,
    handler: async (raw, ctx) => {
      const { id } = GetPostSchema.parse(raw);
      const db = getDb();
      const post = await db
        .selectFrom("posts")
        .innerJoin("users", "posts.author_id", "users.id")
        .select([
          "posts.id",
          "posts.title",
          "posts.content_markdown",
          "posts.summary",
          "posts.banner_url",
          "posts.hashtags",
          "posts.like_count",
          "posts.published_at",
          "posts.updated_at",
          "posts.visibility",
          "posts.author_id",
          "users.username as author_username",
        ])
        .where("posts.id", "=", id)
        .executeTakeFirst();

      if (!post) return errorResult("Post not found");

      const isOwner = post.author_id === ctx.actor.id;
      const isPublicPublished =
        post.visibility === "public" && post.published_at !== null;
      if (!isPublicPublished && !isOwner && ctx.actor.role !== "admin") {
        return errorResult("Post not found");
      }

      return textResult({
        id: post.id,
        title: post.title,
        content_markdown: post.content_markdown,
        summary: post.summary,
        banner_url: post.banner_url,
        hashtags: post.hashtags,
        like_count: post.like_count,
        published_at: post.published_at?.toISOString() ?? null,
        updated_at: post.updated_at.toISOString(),
        visibility: post.visibility,
        author: { username: post.author_username },
      });
    },
  },
  {
    name: "get_profile",
    description: "Get a public user profile by username (no private fields).",
    inputSchema: {},
    inputZod: GetProfileSchema,
    handler: async (raw) => {
      const { username } = GetProfileSchema.parse(raw);
      const db = getDb();
      const profile = await db
        .selectFrom("users")
        .leftJoin("user_profiles", "users.id", "user_profiles.user_id")
        .select([
          "users.username",
          "users.created_at",
          "user_profiles.full_name",
          "user_profiles.bio",
          "user_profiles.avatar_url",
          "user_profiles.banner_url",
          "user_profiles.social_github",
          "user_profiles.social_x",
          "user_profiles.social_youtube",
          "user_profiles.social_reddit",
          "user_profiles.social_linkedin",
          "user_profiles.social_website",
          "user_profiles.support_url",
          "user_profiles.support_text",
        ])
        .where("users.username", "=", username)
        .executeTakeFirst();

      if (!profile) return errorResult("Profile not found");

      return textResult({
        username: profile.username,
        full_name: profile.full_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        banner_url: profile.banner_url,
        social: {
          github: profile.social_github,
          x: profile.social_x,
          youtube: profile.social_youtube,
          reddit: profile.social_reddit,
          linkedin: profile.social_linkedin,
          website: profile.social_website,
        },
        support: {
          url: profile.support_url,
          text: profile.support_text,
        },
        created_at: profile.created_at.toISOString(),
      });
    },
  },
  {
    name: "search",
    description: "Search public posts or profiles.",
    inputSchema: {},
    inputZod: SearchSchema,
    handler: async (raw) => {
      const { query: searchQuery, type } = SearchSchema.parse(raw);
      const db = getDb();

      if (type === "profile") {
        const profiles = await db
          .selectFrom("users")
          .leftJoin("user_profiles", "users.id", "user_profiles.user_id")
          .select([
            "users.username",
            "user_profiles.full_name",
            "user_profiles.bio",
            "user_profiles.avatar_url",
          ])
          .where((eb) =>
            eb.or([
              eb("users.username", "like", `%${searchQuery}%`),
              eb("user_profiles.full_name", "like", `%${searchQuery}%`),
            ])
          )
          .limit(20)
          .execute();

        return textResult({
          items: profiles.map((p) => ({
            username: p.username,
            full_name: p.full_name,
            bio: p.bio,
            avatar_url: p.avatar_url,
          })),
        });
      }

      const posts = await db
        .selectFrom("posts")
        .innerJoin("users", "posts.author_id", "users.id")
        .select([
          "posts.id",
          "posts.title",
          "posts.summary",
          "posts.hashtags",
          "posts.published_at",
          "users.username as author_username",
        ])
        .where("posts.visibility", "=", "public")
        .where("posts.published_at", "is not", null)
        .where((eb) =>
          eb.or([
            eb("posts.title", "like", `%${searchQuery}%`),
            eb("posts.content_markdown", "like", `%${searchQuery}%`),
            eb("posts.hashtags", "@>", [searchQuery.toLowerCase()]),
          ])
        )
        .orderBy("posts.published_at", "desc")
        .limit(20)
        .execute();

      return textResult({
        items: posts.map((p) => ({
          id: p.id,
          title: p.title,
          summary: p.summary,
          hashtags: p.hashtags,
          published_at: p.published_at?.toISOString() ?? null,
          author: { username: p.author_username },
        })),
      });
    },
  },
  {
    name: "get_instance_info",
    description: "Get public instance information and basic stats.",
    inputSchema: {},
    inputZod: z.object({}),
    handler: async () => {
      const settings = await getInstanceSettings();
      const db = getDb();
      const stats = await db
        .selectFrom("users")
        .select((eb) => [eb.fn.count("users.id").as("user_count")])
        .executeTakeFirst();
      const postCount = await db
        .selectFrom("posts")
        .select((eb) => [eb.fn.count("posts.id").as("post_count")])
        .where("posts.published_at", "is not", null)
        .executeTakeFirst();

      return textResult({
        instance_name: settings.instance_name,
        instance_domain: settings.instance_domain,
        instance_description: settings.instance_description,
        open_registrations: false,
        federation_enabled: settings.federation_enabled,
        stats: {
          users: Number(stats?.user_count || 0),
          posts: Number(postCount?.post_count || 0),
        },
      });
    },
  },
  {
    name: "create_post",
    description:
      "Create a draft post as the MCP actor. Use publish_post to publish and federate.",
    inputSchema: {},
    inputZod: CreatePostSchema,
    handler: async (raw, ctx) => {
      try {
        const data = CreatePostSchema.parse(raw);
        const post = await createPost(ctx.actor, data);
        return textResult({
          id: post.id,
          title: post.title,
          summary: post.summary,
          hashtags: post.hashtags,
          visibility: post.visibility,
          published_at: post.published_at?.toISOString() ?? null,
          author: { username: post.username },
          message: "Draft created",
        });
      } catch (err) {
        if (err instanceof z.ZodError) return errorResult(err.message);
        if (err instanceof PostServiceError) return errorResult(err.message);
        throw err;
      }
    },
  },
  {
    name: "update_post",
    description: "Update a post owned by the MCP actor (or admin).",
    inputSchema: {},
    inputZod: UpdatePostSchema,
    handler: async (raw, ctx) => {
      try {
        const { id, ...data } = UpdatePostSchema.parse(raw);
        const result = await updatePost(ctx.actor, id, data);
        return textResult(result);
      } catch (err) {
        if (err instanceof z.ZodError) return errorResult(err.message);
        if (err instanceof PostServiceError) return errorResult(err.message);
        throw err;
      }
    },
  },
  {
    name: "publish_post",
    description: "Publish a draft post (sets published_at and federates if public).",
    inputSchema: {},
    inputZod: IdSchema,
    handler: async (raw, ctx) => {
      try {
        const { id } = IdSchema.parse(raw);
        const result = await publishPost(ctx.actor, id);
        return textResult({
          ...result,
          published_at:
            result.published_at instanceof Date
              ? result.published_at.toISOString()
              : result.published_at,
        });
      } catch (err) {
        if (err instanceof z.ZodError) return errorResult(err.message);
        if (err instanceof PostServiceError) return errorResult(err.message);
        throw err;
      }
    },
  },
  {
    name: "delete_post",
    description: "Delete a post owned by the MCP actor (or admin). Federates Delete if published.",
    inputSchema: {},
    inputZod: IdSchema,
    handler: async (raw, ctx) => {
      try {
        const { id } = IdSchema.parse(raw);
        const result = await deletePost(ctx.actor, id);
        return textResult(result);
      } catch (err) {
        if (err instanceof z.ZodError) return errorResult(err.message);
        if (err instanceof PostServiceError) return errorResult(err.message);
        throw err;
      }
    },
  },
];

// Fill inputSchema from Zod
for (const tool of MCP_TOOLS) {
  tool.inputSchema = zodToJsonSchema(tool.inputZod, tool.name);
}

export function listMcpTools() {
  return MCP_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

export async function callMcpTool(
  name: string,
  args: unknown,
  ctx: McpToolContext
): Promise<McpContentResult> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return errorResult(`Unknown tool: ${name}`);
  }
  try {
    return await tool.handler(args ?? {}, ctx);
  } catch (err) {
    console.error(`[MCP] tool ${name} error:`, err);
    return errorResult(err instanceof Error ? err.message : "Tool execution failed");
  }
}
