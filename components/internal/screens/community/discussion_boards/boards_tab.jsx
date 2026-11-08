"use client";

import React, { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  GripVertical,
  Lock,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { EmptyState, SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LucideIcon } from "@geiger/ui/icon-picker";
import { cn } from "@/lib/utils";
import { describeSpec } from "@/lib/audience/resolve";
import { relTime } from "@/lib/boards/constants";

const VIEW_FILTER = [
  { value: "active", label: "Active boards" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All boards" },
];

function BoardRow({ board, index, total, eventName, drag, setDrag, onDrop, onMove, onEdit, onArchive, onDelete, canDrag }) {
  const [over, setOver] = useState(false);
  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        setDrag(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      }}
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const from = drag ?? Number(e.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from)) onDrop(from, index);
        setDrag(null);
      }}
      onDragEnd={() => {
        setOver(false);
        setDrag(null);
      }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-3 transition-colors sm:px-4",
        over && "border-primary/60 bg-surface-hover",
        drag === index && "opacity-50",
        board.archived && "opacity-70",
      )}
    >
      {canDrag ? (
        <span className="hidden cursor-grab text-text-tertiary active:cursor-grabbing sm:block" title="Drag to reorder" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
      ) : null}
      <button type="button" onClick={() => onEdit(board)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
          <LucideIcon name={board.icon} fallback={MessagesSquare} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{board.name}</span>
            {board.format === "qa" ? <Badge variant="info">Q&amp;A</Badge> : null}
            {board.postingPolicy === "moderators_only" ? <Badge variant="purple">Announcements</Badge> : null}
            {board.requireApproval ? (
              <Badge variant="warning">
                <Lock /> Approval
              </Badge>
            ) : null}
            {board.archived ? (
              <Badge variant="neutral">
                <Archive /> Archived
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
              {eventName || "Community-wide"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-text-tertiary" />
              {describeSpec(board.audience)}
            </span>
          </span>
        </span>
      </button>
      <div className="hidden shrink-0 text-right text-xs text-text-secondary md:block">
        <p className="tabular-nums text-foreground">
          {board.topicCount} <span className="text-text-tertiary">topics</span> · {board.postCount}{" "}
          <span className="text-text-tertiary">replies</span>
        </p>
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          {board.lastActivityAt ? `Active ${relTime(board.lastActivityAt)} ago` : "No activity yet"}
        </p>
      </div>
      <ActionMenu
        label={`Actions for ${board.name}`}
        items={[
          { icon: Pencil, label: "Edit", onSelect: () => onEdit(board) },
          canDrag && index > 0 && { icon: ArrowUp, label: "Move up", onSelect: () => onMove(index, index - 1) },
          canDrag && index < total - 1 && { icon: ArrowDown, label: "Move down", onSelect: () => onMove(index, index + 1) },
          { separator: true },
          board.archived
            ? { icon: ArchiveRestore, label: "Restore", onSelect: () => onArchive(board, false) }
            : { icon: Archive, label: "Archive", onSelect: () => onArchive(board, true) },
          { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(board) },
        ]}
      />
    </div>
  );
}

export function BoardsTab({ tabs, boards, eventNames, onCreate, onEdit, onArchive, onDelete, onReorder }) {
  const [view, setView] = useState("active");
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (boards || []).filter((b) => {
      if (view === "active" && b.archived) return false;
      if (view === "archived" && !b.archived) return false;
      if (q && !`${b.name} ${b.description} ${eventNames[b.eventId] || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boards, view, search, eventNames]);

  // Reordering only makes sense on the unfiltered active list.
  const canDrag = view === "active" && !search.trim() && shown.length > 1;

  const move = (from, to) => {
    if (from === to || to < 0 || to >= shown.length) return;
    const next = [...shown];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next.map((b) => b.id));
  };

  if (!boards?.length) {
    return (
      <div className="space-y-5">
        {tabs}
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title="No boards yet"
            description="Create a board for members to start topics, ask questions and keep talking between events."
            action={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onCreate}>
                <Plus className="h-4 w-4" /> New board
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toolbar>
        {tabs}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
          <FilterDropdown value={view} onValueChange={setView} options={VIEW_FILTER} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search boards…" />
        </div>
      </Toolbar>

      {shown.length ? (
        <div className="space-y-2">
          {shown.map((b, i) => (
            <BoardRow
              key={b.id}
              board={b}
              index={i}
              total={shown.length}
              eventName={b.eventId ? eventNames[b.eventId] || "Event" : ""}
              drag={drag}
              setDrag={setDrag}
              onDrop={move}
              onMove={move}
              canDrag={canDrag}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
          {canDrag ? (
            <p className="px-1 text-[11px] text-text-tertiary">Drag boards to set the order members see them in.</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={MessagesSquare} title="No boards match" description="Try a different filter or search." />
        </div>
      )}
    </div>
  );
}

export default BoardsTab;
