import { ApiError } from "../../staff_access/errors.js";
import { userDb } from "../boundary.js";
import { requireId } from "../ids.js";
import { CONTROL_CAPABILITIES } from "../profile.js";
import { must, projectScope } from "../scope.js";

// Community records are read as the user first (RLS hides other projects), then authorised against their own project.

export const COMMUNITY_KEY = CONTROL_CAPABILITIES.inbox;

async function scoped(ctx, projectId, row, notFound) {
  if (!row || !projectId) throw new ApiError("not_found", 404, notFound);
  const scope = await projectScope(ctx, projectId, COMMUNITY_KEY);
  return { ...scope, row };
}

export async function channelScope(ctx, channelId) {
  requireId(channelId);
  const row = must(
    await userDb(ctx.token).from("chat_channels").select("*").eq("id", channelId).is("deleted_at", null).maybeSingle(),
    "community.channel",
  );
  return scoped(ctx, row?.project_id, row, "Chat not found.");
}

export async function messageScope(ctx, messageId) {
  requireId(messageId);
  const db = userDb(ctx.token);
  const row = must(await db.from("chat_messages").select("id,channel_id").eq("id", messageId).maybeSingle(), "community.message");
  if (!row) throw new ApiError("not_found", 404, "Message not found.");
  return { ...(await channelScope(ctx, row.channel_id)), message: row };
}

export async function participantScope(ctx, participantId) {
  requireId(participantId);
  const db = userDb(ctx.token);
  const row = must(await db.from("chat_participants").select("id,channel_id,member_id").eq("id", participantId).maybeSingle(), "community.participant");
  if (!row) throw new ApiError("not_found", 404, "Participant not found.");
  return { ...(await channelScope(ctx, row.channel_id)), participant: row };
}

export async function topicScope(ctx, topicId) {
  requireId(topicId);
  const row = must(
    await userDb(ctx.token).from("board_topics").select("*").eq("id", topicId).is("deleted_at", null).maybeSingle(),
    "community.topic",
  );
  return scoped(ctx, row?.project_id, row, "Topic not found.");
}

export async function postScope(ctx, postId) {
  requireId(postId);
  const row = must(
    await userDb(ctx.token).from("board_posts").select("*").eq("id", postId).is("deleted_at", null).maybeSingle(),
    "community.post",
  );
  return scoped(ctx, row?.project_id, row, "Reply not found.");
}

export async function meetingScope(ctx, meetingId) {
  requireId(meetingId);
  const row = must(
    await userDb(ctx.token).from("meetings").select("*").eq("id", meetingId).is("deleted_at", null).maybeSingle(),
    "community.meeting",
  );
  return scoped(ctx, row?.project_id, row, "Meeting not found.");
}

export async function meetingRequestScope(ctx, requestId) {
  requireId(requestId);
  const row = must(
    await userDb(ctx.token).from("meeting_requests").select("*").eq("id", requestId).is("deleted_at", null).maybeSingle(),
    "community.request",
  );
  return scoped(ctx, row?.project_id, row, "Request not found.");
}

// An event in this project, so a thread or schedule can't be attached across projects.
export async function eventInProject(db, projectId, eventId) {
  requireId(eventId);
  const row = must(
    await db.from("events").select("id,name").eq("id", eventId).eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
    "community.event",
  );
  if (!row) throw new ApiError("not_found", 404, "Event not found.");
  return row;
}

export async function eventNames(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map();
  if (!unique.length) return names;
  for (const e of must(await db.from("events").select("id,name").in("id", unique), "community.eventNames")) names.set(e.id, e.name);
  return names;
}
