"use client";

import { createNotifier } from "@geiger/notify";
import { createClient } from "@/lib/supabase/client";
import { EVENTS_NOTIFICATION_TYPES } from "./types";

let notifier = null;

// Sends as the signed-in user, so notify.send's org-membership checks apply.
function sessionNotifier() {
  if (!notifier) notifier = createNotifier(createClient(), { app: "events", types: EVENTS_NOTIFICATION_TYPES });
  return notifier;
}

// Fire-and-forget: failures are logged by the notifier and never block the screen. Skips self-notices.
function notifyMember(userId, actorId, type, input) {
  if (!userId || userId === actorId) return;
  sessionNotifier().notifyUser(userId, type, input);
}

function eventData(event) {
  return { eventId: event?.id, eventName: event?.name, projectId: event?.projectId };
}

export function notifyEventTeamAdded({ userId, actorId, event, role }) {
  notifyMember(userId, actorId, "event_team.added", {
    projectId: event?.projectId,
    data: { ...eventData(event), role },
  });
}

export function notifyEventTeamRoleChanged({ userId, actorId, event, role }) {
  notifyMember(userId, actorId, "event_team.role_changed", {
    projectId: event?.projectId,
    data: { ...eventData(event), role },
  });
}

export function notifyEventTeamRemoved({ userId, actorId, event }) {
  notifyMember(userId, actorId, "event_team.removed", {
    projectId: event?.projectId,
    data: eventData(event),
  });
}

export function notifyTeamRoleChanged({ userId, actorId, projectId, projectName, role }) {
  notifyMember(userId, actorId, "team.role_changed", {
    projectId,
    data: { projectId, projectName, role },
  });
}

export function notifyTeamRemoved({ userId, actorId, projectId, projectName }) {
  notifyMember(userId, actorId, "team.removed", {
    projectId,
    data: { projectId, projectName },
  });
}
