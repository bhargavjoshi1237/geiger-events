import { participantScope } from "@/lib/control/community/scope";
import { participantView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// PATCH { muted } — a muted attendee can read but not post.
export async function PATCH(request, { params }) {
  const { participantId } = await params;
  return withControl(request, async (ctx) => {
    const { muted } = await readJson(request);
    if (typeof muted !== "boolean") throw new ApiError("invalid_input", 400, "Muted must be on or off.");
    const { db } = await participantScope(ctx, participantId);
    const row = must(
      await db.from("chat_participants").update({ muted }).eq("id", participantId).select("id,member_id,muted,joined_at").single(),
      "community.mute",
    );
    return { participant: participantView(row) };
  });
}

// DELETE — removes the attendee from this chat, as the dashboard's participants dialog does.
export async function DELETE(request, { params }) {
  const { participantId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await participantScope(ctx, participantId);
    must(await db.from("chat_participants").delete().eq("id", participantId), "community.removeParticipant");
    return { removed: true };
  });
}
