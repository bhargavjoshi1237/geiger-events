import { normalizeSpec } from "@/lib/audience/resolve";
import { COMMUNITY_KEY, eventInProject, eventNames } from "@/lib/control/community/scope";
import { CHANNEL_KINDS, channelView, parseQaThread, summarizeChannels } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// GET ?kind=event|qa — the project's event chats or Q&A threads, newest activity first, with previews and counts.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await projectScope(ctx, projectId, COMMUNITY_KEY);
    const asked = new URL(request.url).searchParams.get("kind");
    const kind = CHANNEL_KINDS.includes(asked) ? asked : "event";
    const rows = must(
      await db.from("chat_channels").select("*").eq("project_id", projectId).eq("kind", kind).is("deleted_at", null).limit(300),
      "community.channels",
    );
    const ids = rows.map((r) => r.id);
    const [messages, participants, names] = await Promise.all([
      ids.length
        ? db
            .from("chat_messages")
            .select("channel_id,body,created_at")
            .in("channel_id", ids)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(5000)
            .then((r) => must(r, "community.previews"))
        : [],
      ids.length
        ? db.from("chat_participants").select("channel_id,member_id").in("channel_id", ids).limit(20000).then((r) => must(r, "community.counts"))
        : [],
      eventNames(db, rows.map((r) => r.event_id)),
    ]);
    return { channels: summarizeChannels(rows, messages, participants, names) };
  });
}

// POST { eventId, name, topic?, postingMode? } — a Q&A thread every ticket holder joins, through the dashboard's RPC.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const input = parseQaThread(await readJson(request));
    const { db } = await projectScope(ctx, projectId, COMMUNITY_KEY);
    const event = await eventInProject(db, projectId, input.eventId);
    const channelId = must(
      await db.rpc("create_qa_thread", {
        p_event_id: event.id,
        p_name: input.name,
        p_topic: input.topic,
        p_posting_mode: input.postingMode,
        p_audience: "all",
        p_emails: [],
      }),
      "community.createQa",
    );
    if (!channelId) throw new ApiError("service_unavailable", 503, "Couldn't create the thread. Try again.");
    // The live audience rule lives beside the legacy string, as setChannelAudience writes it.
    const current = must(await db.from("chat_channels").select("metadata").eq("id", channelId).single(), "community.qaMeta");
    const spec = normalizeSpec("all", { fallbackEventId: event.id });
    const row = must(
      await db
        .from("chat_channels")
        .update({ metadata: { ...(current.metadata || {}), audience: "all", audienceSpec: spec } })
        .eq("id", channelId)
        .select("*")
        .single(),
      "community.qaAudience",
    );
    return { channel: channelView(row, { eventName: event.name || "" }) };
  });
}
