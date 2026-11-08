"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MessageSquare,
  MessagesSquare,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

import {
  DataTable,
  EmptyState,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { ActionMenu } from "@geiger/ui/action-menu";
import { relTime } from "@/lib/boards/constants";
import { AuthorAvatar, OrganiserBadge, TOPIC_STATUS_MAP } from "./shared";

const STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "pending", label: "Awaiting approval" },
  { value: "hidden", label: "Hidden" },
];

const FLAG_FILTER = [
  { value: "all", label: "Everything" },
  { value: "pinned", label: "Pinned" },
  { value: "locked", label: "Locked" },
  { value: "unanswered", label: "Unanswered (Q&A)" },
  { value: "noreplies", label: "No replies yet" },
];

export function TopicsTab({ tabs, topics, boards, onOpen, onUpdate, onMove, onDelete }) {
  const [boardId, setBoardId] = useState("all");
  const [status, setStatus] = useState("all");
  const [flag, setFlag] = useState("all");
  const [search, setSearch] = useState("");

  const boardById = useMemo(() => Object.fromEntries((boards || []).map((b) => [b.id, b])), [boards]);
  const boardOptions = useMemo(
    () => [{ value: "all", label: "All boards" }, ...(boards || []).map((b) => ({ value: b.id, label: b.name }))],
    [boards],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (topics || []).filter((t) => {
      if (boardId !== "all" && t.boardId !== boardId) return false;
      if (status !== "all" && t.status !== status) return false;
      if (flag === "pinned" && !t.pinned) return false;
      if (flag === "locked" && !t.locked) return false;
      if (flag === "unanswered" && (boardById[t.boardId]?.format !== "qa" || t.acceptedPostId)) return false;
      if (flag === "noreplies" && t.replyCount) return false;
      if (q && !`${t.title} ${t.body} ${t.authorName} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [topics, boardId, status, flag, search, boardById]);

  const pager = usePagination(filtered, { resetKey: `${boardId}|${status}|${flag}|${search}` });

  const columns = [
    {
      key: "topic",
      header: "Topic",
      render: (t) => (
        <div className="flex min-w-0 items-start gap-3">
          <AuthorAvatar name={t.authorName} organiser={t.authorKind === "organiser"} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-1.5">
              {t.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              <span className="max-w-[28rem] truncate font-medium text-foreground">{t.title}</span>
              {t.locked ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" /> : null}
              {t.acceptedPostId ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : null}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
              {t.authorName}
              {t.authorKind === "organiser" ? <OrganiserBadge /> : null}
              <span className="text-text-tertiary">· {boardById[t.boardId]?.name || "Board"}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusPill status={t.status} map={TOPIC_STATUS_MAP} />,
    },
    {
      key: "replies",
      header: "Replies",
      align: "right",
      className: "text-right tabular-nums text-foreground",
      render: (t) => (
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5 text-text-tertiary" /> {t.replyCount}
        </span>
      ),
    },
    {
      key: "activity",
      header: "Last activity",
      render: (t) => <span className="text-sm text-text-tertiary">{relTime(t.lastActivityAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (t) => (
        <ActionMenu
          label={`Actions for ${t.title}`}
          items={[
            { icon: MessagesSquare, label: "Open thread", onSelect: () => onOpen(t) },
            { separator: true },
            t.status === "pending" && { icon: CheckCircle2, label: "Approve", onSelect: () => onUpdate(t, { status: "published" }) },
            {
              icon: t.pinned ? PinOff : Pin,
              label: t.pinned ? "Unpin" : "Pin to top",
              onSelect: () => onUpdate(t, { pinned: !t.pinned }),
            },
            {
              icon: t.locked ? LockOpen : Lock,
              label: t.locked ? "Unlock replies" : "Lock replies",
              onSelect: () => onUpdate(t, { locked: !t.locked }),
            },
            t.status === "hidden"
              ? { icon: Eye, label: "Restore", onSelect: () => onUpdate(t, { status: "published" }) }
              : { icon: EyeOff, label: "Hide", onSelect: () => onUpdate(t, { status: "hidden" }) },
            { icon: ArrowRightLeft, label: "Move to…", onSelect: () => onMove(t) },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(t) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Toolbar>
        {tabs}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
          <FilterDropdown value={boardId} onValueChange={setBoardId} options={boardOptions} height="h-9" />
          <FilterDropdown value={status} onValueChange={setStatus} options={STATUS_FILTER} height="h-9" />
          <FilterDropdown value={flag} onValueChange={setFlag} options={FLAG_FILTER} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search topics, authors, tags…" />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={pager.pageItems}
        getRowKey={(t) => t.id}
        onRowClick={onOpen}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={MessagesSquare}
              title={topics?.length ? "No topics match your filters" : "No topics yet"}
              description={
                topics?.length
                  ? "Try clearing the search or filters."
                  : "Topics members start in the portal show up here. You can also start one yourself."
              }
            />
          </div>
        }
      />
      <ListPagination {...pager} itemLabel="topics" />
    </div>
  );
}

export default TopicsTab;
