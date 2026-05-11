import { NextRequest, NextResponse } from "next/server";
import { resolveLandingProfileFromInstance } from "./lib/landing";

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const landingPath = await resolveLandingProfileFromInstance(request.nextUrl.origin);

    if (landingPath) {
      return NextResponse.redirect(new URL(landingPath, request.url), 307);
    }
  }

  // Content negotiation for /post/:id - proxy AP requests to the API server
  if (request.nextUrl.pathname.startsWith("/post/")) {
    const accept = request.headers.get("accept") || "";
    if (
      accept.includes("application/activity+json") ||
      accept.includes("application/ld+json")
    ) {
      const url = `${BACKEND_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.rewrite(new URL(url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/post/:id*"],
};
