import { GUESTS, projectRow } from "@/lib/control/guests/access";
import { contactView, parseContact } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

const contactScope = (ctx, contactId) =>
  projectRow(ctx, { table: "contacts", id: contactId, permission: GUESTS, notFound: "Contact not found." });

export async function GET(request, { params }) {
  const { contactId } = await params;
  return withControl(request, async (ctx) => ({ contact: contactView((await contactScope(ctx, contactId)).row) }));
}

// PATCH { name?, email?, phone?, company?, title?, location?, tags? }
export async function PATCH(request, { params }) {
  const { contactId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseContact(await readJson(request));
    const scope = await contactScope(ctx, contactId);
    const result = await scope.db.from("contacts").update(patch).eq("id", contactId).is("deleted_at", null).select("*").maybeSingle();
    if (result.error?.code === "23505") throw new ApiError("conflict", 409, "There's already a contact with that email.");
    const row = must(result, "contacts.update");
    if (!row) throw new ApiError("not_found", 404, "Contact not found.");
    return { contact: contactView(row) };
  });
}

// Soft delete, as the dashboard does; their registrations and orders are untouched.
export async function DELETE(request, { params }) {
  const { contactId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await contactScope(ctx, contactId);
    must(await scope.db.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", contactId), "contacts.delete");
    return { deleted: true };
  });
}
