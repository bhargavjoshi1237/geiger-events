import { workspaceApi, workspaceApiRoute } from "@/lib/workspace/api/records";

export const runtime = "nodejs";
export const maxDuration = 60;

// One record: read it, change some of its values or its status, or move it to the trash.
export const GET = workspaceApiRoute("read:workspace", workspaceApi.record);
export const PATCH = workspaceApiRoute("write:workspace", workspaceApi.update, { write: true });
export const DELETE = workspaceApiRoute("write:workspace", workspaceApi.remove, { write: true });
