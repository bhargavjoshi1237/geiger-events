import { buildMcpHandler } from "@/lib/mcp/server";
import { defaultDeps } from "@/lib/mcp/deps";

const handler = buildMcpHandler({ deps: defaultDeps });

export { handler as GET, handler as POST, handler as DELETE };
