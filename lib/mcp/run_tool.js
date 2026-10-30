// Every MCP tool call passes through here: rate limit, connection, read/write, project, role, then the tool, then the audit log.

export class ToolError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NOT_CONNECTED =
  "This app has no active connection to Geiger. Reconnect it, then choose which projects it can reach.";

async function authorize(tool, args, ctx, deps) {
  const { principal, connection, db } = ctx;

  if (tool.scope === "connection") return { projectId: null };

  const withMembershipRetry = async (projectId, check) => {
    try {
      return await check();
    } catch (error) {
      if (error?.code !== "forbidden" || !projectId) throw error;
      // Someone who has never opened Events has no saved role yet.
      await deps.ensureMembership(db, projectId);
      return check();
    }
  };

  if (tool.scope === "project") {
    const projectId = args.projectId;
    if (!connection.projectIds.includes(projectId)) {
      throw new ToolError("not_found", "Project not found, or this app wasn't given access to it.");
    }
    await withMembershipRetry(projectId, () => deps.authorizeProject(principal, projectId, tool.permission));
    return { projectId, targetId: projectId };
  }

  const eventId = tool.resolveEventId ? await tool.resolveEventId(ctx, args) : args.eventId;
  if (!eventId) throw new ToolError("not_found", "Not found.");

  // A refusal outside the connection reads as not found, so it can't reveal that an event exists.
  let projectId = null;
  try {
    const decision = await deps.authorizeEvent(principal, eventId, tool.permission);
    projectId = decision.projectId;
  } catch (error) {
    if (error?.code !== "forbidden") throw error;
    const { data } = await db.from("events").select("project_id").eq("id", eventId).maybeSingle();
    if (!data?.project_id || !connection.projectIds.includes(data.project_id)) {
      throw new ToolError("not_found", "Event not found, or this app wasn't given access to it.");
    }
    await deps.ensureMembership(db, data.project_id);
    projectId = (await deps.authorizeEvent(principal, eventId, tool.permission)).projectId;
  }
  if (!connection.projectIds.includes(projectId)) {
    throw new ToolError("not_found", "Event not found, or this app wasn't given access to it.");
  }
  return { projectId, targetId: tool.resolveEventId ? args.registrationId : eventId };
}

function outcomeFor(error) {
  if (error?.code === "rate_limited") return "rate_limited";
  if (["forbidden", "not_found", "not_connected", "read_only", "unauthenticated"].includes(error?.code)) return "denied";
  return "error";
}

function messageFor(error) {
  if (error instanceof ToolError) return error.message;
  if (error?.code === "forbidden") return "Your role in this project doesn't allow this.";
  if (error?.code === "not_found") return "Not found, or this app wasn't given access to it.";
  return "Something went wrong running this tool. Please try again.";
}

export async function runTool(tool, args, authInfo, deps) {
  const startedAt = Date.now();
  const userId = authInfo?.extra?.userId;
  const clientId = authInfo?.clientId;
  let connection = null;
  let scope = {};
  let failure = null;
  let result = null;

  try {
    if (!userId || !clientId) throw new ToolError("unauthenticated", "Sign in to continue.");
    if (await deps.isRateLimited(userId, clientId)) {
      throw new ToolError("rate_limited", "Too many requests. Wait a minute and try again.");
    }

    connection = await deps.loadConnection(authInfo.token, userId, clientId);
    if (!connection) throw new ToolError("not_connected", NOT_CONNECTED);
    if (tool.access === "write" && connection.access !== "write") {
      throw new ToolError(
        "read_only",
        "This app has read-only access. Reconnect it with changes allowed to use this tool.",
      );
    }

    const ctx = {
      userId,
      connection,
      principal: { kind: "staff", id: userId },
      db: deps.userClient(authInfo.token),
      publicDb: deps.userClient(authInfo.token, "public"),
    };
    scope = await authorize(tool, args, ctx, deps);
    result = await tool.run(ctx, args);
  } catch (error) {
    failure = error;
    if (!(error instanceof ToolError) && !error?.status) console.error(`[mcp.${tool.name}]`, error);
  }

  try {
    if (userId && clientId) {
      await deps.writeAudit({
        user_id: userId,
        client_id: clientId,
        connection_id: connection?.id ?? null,
        product: "events",
        tool: tool.name,
        project_id: scope.projectId ?? null,
        target_id: scope.targetId ?? null,
        outcome: failure ? outcomeFor(failure) : "ok",
        error_code: failure?.code ?? null,
        duration_ms: Date.now() - startedAt,
        metadata: { argument_keys: Object.keys(args || {}) },
      });
    }
  } catch (error) {
    console.error("[mcp.audit]", error);
    // A change that can't be audited is reported, so nobody assumes the trail is complete.
    if (!failure && tool.access === "write") {
      result = { ...result, auditWarning: "This change succeeded but could not be written to the audit log." };
    }
  }

  if (failure) {
    return { isError: true, content: [{ type: "text", text: messageFor(failure) }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
