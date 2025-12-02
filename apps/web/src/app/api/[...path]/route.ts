import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "POST");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "DELETE");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "PUT");
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  const { path } = await params;
  const pathname = `/${path.join("/")}`;
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_API_URL}/api${pathname}${searchParams ? `?${searchParams}` : ""}`;

  // Get request body if present
  let body: BodyInit | undefined;
  const contentType = request.headers.get("content-type");
  
  if (method !== "GET" && method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      body = await request.formData();
    } else if (contentType?.includes("application/json")) {
      body = await request.text();
    } else {
      body = await request.text();
    }
  }

  // Forward headers (excluding host and connection)
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Skip headers that shouldn't be forwarded
    const lowerKey = key.toLowerCase();
    if (
      !["host", "connection", "content-length"].includes(lowerKey)
    ) {
      // For multipart/form-data, let fetch set the boundary automatically
      if (lowerKey === "content-type" && contentType?.includes("multipart/form-data")) {
        // Don't set content-type for form-data, fetch will set it with boundary
      } else {
        headers.set(key, value);
      }
    }
  });

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    // Get response body based on content type
    const responseContentType = response.headers.get("content-type");
    let responseBody: BodyInit;
    
    if (responseContentType?.includes("application/json")) {
      responseBody = await response.text();
    } else if (responseContentType?.includes("text")) {
      responseBody = await response.text();
    } else {
      // For binary content (images, etc.)
      responseBody = await response.arrayBuffer();
    }
    
    // Create response with same status and headers
    const nextResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    });

    // Forward response headers (especially cookies)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Forward Set-Cookie headers for session management
      if (lowerKey === "set-cookie") {
        nextResponse.headers.append(key, value);
      } else if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
        nextResponse.headers.set(key, value);
      }
    });

    return nextResponse;
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

