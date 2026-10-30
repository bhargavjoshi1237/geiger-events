import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { MCP_RESOURCE_URL, supabaseIssuer } from "@/lib/mcp/config";

// RFC 9728 document: tells MCP clients that Supabase Auth issues tokens for this server.
export const GET = protectedResourceHandler({
  authServerUrls: [supabaseIssuer()],
  resourceUrl: MCP_RESOURCE_URL,
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
