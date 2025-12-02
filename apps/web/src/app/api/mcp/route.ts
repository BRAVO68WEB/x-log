import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * MCP Server Proxy Route
 * Proxies MCP (Model Context Protocol) requests to the backend API server
 * 
 * The MCP server uses JSON-RPC 2.0 protocol and requires authentication via API key.
 * 
 * Usage:
 * POST /api/mcp
 * Headers:
 *   Authorization: Bearer <api-key>
 *   Content-Type: application/json
 * Body: JSON-RPC 2.0 request
 */
export async function POST(request: NextRequest) {
  const url = `${BACKEND_API_URL}/mcp`;

  // Get request body
  let body: string;
  try {
    body = await request.text();
    
    // Validate JSON format
    if (body) {
      try {
        const parsed = JSON.parse(body);
        if (parsed.jsonrpc !== "2.0" || !parsed.method || parsed.id === undefined) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request",
                data: "Request must be valid JSON-RPC 2.0 with jsonrpc='2.0', method, and id fields",
              },
              id: parsed.id ?? null,
            },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error",
              data: "Invalid JSON in request body",
            },
            id: null,
          },
          { status: 400 }
        );
      }
    }
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid Request",
          data: "Failed to read request body",
        },
        id: null,
      },
      { status: 400 }
    );
  }

  // Forward headers (especially Authorization for API key)
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    // Forward important headers
    if (
      lowerKey === "authorization" ||
      lowerKey === "content-type" ||
      lowerKey === "user-agent"
    ) {
      headers.set(key, value);
    }
  });

  // Ensure Content-Type is set
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    // Get response body
    const responseBody = await response.text();
    
    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === "development" && response.status !== 200) {
      console.log("[MCP Proxy] Backend response:", {
        status: response.status,
        body: responseBody.substring(0, 200),
      });
    }
    
    // Create response with same status
    const nextResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)
      ) {
        nextResponse.headers.set(key, value);
      }
    });

    return nextResponse;
  } catch (error) {
    console.error("MCP proxy error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Failed to connect to MCP server",
        },
        id: null,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
