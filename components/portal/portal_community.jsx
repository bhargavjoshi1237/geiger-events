"use client";

import React from "react";

import PortalChannels from "./portal_channels";

// Members-portal Community: the event group chats a member belongs to (kind=event).
export function PortalCommunity({ member }) {
  return (
    <PortalChannels
      member={member}
      kind="event"
      title="Community"
      description="Group chats for the events you're attending. Say hi, ask questions, and hear from the organiser."
      emptyTitle="No chats yet"
      emptyText="When you buy a ticket to an event with chat enabled, its group chat shows up here."
      subtitleFor={(c) => (c.postingMode === "open" ? "Group chat" : "Announcements")}
    />
  );
}

export default PortalCommunity;
