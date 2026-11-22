import { DELETE as revokeKey, POST as createKey } from "@/app/api/settings/api-keys/route";
import { requireId, withControl } from "@/lib/control/http";
import { readJson } from "@/lib/control/scope";
import { forwardToHandler } from "@/lib/control/team/forward";

// POST { name, scopes, expiry } → { key, secret }. Minted by the dashboard's own handler; the secret comes back this once.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async () => {
    requireId(projectId);
    const body = await readJson(request);
    const data = await forwardToHandler(createKey, request, {
      method: "POST",
      body: { projectId, name: body.name, scopes: body.scopes, expiry: body.expiry },
    });
    return { key: { id: data.key?.id, name: data.key?.name, prefix: data.key?.prefix }, secret: data.secret };
  });
}

// DELETE { id } — permanent; the row stays for the audit trail.
export async function DELETE(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async () => {
    requireId(projectId);
    const { id } = await readJson(request);
    await forwardToHandler(revokeKey, request, { method: "DELETE", body: { projectId, id } });
    return { revoked: true };
  });
}
