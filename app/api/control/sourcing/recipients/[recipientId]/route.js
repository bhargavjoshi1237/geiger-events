import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";
import { recipientScope } from "@/lib/control/sourcing/scope";

// DELETE — removes the venue and kills its link, so an emailed token stops working, as on the dashboard.
export async function DELETE(request, { params }) {
  const { recipientId } = await params;
  return withControl(request, async (ctx) => {
    const { db, recipient } = await recipientScope(ctx, recipientId);
    must(
      await db.from("rfp_recipients").update({ deleted_at: new Date().toISOString(), token_hash: null }).eq("id", recipient.id),
      "sourcing.recipient.remove",
    );
    return { removed: true };
  });
}
