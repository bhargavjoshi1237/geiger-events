"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { BoardList } from "./discussions/board_list";
import { TopicList } from "./discussions/topic_list";
import { TopicView } from "./discussions/topic_view";
import { boardRequest } from "./discussions/discussion_kit";

// Members-portal Discussions: boards list -> a board's topics -> a topic thread. All reads/writes go through
// /api/portal/boards/*, which only ever returns boards whose audience includes this member.

function topicFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("topic");
}

export function PortalDiscussions({ openTopicId = null, onConsumeOpen }) {
  const [view, setView] = useState(() => {
    const topicId = openTopicId || topicFromUrl();
    return topicId ? { kind: "topic", topicId } : { kind: "boards" };
  });
  const [boards, setBoards] = useState(null);
  const [prefs, setPrefs] = useState({ boardEmail: null });

  const loadBoards = () =>
    boardRequest("/api/portal/boards").then(({ ok, data }) => {
      setBoards(ok ? data.boards || [] : []);
      if (ok && data.prefs) setPrefs(data.prefs);
    });

  useEffect(() => {
    loadBoards();
    // Drop the emailed ?topic= deep link once it has been opened.
    if (topicFromUrl()) {
      window.history.replaceState({}, "", `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/members`);
    }
  }, []);

  // A notification can open a topic while this tab is already mounted (derived during render, then consumed).
  const [handledOpen, setHandledOpen] = useState(openTopicId);
  if (openTopicId !== handledOpen) {
    setHandledOpen(openTopicId);
    if (openTopicId) setView({ kind: "topic", topicId: openTopicId });
  }
  useEffect(() => {
    if (openTopicId) onConsumeOpen?.();
  }, [openTopicId, onConsumeOpen]);

  const changePref = async (value) => {
    const prev = prefs;
    setPrefs({ boardEmail: value });
    const { ok, data } = await boardRequest("/api/portal/boards/preferences", {
      method: "POST",
      body: { boardEmail: value },
    });
    if (!ok) {
      setPrefs(prev);
      toast.error(data.error || "Couldn't save your preference.");
      return;
    }
    toast.success(
      value === true
        ? "We'll email you about replies."
        : value === false
          ? "Replies will only show in your notifications."
          : "Using each board's default.",
    );
  };

  const backToBoards = () => {
    setView({ kind: "boards" });
    loadBoards();
  };

  return (
    <MainScreenWrapper>
      {view.kind === "topic" ? (
        <TopicView
          key={view.topicId}
          topicId={view.topicId}
          onBack={(boardId) => (boardId ? setView({ kind: "board", boardId }) : backToBoards())}
        />
      ) : view.kind === "board" ? (
        <TopicList
          key={view.boardId}
          boardId={view.boardId}
          onBack={backToBoards}
          onOpenTopic={(t) => setView({ kind: "topic", topicId: t.id, boardId: t.boardId })}
        />
      ) : (
        <BoardList
          boards={boards}
          loading={boards === null}
          prefs={prefs}
          onOpen={(b) => setView({ kind: "board", boardId: b.id })}
          onPrefChange={changePref}
        />
      )}
    </MainScreenWrapper>
  );
}

export default PortalDiscussions;
