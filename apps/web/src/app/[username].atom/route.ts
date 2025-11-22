import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  // Redirect to API feed endpoint
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  return Response.redirect(
    `${apiUrl}/api/feeds/${username}/atom`,
    301
  );
}

