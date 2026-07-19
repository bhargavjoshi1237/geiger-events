"use client";

import React from "react";

import PortalThreadBoard from "./portal_thread_board";

// Members-portal Q&A: the organiser-created discussion threads a member belongs to
// (kind=qa), presented exactly like the organiser dashboard's Q&A — a full-width
// list of thread cards that opens into a full-width chat (read & chat only).
export function PortalQa({ member }) {
  return (
    <PortalThreadBoard
      member={member}
      kind="qa"
      title="Q&A"
      description="Discussion threads for the events you're attending. Ask questions and join the conversation."
      emptyTitle="No Q&A threads yet"
      emptyText="When an organiser opens a Q&A thread you're part of, it shows up here."
      subtitleFor={(c) => (c.postingMode === "open" ? "Open discussion" : "Announcements")}
    />
  );
}

export default PortalQa;
