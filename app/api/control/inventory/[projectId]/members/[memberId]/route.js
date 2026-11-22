import { withControl } from "@/lib/control/http";
import { memberView, parseMember } from "@/lib/control/inventory/model";
import { membersScope, ownedRow } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";

const NOT_FOUND = "Member not found.";

// PATCH { name?, email?, membershipId?, status?, expiresAt? } — cancel by status, extend by moving the expiry.
export async function PATCH(request, { params }) {
  const { projectId, memberId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await membersScope(ctx, projectId);
    const body = await readJson(request);
    await ownedRow(scope.db, "membership_members", memberId, projectId, { notFound: NOT_FOUND });
    const plans = must(
      await scope.db.from("ticketing_records").select("id,name").eq("project_id", projectId).eq("module", "membership").is("deleted_at", null),
      "members.plans",
    );
    const patch = parseMember(body, { plans: new Set(plans.map((p) => p.id)) });
    const saved = must(await scope.db.from("membership_members").update(patch).eq("id", memberId).select("*").single(), "members.update");
    return { member: memberView(saved, new Map(plans.map((p) => [p.id, p.name]))) };
  });
}

export async function DELETE(request, { params }) {
  const { projectId, memberId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await membersScope(ctx, projectId);
    await ownedRow(scope.db, "membership_members", memberId, projectId, { notFound: NOT_FOUND });
    must(await scope.db.from("membership_members").update({ deleted_at: new Date().toISOString() }).eq("id", memberId), "members.delete");
    return { deleted: true };
  });
}
