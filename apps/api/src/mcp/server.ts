import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_TOOLS, callMcpTool } from "./tools";
import type { McpToolContext } from "./context";

/**
 * Build a fresh McpServer with all x-log tools registered.
 * Create per-request in stateless Streamable HTTP mode.
 */
export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    {
      name: "x-log",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputZod as any,
      },
      async (args: any) => {
        const result = await callMcpTool(tool.name, args, ctx);
        return {
          content: result.content,
          isError: result.isError,
        };
      }
    );
  }

  return server;
}
