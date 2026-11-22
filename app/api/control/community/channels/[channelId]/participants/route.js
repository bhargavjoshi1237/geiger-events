import { channelScope } from "@/lib/control/community/scope";
import { participantView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must } from "@/lib/control/scope";

// GET — the attendees in a chat, for muting or removing; like the dashboard, they're listed without names.
export async function GET(request, { params }) {
  const { channelId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await channelScope(ctx, channelId);
    const rows = must(
      await db
        .from("chat_participants")
        .select("id,member_id,muted,joined_at")
        .eq("channel_id", channelId)
        .not("member_id", "is", null)
        .order("joined_at", { ascending: true })
        .limit(2000),
      "community.participants",
    );
    return { participants: rows.map(participantView) };
  });
}
