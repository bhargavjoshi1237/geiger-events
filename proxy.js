import { NextResponse } from "next/server";

// The mobile app's web preview calls the portal API cross-origin, so these
// routes answer preflights and send CORS headers. Native apps are unaffected.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-geiger-client",
  "Access-Control-Max-Age": "86400",
};

export default function proxy(request) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// Both variants: dev has no basePath, prod serves under /events.
export const config = {
  matcher: ["/api/portal/:path*", "/events/api/portal/:path*"],
};
