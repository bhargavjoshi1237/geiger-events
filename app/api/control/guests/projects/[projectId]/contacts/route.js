import { GUESTS } from "@/lib/control/guests/access";
import { contactView, parseContact } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { searchTerm } from "@/lib/control/records";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const PAGE = 200;

// GET ?q=&tag= — the Contact Book, by name; search covers name, email and company.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const query = new URL(request.url).searchParams;
    let list = scope.db.from("contacts").select("*").eq("project_id", projectId).is("deleted_at", null);
    const term = searchTerm(query.get("q"));
    if (term) list = list.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
    const tag = String(query.get("tag") || "").trim().slice(0, 60);
    if (tag) list = list.contains("tags", [tag]);
    const rows = must(await list.order("name", { ascending: true }).order("id").limit(PAGE), "contacts.list");
    return { contacts: rows.map(contactView), truncated: rows.length === PAGE };
  });
}

// POST { name, email?, phone?, company?, title?, location?, tags? }
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectScope(ctx, projectId, GUESTS);
    const row = parseContact(await readJson(request), { create: true });
    const result = await scope.db
      .from("contacts")
      .insert({ ...row, project_id: projectId, created_by: ctx.principal.id })
      .select("*")
      .single();
    // One contact per email in a project, enforced by a unique index.
    if (result.error?.code === "23505") throw new ApiError("conflict", 409, "There's already a contact with that email.");
    return { contact: contactView(must(result, "contacts.create")) };
  });
}
