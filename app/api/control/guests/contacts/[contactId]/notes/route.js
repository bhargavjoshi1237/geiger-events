import { randomUUID } from "node:crypto";

import { GUESTS, projectRow } from "@/lib/control/guests/access";
import { contactView, parseNote, withNote } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";

// POST { body } — a note on the contact, stored in metadata.notes newest first, the shape the dashboard writes.
export async function POST(request, { params }) {
  const { contactId } = await params;
  return withControl(request, async (ctx) => {
    const body = parseNote(await readJson(request));
    const scope = await projectRow(ctx, { table: "contacts", id: contactId, permission: GUESTS, notFound: "Contact not found." });
    const note = { id: randomUUID(), body, createdAt: new Date().toISOString(), createdBy: ctx.principal.id };
    const row = must(
      await scope.db.from("contacts").update({ metadata: withNote(scope.row.metadata, note) }).eq("id", contactId).select("*").single(),
      "contacts.note",
    );
    return { contact: contactView(row) };
  });
}
