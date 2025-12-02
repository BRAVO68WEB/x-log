import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { mcpAuthMiddleware, requireMCPAuth } from "../middleware/mcp-auth";
import { getDb } from "@xlog/db";
import { getInstanceSettings } from "@xlog/db";

// MCP Protocol Types (JSON-RPC 2.0 based)
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// MCP Tools
const MCP_TOOLS = [
  {
    name: "get_posts",
    description: "Get a list of posts. Can filter by author, limit results, and paginate.",
    inputSchema: {
      type: "object",
      properties: {
        author: {
          type: "string",
          description: "Filter by author username",
        },
        limit: {
          type: "number",
          description: "Maximum number of posts to return",
          default: 20,
        },
        cursor: {
          type: "string",
          description: "Cursor for pagination",
        },
      },
    },
  },
  {
    name: "get_post",
    description: "Get a specific post by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Post ID (snowflake)",
          required: true,
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_profile",
    description: "Get a user profile by username",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Username to get profile for",
          required: true,
        },
      },
      required: ["username"],
    },
  },
  {
    name: "search",
    description: "Search posts and profiles",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
          required: true,
        },
        type: {
          type: "string",
          enum: ["post", "profile"],
          description: "Type of content to search",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_instance_info",
    description: "Get instance information and settings",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export const mcpRoutes = new Hono();

// MCP Protocol Handler
mcpRoutes.post(
  "/",
  mcpAuthMiddleware,
  requireMCPAuth,
  async (c) => {
    try {
      let body: MCPRequest;
      try {
        body = await c.req.json() as MCPRequest;
      } catch (error) {
        return c.json({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: "Invalid JSON in request body",
          },
          id: null,
        } as MCPResponse, 400);
      }

      // Validate JSON-RPC 2.0 format
      if (body.jsonrpc !== "2.0" || !body.method || body.id === undefined) {
        if (process.env.NODE_ENV === "development") {
          console.log("[MCP] Invalid request format:", {
            jsonrpc: body.jsonrpc,
            method: body.method,
            id: body.id,
          });
        }
        return c.json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid Request",
            data: "Request must be valid JSON-RPC 2.0 with jsonrpc='2.0', method, and id fields",
          },
          id: body.id ?? null,
        } as MCPResponse, 400);
      }

      const { method, params, id } = body;
      let result: any;

      // Handle MCP protocol methods
      switch (method) {
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: "x-log-mcp",
              version: "1.0.0",
            },
          };
          break;

        case "tools/list":
          result = {
            tools: MCP_TOOLS,
          };
          break;

        case "tools/call":
          if (!params?.name) {
            return c.json({
              jsonrpc: "2.0",
              error: {
                code: -32602,
                message: "Invalid params",
                data: "Tool name is required",
              },
              id,
            } as MCPResponse, 400);
          }

          result = await handleToolCall(params.name, params.arguments || {});
          break;

        case "ping":
          result = { pong: true };
          break;

        default:
          return c.json({
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: "Method not found",
              data: `Unknown method: ${method}`,
            },
            id,
          } as MCPResponse, 404);
      }

      return c.json({
        jsonrpc: "2.0",
        id,
        result,
      } as MCPResponse);
    } catch (error) {
      console.error("MCP handler error:", error);
      return c.json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
        id: null,
      } as MCPResponse, 500);
    }
  }
);

// Tool handlers
async function handleToolCall(toolName: string, args: any): Promise<any> {
  const db = getDb();

  switch (toolName) {
    case "get_posts": {
      const { author, limit = 20, cursor } = args;
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
          "users.username as author_username",
          "users.email as author_email",
        ])
        .where("posts.visibility", "=", "public")
        .where("posts.published_at", "is not", null)
        .orderBy("posts.published_at", "desc")
        .limit(limit);

      if (author) {
        query = query.where("users.username", "=", author);
      }

      if (cursor) {
        // Simple cursor-based pagination using published_at
        query = query.where("posts.published_at", "<", new Date(cursor));
      }

      const posts = await query.execute();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                items: posts.map((p) => ({
                  id: p.id,
                  title: p.title,
                  summary: p.summary,
                  banner_url: p.banner_url,
                  hashtags: p.hashtags,
                  like_count: p.like_count,
                  published_at: p.published_at?.toISOString(),
                  author: {
                    username: p.author_username,
                    email: p.author_email,
                  },
                })),
                hasMore: posts.length === limit,
                nextCursor: posts.length > 0 ? posts[posts.length - 1].published_at?.toISOString() : null,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_post": {
      const { id } = args;
      if (!id) {
        throw new Error("Post ID is required");
      }

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
          "users.username as author_username",
          "users.email as author_email",
        ])
        .where("posts.id", "=", id)
        .where("posts.visibility", "=", "public")
        .executeTakeFirst();

      if (!post) {
        throw new Error("Post not found");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: post.id,
                title: post.title,
                content_markdown: post.content_markdown,
                summary: post.summary,
                banner_url: post.banner_url,
                hashtags: post.hashtags,
                like_count: post.like_count,
                published_at: post.published_at?.toISOString(),
                updated_at: post.updated_at.toISOString(),
                author: {
                  username: post.author_username,
                  email: post.author_email,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_profile": {
      const { username } = args;
      if (!username) {
        throw new Error("Username is required");
      }

      const profile = await db
        .selectFrom("users")
        .leftJoin("user_profiles", "users.id", "user_profiles.user_id")
        .select([
          "users.id",
          "users.username",
          "users.email",
          "users.role",
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

      if (!profile) {
        throw new Error("Profile not found");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                username: profile.username,
                email: profile.email,
                role: profile.role,
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
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "search": {
      const { query: searchQuery, type } = args;
      if (!searchQuery) {
        throw new Error("Search query is required");
      }

      if (type === "profile") {
        const profiles = await db
          .selectFrom("users")
          .leftJoin("user_profiles", "users.id", "user_profiles.user_id")
          .select([
            "users.id",
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  items: profiles.map((p: any) => ({
                    username: p.username,
                    full_name: p.full_name,
                    bio: p.bio,
                    avatar_url: p.avatar_url,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        // Search posts
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  items: posts.map((p) => ({
                    id: p.id,
                    title: p.title,
                    summary: p.summary,
                    hashtags: p.hashtags,
                    published_at: p.published_at?.toISOString(),
                    author: {
                      username: p.author_username,
                    },
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }

    case "get_instance_info": {
      const settings = await getInstanceSettings();
      const db = getDb();

      const stats = await db
        .selectFrom("users")
        .select((eb) => [
          eb.fn.count("users.id").as("user_count"),
        ])
        .executeTakeFirst();

      const postCount = await db
        .selectFrom("posts")
        .select((eb) => [
          eb.fn.count("posts.id").as("post_count"),
        ])
        .where("posts.published_at", "is not", null)
        .executeTakeFirst();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                instance_name: settings.instance_name,
                instance_domain: settings.instance_domain,
                instance_description: settings.instance_description,
                open_registrations: settings.open_registrations,
                federation_enabled: settings.federation_enabled,
                stats: {
                  users: Number(stats?.user_count || 0),
                  posts: Number(postCount?.post_count || 0),
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

