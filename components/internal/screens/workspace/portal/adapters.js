"use client";

import { workspaceApi } from "@/lib/workspace/client";
import { portalBuilderApi } from "@/lib/workspace/portal/client";

// Builder preview: the draft as a role or person sees it. Reads only; writes are switched off.
export function createPreviewAdapter({ eventId, as, onOpenRecord, onNavigate }) {
  const api = portalBuilderApi(eventId);
  const off = async () => ({ data: null, error: { code: "preview", message: "Previews are read-only." } });
  return {
    readOnly: "Preview — nothing you do here is saved.",
    blockData: (body, signal) => api.view({ what: "block", ...body, as }, signal),
    command: off, signUpload: off, saveDraft: off, clearDraft: off,
    lookup: async () => ({ data: { items: [] }, error: null }),
    signFile: async () => ({ data: null, error: { code: "preview", message: "Files open on the live portal." } }),
    openRecord: onOpenRecord,
    navigate: onNavigate,
  };
}

// Team pages in the dashboard: full access through the staff Workspace API, records open in the staff record sheet.
export function createTeamAdapter({ eventId, page, definition, onOpenRecord, onNavigate }) {
  const api = portalBuilderApi(eventId);
  const as = { mode: "team", draft: true };
  const blockConfig = (blockId) => page?.body?.blocks?.find((block) => block.id === blockId)?.config ?? {};
  const field = (fieldId) => definition?.fields?.find((item) => item.id === fieldId);
  return {
    inlineFiles: false,
    blockData: (body, signal) => api.view({ what: "block", ...body, as }, signal),
    async command(body) {
      if (body.action === "record.create") {
        const config = blockConfig(body.blockId);
        const result = await workspaceApi.command(eventId, { action: "record.create", objectId: config.objectId, values: body.values ?? {}, ...(config.status ? { status: config.status } : {}) });
        return result.error ? result : { data: { record: result.data?.record ?? null, link: null, success: config.success ?? null }, error: null };
      }
      if (body.action === "record.update") {
        const { action, recordId, expectedRevision, values, status } = body;
        return workspaceApi.command(eventId, { action, recordId, expectedRevision, values: values ?? {}, ...(status !== undefined ? { status } : {}) });
      }
      if (body.action === "scan.mark") return api.scan({ ...body, draft: true });
      if (body.action === "comment.add") {
        const result = await workspaceApi.command(eventId, { action: "comment.add", recordId: body.recordId, body: body.body });
        return result.error ? result : { data: { comments: [] }, error: null };
      }
      return workspaceApi.command(eventId, body);
    },
    lookup: ({ fieldId, q }, signal) => workspaceApi.lookup(eventId, { kind: "record", objectId: field(fieldId)?.config?.targetObjectId, q }, signal),
    signUpload: (body) => workspaceApi.signUpload(eventId, { fieldId: body.fieldId, name: body.name, size: body.size, type: body.type }),
    signFile: ({ fileId }) => workspaceApi.download(eventId, fileId),
    openRecord: onOpenRecord,
    navigate: onNavigate,
  };
}
