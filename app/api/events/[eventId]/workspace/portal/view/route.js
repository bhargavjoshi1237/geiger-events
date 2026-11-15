import { readJson } from "@/lib/workspace/server/http";
import { WORKSPACE_KEYS, workspaceContext, workspaceRoute } from "@/lib/workspace/server/route";
import { WorkspaceError } from "@/lib/workspace/errors";
import { portalStaff } from "@/lib/workspace/portal/staff";

export const runtime = "nodejs";

// Team pages (view permission) and builder previews as a role or person (configure permission).
export const POST = workspaceRoute(async (request, { eventId }) => {
  const body = await readJson(request);
  const preview = body.as?.mode === "preview" || !["page", "record", "block"].includes(body.what);
  const context = await workspaceContext(request, eventId, preview ? WORKSPACE_KEYS.configure : WORKSPACE_KEYS.view);
  switch (body.what) {
    case "page": return portalStaff.page(context, { pageId: body.pageId, as: body.as });
    case "record": return portalStaff.record(context, { objectKey: body.objectKey, number: Number(body.number), as: body.as });
    case "block": return portalStaff.blockData(context, { pageId: body.pageId, blockId: body.blockId, params: body.params ?? {}, recordId: body.recordId ?? null, as: body.as });
    case "reach": return portalStaff.reach(context, { objectId: body.objectId, as: body.as });
    case "role_matches": return portalStaff.roleMatches(context, { membership: body.membership ?? null });
    case "preview_people": return portalStaff.previewPeople(context, { q: body.q });
    case "default_record_page": return portalStaff.defaultRecordPage(context, body.objectId);
    default: throw new WorkspaceError("invalid_input", 400, "Unknown request.");
  }
});
