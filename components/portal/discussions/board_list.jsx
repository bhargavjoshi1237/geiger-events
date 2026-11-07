"use client";

import React, { useMemo, useState } from "react";
import { Bell, Check, MessageCircle, MessagesSquare } from "lucide-react";

import { EmptyState, ScreenHeader, SearchInput } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { LucideIcon } from "@geiger/ui/icon-picker";
import { LoadingArea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/boards/constants";
import { StatusTag } from "./discussion_kit";

const EMAIL_CHOICES = [
  { value: null, label: "Use each board's default" },
  { value: true, label: "Email me about replies" },
  { value: false, label: "Notifications only, no email" },
];

function EmailPreference({ value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Reply emails</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>When someone replies to you</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EMAIL_CHOICES.map((c) => (
          <DropdownMenuItem key={String(c.value)} onSelect={() => onChange(c.value)}>
            <Check className={cn("h-4 w-4", value === c.value ? "opacity-100" : "opacity-0")} />
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardCard({ board, onOpen }) {
  const meta = [
    board.eventName || "Community",
    `${board.topicCount} ${board.topicCount === 1 ? "topic" : "topics"}`,
    `${board.postCount} ${board.postCount === 1 ? "reply" : "replies"}`,
  ];
  return (
    <button
      type="button"
      onClick={() => onOpen(board)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
        <LucideIcon name={board.icon} fallback={MessagesSquare} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("truncate text-sm text-foreground", board.newCount ? "font-semibold" : "font-medium")}>
            {board.name}
          </span>
          {board.format === "qa" ? <StatusTag tone="info">Q&amp;A</StatusTag> : null}
          {board.postingPolicy === "moderators_only" ? <StatusTag>Announcements</StatusTag> : null}
          {board.newCount ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {board.newCount} new
            </span>
          ) : null}
        </span>
        {board.description ? (
          <span className="mt-1 line-clamp-2 block text-xs text-text-secondary">{board.description}</span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
          {meta.map((m, i) => (
            <React.Fragment key={m}>
              {i > 0 ? <span aria-hidden>·</span> : null}
              <span>{m}</span>
            </React.Fragment>
          ))}
          {board.lastActivityAt ? (
            <>
              <span aria-hidden>·</span>
              <span>Active {relTime(board.lastActivityAt)} ago</span>
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function BoardList({ boards, loading, prefs, onOpen, onPrefChange }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = boards || [];
    if (!q) return list;
    return list.filter((b) => `${b.name} ${b.description} ${b.eventName}`.toLowerCase().includes(q));
  }, [boards, search]);

  return (
    <>
      <ScreenHeader
        title="Discussions"
        description="Topic boards from your organisers. Ask questions, share tips and keep the conversation going between events."
        actions={
          boards?.length ? <EmailPreference value={prefs?.boardEmail ?? null} onChange={onPrefChange} /> : null
        }
      />

      {loading ? (
        <LoadingArea size={40} label="Loading discussions" />
      ) : !boards?.length ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessageCircle}
            title="No discussions yet"
            description="When an organiser opens a discussion board for your events, it shows up here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {boards.length > 4 ? (
            <SearchInput value={search} onChange={setSearch} placeholder="Search boards…" />
          ) : null}
          {shown.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {shown.map((b) => (
                <BoardCard key={b.id} board={b} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState icon={MessageCircle} title="No boards match" description="Try a different search." />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default BoardList;
