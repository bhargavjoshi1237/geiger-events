// Public addresses for the MCP endpoint. In production Events is reached through Dash's rewrite, so the origin can't be read from the request.

const isProd = process.env.NODE_ENV === "production";

export const MCP_PUBLIC_ORIGIN =
  process.env.MCP_PUBLIC_ORIGIN || (isProd ? "https://geiger.studio" : "http://localhost:3000");

const basePath = isProd ? "/events" : "";

export const MCP_RESOURCE_URL = `${MCP_PUBLIC_ORIGIN}${basePath}/api/mcp`;
export const MCP_METADATA_PATH = `${basePath}/.well-known/oauth-protected-resource`;

export function supabaseIssuer() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
}

// Tool calls allowed per user and client in a rolling minute.
export const MCP_RATE_LIMIT_PER_MINUTE = 120;
