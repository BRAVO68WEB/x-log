import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * MCP proxy — Streamable HTTP (primary) + legacy JSON-RPC.
 *
 * Streamable (Cursor/Claude):
 *   GET|POST|DELETE /api/mcp  →  {BACKEND}/mcp
 *
 * Legacy JSON-RPC (explicit):
 *   POST /api/mcp/jsonrpc  →  {BACKEND}/mcp/jsonrpc
 *   Also: POST with Accept: application/json and MCP-Protocol-Version absent
 *   that looks like pure JSON-RPC can hit /mcp/jsonrpc via ?legacy=1
 *
 * Auth: Authorization: Bearer <MCP_API_KEY>
 */

const FORWARD_REQ_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "user-agent",
  "mcp-session-id",
  "mcp-protocol-version",
  "last-event-id",
];

function backendMcpUrl(request: NextRequest, forceLegacy: boolean): string {
  if (forceLegacy) {
    return `${BACKEND_API_URL}/mcp/jsonrpc`;
  }
  // Default Streamable HTTP
  return `${BACKEND_API_URL}/mcp`;
}

async function proxy(request: NextRequest, forceLegacy = false) {
  const url = backendMcpUrl(request, forceLegacy);
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (FORWARD_REQ_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  if (request.method !== "GET" && request.method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      // @ts-expect-error duplex needed for some runtimes when streaming body
      duplex: body ? "half" : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (["content-encoding", "content-length", "transfer-encoding"].includes(lower)) {
        return;
      }
      responseHeaders.set(key, value);
    });

    // CORS for browser MCP clients
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Expose-Headers",
      "Mcp-Session-Id, MCP-Protocol-Version, Content-Type"
    );

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
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

export async function GET(request: NextRequest) {
  return proxy(request);
}

export async function POST(request: NextRequest) {
  const legacy = request.nextUrl.searchParams.get("legacy") === "1";
  return proxy(request, legacy);
}

export async function DELETE(request: NextRequest) {
  return proxy(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
      "Access-Control-Max-Age": "86400",
    },
  });
}
