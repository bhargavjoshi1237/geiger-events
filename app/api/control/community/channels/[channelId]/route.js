import { channelScope, eventNames } from "@/lib/control/community/scope";
import { channelView, chatMessageView, parseChannelPatch } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function detail(db, row) {
  const [messages, names] = await Promise.all([
    db
      .from("chat_messages")
      .select("*")
      .eq("channel_id", row.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then((r) => must(r, "community.messages")),
    eventNames(db, [row.event_id]),
  ]);
  return {
    channel: channelView(row, { eventName: (row.event_id && names.get(row.event_id)) || "" }),
    // Newest 200, returned oldest first like the dashboard's thread.
    messages: messages.reverse().map(chatMessageView),
  };
}

export async function GET(request, { params }) {
  const { channelId } = await params;
  return withControl(request, async (ctx) => {
    const { db, row } = await channelScope(ctx, channelId);
    return detail(db, row);
  });
}

// PATCH { postingMode?, status?, topic? } — open/announce-only and archive/reopen, as the dashboard's chat settings do.
export async function PATCH(request, { params }) {
  const { channelId } = await params;
  return withControl(request, async (ctx) => {
    const patch = parseChannelPatch(await readJson(request));
    const { db } = await channelScope(ctx, channelId);
    const row = must(await db.from("chat_channels").update(patch).eq("id", channelId).select("*").single(), "community.channelUpdate");
    return detail(db, row);
  });
}

// Only organiser-made Q&A threads can be deleted; an event's own chat is configured from the event.
export async function DELETE(request, { params }) {
  const { channelId } = await params;
  return withControl(request, async (ctx) => {
    const { db, row } = await channelScope(ctx, channelId);
    if (row.kind !== "qa") throw new ApiError("invalid_state", 409, "An event's chat can be archived, not deleted.");
    must(await db.from("chat_channels").update({ deleted_at: new Date().toISOString() }).eq("id", channelId), "community.channelDelete");
    return { deleted: true };
  });
}
