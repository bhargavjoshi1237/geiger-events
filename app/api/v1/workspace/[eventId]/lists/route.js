import { workspaceApi, workspaceApiRoute } from "@/lib/workspace/api/records";

export const runtime = "nodejs";

// The event workspace's lists, with their fields and statuses.
export const GET = workspaceApiRoute("read:workspace", workspaceApi.lists);
