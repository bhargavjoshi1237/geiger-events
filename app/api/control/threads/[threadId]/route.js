import { withControl } from "@/lib/control/http";
import { CONTROL_CAPABILITIES } from "@/lib/control/profile";
import { messageView, parseMessage, threadView } from "@/lib/control/records";
import { must, readJson, threadScope } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

async function conversation(db, thread) {
  const [messages, event] = await Promise.all([
    db.from("portal_thread_messages").select("id,sender,body,created_at").eq("thread_id", thread.id).order("created_at", { ascending: true }).then((r) => must(r, "thread.messages")),
    thread.event_id
      ? db.from("events").select("name").eq("id", thread.event_id).maybeSingle().then((r) => must(r, "thread.event"))
      : null,
  ]);
  return { thread: threadView(thread, { eventName: event?.name || "" }), messages: messages.map(messageView) };
}

// GET — the full conversation; opening it clears the organiser's unread flag, as on the dashboard.
export async function GET(request, { params }) {
  const { threadId } = await params;
  return withControl(request, async (ctx) => {
    const { db, row } = await threadScope(ctx, threadId, CONTROL_CAPABILITIES.inbox);
    if (row.organiser_unread) must(await db.from("portal_threads").update({ organiser_unread: false }).eq("id", threadId), "thread.read");
    return conversation(db, { ...row, organiser_unread: false });
  });
}

// POST { body } — an organiser reply; reopens the thread and flags it unread for the buyer.
export async function POST(request, { params }) {
  const { threadId } = await params;
  return withControl(request, async (ctx) => {
    const body = parseMessage(await readJson(request));
    const { db, row } = await threadScope(ctx, threadId, CONTROL_CAPABILITIES.inbox);
    must(await db.from("portal_thread_messages").insert({ thread_id: threadId, sender: "organiser", body }), "thread.reply");
    const update = { last_message_at: new Date().toISOString(), status: "open", member_unread: true, organiser_unread: false };
    must(await db.from("portal_threads").update(update).eq("id", threadId), "thread.bump");
    return conversation(db, { ...row, ...update });
  });
}

// PATCH { status: "open" | "closed" }
export async function PATCH(request, { params }) {
  const { threadId } = await params;
  return withControl(request, async (ctx) => {
    const { status } = await readJson(request);
    if (status !== "open" && status !== "closed") throw new ApiError("invalid_input", 400, "Status must be open or closed.");
    const { db, row } = await threadScope(ctx, threadId, CONTROL_CAPABILITIES.inbox);
    must(await db.from("portal_threads").update({ status }).eq("id", threadId), "thread.status");
    return conversation(db, { ...row, status });
  });
}
