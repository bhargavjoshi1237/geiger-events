import { workspaceApi, workspaceApiRoute } from "@/lib/workspace/api/records";

export const runtime = "nodejs";
export const maxDuration = 60;

// Records of one list (?filter=<json>&sort=-number&search=&limit=&offset=), or a new record.
export const GET = workspaceApiRoute("read:workspace", workspaceApi.records);
export const POST = workspaceApiRoute("write:workspace", workspaceApi.create, { write: true });
