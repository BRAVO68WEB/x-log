import { NextRequest, NextResponse } from "next/server";
import { isLandingRedirectTarget, resolveLandingProfileFromInstance } from "./lib/landing";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const purpose = request.headers.get("purpose");
    const nextRouterPrefetch = request.headers.get("next-router-prefetch");

    if (purpose === "prefetch" || nextRouterPrefetch === "1") {
      return NextResponse.next();
    }

    const landingPath = await resolveLandingProfileFromInstance(request.nextUrl.origin, {
      includeSelfOrigin: false,
    });

    if (isLandingRedirectTarget(request.nextUrl.pathname, landingPath)) {
      const response = NextResponse.redirect(new URL(landingPath, request.url), 307);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("x-xlog-landing-redirect", landingPath);
      return response;
    }
  }

  // Content negotiation for /post/:id - proxy AP requests to the API server
  if (request.nextUrl.pathname.startsWith("/post/")) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("application/activity+json") || accept.includes("application/ld+json")) {
      const url = `${BACKEND_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;
      return NextResponse.rewrite(new URL(url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/post/:id*"],
};
