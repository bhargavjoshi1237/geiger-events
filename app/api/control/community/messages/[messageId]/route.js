import { messageScope } from "@/lib/control/community/scope";
import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";

// DELETE — removes a message for everyone; the text is cleared as well, as the dashboard does.
export async function DELETE(request, { params }) {
  const { messageId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await messageScope(ctx, messageId);
    must(
      await db.from("chat_messages").update({ deleted_at: new Date().toISOString(), body: "" }).eq("id", messageId),
      "community.deleteMessage",
    );
    return { deleted: true };
  });
}
