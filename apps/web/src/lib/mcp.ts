/**
 * MCP (Model Context Protocol) Client for x-log
 * Provides a client interface for interacting with the MCP server
 */

const MCP_BASE = "/api/mcp";

type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | { [key: string]: JSONValue } | JSONValue[];
type JSONObject = { [key: string]: JSONValue };

type WithContent = { content?: Array<{ text?: string }> };
function hasTextContent(res: JSONValue): res is WithContent {
  return typeof res === "object" && res !== null && "content" in (res as object);
}

interface MCPRequest<P extends JSONObject | undefined = JSONObject> {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: P;
}

interface MCPResponse<R = JSONValue> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: R;
  error?: {
    code: number;
    message: string;
    data?: JSONValue;
  };
}

/**
 * Make an MCP request
 */
async function mcpRequest<R = JSONValue, P extends JSONObject | undefined = JSONObject>(
  method: string,
  params: P = {} as P,
  apiKey?: string
): Promise<MCPResponse<R>> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const request: MCPRequest<P> = {
    jsonrpc: "2.0",
    id: Date.now().toString(),
    method,
    params,
  };

  const response = await fetch(MCP_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: `HTTP ${response.status}` },
    }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<MCPResponse<R>>;
}

/**
 * MCP Client API
 */
export const mcpClient = {
  /**
   * Initialize MCP connection
   */
  initialize: async (apiKey?: string) => {
    const response = await mcpRequest("initialize", {}, apiKey);
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  },

  /**
   * List available tools
   */
  listTools: async (apiKey?: string) => {
    const response = await mcpRequest<{ tools: JSONObject[] }>("tools/list", {}, apiKey);
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result?.tools || [];
  },

  /**
   * Call a tool
   */
  callTool: async (toolName: string, arguments_: JSONObject, apiKey?: string) => {
    const response = await mcpRequest<JSONValue, { name: string; arguments: JSONObject }>(
      "tools/call",
      {
        name: toolName,
        arguments: arguments_,
      },
      apiKey
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return (response.result ?? {}) as JSONValue;
  },

  /**
   * Ping the MCP server
   */
  ping: async (apiKey?: string) => {
    const response = await mcpRequest("ping", {}, apiKey);
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.result;
  },

  /**
   * Convenience methods for common tools
   */
  tools: {
    /**
     * Get posts
     */
    getPosts: async (
      options?: {
        author?: string;
        limit?: number;
        cursor?: string;
      },
      apiKey?: string
    ): Promise<{ items: { id: string; title: string }[]; nextCursor?: string; hasMore: boolean }> => {
      const result = await mcpClient.callTool("get_posts", options || {}, apiKey);
      if (hasTextContent(result) && result.content?.[0]?.text) {
        return JSON.parse(result.content[0].text as string);
      }
      return result as { items: { id: string; title: string }[]; nextCursor?: string; hasMore: boolean };
    },

    /**
     * Get a specific post
     */
    getPost: async (id: string, apiKey?: string): Promise<{ id: string; title: string; content_html: string }> => {
      const result = await mcpClient.callTool("get_post", { id }, apiKey);
      if (hasTextContent(result) && result.content?.[0]?.text) {
        return JSON.parse(result.content[0].text as string);
      }
      return result as { id: string; title: string; content_html: string };
    },

    /**
     * Get a user profile
     */
    getProfile: async (username: string, apiKey?: string): Promise<{ username: string; full_name?: string | null; bio?: string | null }> => {
      const result = await mcpClient.callTool("get_profile", { username }, apiKey);
      if (hasTextContent(result) && result.content?.[0]?.text) {
        return JSON.parse(result.content[0].text as string);
      }
      return result as { username: string; full_name?: string | null; bio?: string | null };
    },

    /**
     * Search posts and profiles
     */
    search: async (
      query: string,
      type?: "post" | "profile",
      apiKey?: string
    ): Promise<{ items: Array<{ id?: string; username?: string }> }> => {
      const args: JSONObject & { type?: JSONPrimitive } = { query };
      if (type) args.type = type as JSONPrimitive;
      const result = await mcpClient.callTool("search", args, apiKey);
      if (hasTextContent(result) && result.content?.[0]?.text) {
        return JSON.parse(result.content[0].text as string);
      }
      return result as { items: Array<{ id?: string; username?: string }> };
    },

    /**
     * Get instance information
     */
    getInstanceInfo: async (apiKey?: string): Promise<{ instance_name: string; instance_domain: string }> => {
      const result = await mcpClient.callTool("get_instance_info", {}, apiKey);
      if (hasTextContent(result) && result.content?.[0]?.text) {
        return JSON.parse(result.content[0].text as string);
      }
      return result as { instance_name: string; instance_domain: string };
    },
  },
};
