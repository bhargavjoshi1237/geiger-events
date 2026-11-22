import { withControl } from "@/lib/control/http";
import { MEMBER_STATUSES, memberView, parseMember } from "@/lib/control/inventory/model";
import { membersScope } from "@/lib/control/inventory/scope";
import { must, readJson } from "@/lib/control/scope";
import { searchTerm } from "@/lib/control/records";

// Plans are membership records in ticketing_records; members point at one by id.
async function loadPlans(db, projectId) {
  return must(
    await db.from("ticketing_records").select("id,name,active").eq("project_id", projectId).eq("module", "membership").is("deleted_at", null).order("name"),
    "members.plans",
  );
}

// GET ?q=&status= — the membership roster with each member's plan, plus the plans a new member can join.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await membersScope(ctx, projectId);
    const query = new URL(request.url).searchParams;
    let list = scope.db.from("membership_members").select("*").eq("project_id", projectId).is("deleted_at", null);
    const status = query.get("status");
    if (MEMBER_STATUSES.includes(status)) list = list.eq("status", status);
    const term = searchTerm(query.get("q"));
    if (term) list = list.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    const [members, plans] = await Promise.all([
      list.order("created_at", { ascending: false }).limit(500).then((r) => must(r, "members.list")),
      loadPlans(scope.db, projectId),
    ]);
    const names = new Map(plans.map((p) => [p.id, p.name]));
    return { members: members.map((m) => memberView(m, names)), plans: plans.map((p) => ({ id: p.id, name: p.name, active: p.active !== false })) };
  });
}

// POST { name?, email, membershipId?, status?, expiresAt? } — enrols someone by hand, as the dashboard's Add member does.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await membersScope(ctx, projectId);
    const plans = await loadPlans(scope.db, projectId);
    const row = parseMember(await readJson(request), { create: true, plans: new Set(plans.map((p) => p.id)) });
    const created = must(
      await scope.db.from("membership_members").insert({ status: "Active", ...row, project_id: projectId }).select("*").single(),
      "members.create",
    );
    return { member: memberView(created, new Map(plans.map((p) => [p.id, p.name]))) };
  });
}
