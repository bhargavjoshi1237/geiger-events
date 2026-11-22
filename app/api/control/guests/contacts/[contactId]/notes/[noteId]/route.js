import { GUESTS, projectRow } from "@/lib/control/guests/access";
import { contactView, withoutNote } from "@/lib/control/guests/views";
import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";

export async function DELETE(request, { params }) {
  const { contactId, noteId } = await params;
  return withControl(request, async (ctx) => {
    const scope = await projectRow(ctx, { table: "contacts", id: contactId, permission: GUESTS, notFound: "Contact not found." });
    const row = must(
      await scope.db.from("contacts").update({ metadata: withoutNote(scope.row.metadata, String(noteId)) }).eq("id", contactId).select("*").single(),
      "contacts.noteDelete",
    );
    return { contact: contactView(row) };
  });
}
