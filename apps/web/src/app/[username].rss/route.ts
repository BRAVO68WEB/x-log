import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const { username } = (await params) as { username: string };
  // Proxy RSS feed request through Next.js
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/feeds/${username}/rss`, {
      headers: {
        "User-Agent": request.headers.get("user-agent") || "x-log",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Feed not found" },
        { status: response.status }
      );
    }

    const feedContent = await response.text();
    return new NextResponse(feedContent, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
