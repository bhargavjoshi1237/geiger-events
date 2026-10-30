import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { MCP_METADATA_PATH, MCP_PUBLIC_ORIGIN } from "./config.js";
import { verifyMcpToken } from "./auth.js";
import { runTool } from "./run_tool.js";
import { TOOLS } from "./tools.js";

export function buildMcpHandler({ deps, verify = verifyMcpToken, tools = TOOLS }) {
  const handler = createMcpHandler(
    (server) => {
      for (const tool of tools) {
        server.registerTool(
          tool.name,
          {
            title: tool.title,
            description: tool.description,
            inputSchema: z.object(tool.input),
            annotations: { title: tool.title, ...tool.annotations },
          },
          (args, ctx) => runTool(tool, args, ctx.http?.authInfo, deps),
        );
      }
    },
    { serverInfo: { name: "geiger-events", version: "1.0.0" } },
  );

  return withMcpAuth(handler, verify, {
    required: true,
    resourceUrl: MCP_PUBLIC_ORIGIN,
    resourceMetadataPath: MCP_METADATA_PATH,
  });
}
