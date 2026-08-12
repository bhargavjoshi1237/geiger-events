"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  MonitorPlay,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { conferenceApi } from "@/lib/supabase/conference";
import { getUser } from "@/lib/supabase/user";
import { formatDate } from "@/components/internal/screens/events/sample_data";
import {
  BOARD_STATUS_MAP,
  DEFAULT_THEME,
  THEME_OPTIONS,
} from "@/lib/display/constants";
import { BoardBuilder } from "./display/board_builder";

// Display Boards — the billboard/signage surface. A board is an events
// .conference_records row (module "board") whose config carries the slide queue
// the organiser crafts on the canvas, and which renders at /display/<id> on a
// screen that is never signed in.
//
// Two levels: this list of boards across the project, then the builder. The open
// board lives in the URL (?record=<id>) so a refresh or a shared link stays on
// it, like every other record area.

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All boards" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

// A new board opens with a title card and a Now & Next — the two slides every
// lobby screen needs — so it plays something the moment it's created.
const starterSlides = () => [
  {
    id: `slide_${crypto.randomUUID()}`,
    type: "title",
    duration: 8,
    config: { heading: "", subheading: "", showCover: true },
    position: { x: 0, y: 0 },
  },
  {
    id: `slide_${crypto.randomUUID()}`,
    type: "now_next",
    duration: 12,
    config: { heading: "Happening now", day: "", upcoming: 4 },
    position: { x: 0, y: 150 },
  },
];

function CreateBoardDialog({ open, onOpenChange, events, onCreate }) {
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setEventId("");
      setTheme(DEFAULT_THEME);
    }
  }

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give the board a name first.");
      return;
    }
    if (!eventId) {
      toast.error("Pick the event this board shows.");
      return;
    }
    onCreate({ name: name.trim(), eventId, theme });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>New display board</DialogTitle>
          <DialogDescription>
            A rotating schedule board for a screen in the venue — the lobby wall,
            a door display, or an exported video for a billboard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Board name" htmlFor="board-name">
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. Lobby wall"
              autoFocus
            />
          </Field>
          <Field label="Event" hint="Whose agenda this board reads">
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick an event" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Theme">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            <Plus className="h-4 w-4" /> Create board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DisplayBoardsScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const [events, setEvents] = useState([]);
  const [boards, setBoards] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listEvents(projectId),
      conferenceApi.list(projectId, "board"),
      conferenceApi.list(projectId, "session"),
    ]).then(([evts, brds, sess]) => {
      if (!alive) return;
      setEvents(evts ?? []);
      setBoards(brds ?? []);
      setSessions(sess ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventsById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );

  const openBoard = useMemo(
    () => (recordId ? boards.find((b) => b.id === recordId) || null : null),
    [recordId, boards],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boards.filter((b) => {
      const published = b.config?.published === true;
      if (statusFilter === "published" && !published) return false;
      if (statusFilter === "draft" && published) return false;
      if (q) {
        const eventName = eventsById.get(b.config?.eventId)?.name || "";
        if (!`${b.name} ${eventName}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [boards, search, statusFilter, eventsById]);

  const stats = useMemo(
    () => [
      { label: "Boards", value: String(boards.length), footer: "In this project" },
      {
        label: "Published",
        value: String(boards.filter((b) => b.config?.published === true).length),
        footer: "Live on a screen",
      },
      {
        label: "Events covered",
        value: String(
          new Set(boards.map((b) => b.config?.eventId).filter(Boolean)).size,
        ),
        footer: "Have a board",
      },
      {
        label: "Slides",
        value: String(
          boards.reduce((total, b) => total + (b.config?.slides?.length || 0), 0),
        ),
        footer: "Across all boards",
      },
    ],
    [boards],
  );

  // --- Mutations (optimistic + persisted) ---
  const handleCreate = ({ name, eventId, theme }) => {
    const record = {
      id: crypto.randomUUID(),
      module: "board",
      name,
      status: "Draft",
      coverUrl: "",
      config: {
        eventId,
        theme,
        speed: 1,
        published: false,
        slides: starterSlides(),
        graph: null,
      },
      createdBy: userId,
      projectId,
    };
    setBoards((prev) => [record, ...prev]);
    toast.success("Board created.");
    conferenceApi.create(record).then((saved) => {
      if (!saved) {
        toast.error("Couldn't save the board.");
        setBoards((prev) => prev.filter((b) => b.id !== record.id));
        return;
      }
      setBoards((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      openRecord(saved.id);
    });
  };

  // The builder owns the config and hands back the whole bag, because `toRow`
  // replaces `config` wholesale rather than merging it.
  const handlePersist = (boardId) => (config) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === boardId ? { ...b, config } : b)),
    );
    conferenceApi
      .update(boardId, {
        config,
        status: config.published ? "Published" : "Draft",
      })
      .then((saved) => {
        if (!saved) toast.error("Couldn't save your changes.");
      });
  };

  const handleDelete = (board) => {
    setBoards((prev) => prev.filter((b) => b.id !== board.id));
    if (recordId === board.id) closeRecord();
    toast.success(`Deleted "${board.name}".`);
    conferenceApi.remove(board.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete the board.");
    });
  };

  const handleDuplicate = (board) => {
    const copy = {
      ...board,
      id: crypto.randomUUID(),
      name: `${board.name} copy`,
      // A duplicate starts unpublished so it can't quietly take over a screen.
      config: { ...board.config, published: false },
      createdBy: userId,
      projectId,
    };
    setBoards((prev) => [copy, ...prev]);
    toast.success("Board duplicated.");
    conferenceApi.create(copy).then((saved) => {
      if (!saved) {
        toast.error("Couldn't duplicate the board.");
        setBoards((prev) => prev.filter((b) => b.id !== copy.id));
      }
    });
  };

  const copyUrl = (board) => {
    if (board.config?.published !== true) {
      toast.error("Publish the board first — the link only works once it's live.");
      return;
    }
    navigator.clipboard.writeText(`${window.location.origin}/display/${board.id}`);
    toast.success("Live board URL copied.");
  };

  if (openBoard) {
    const event = eventsById.get(openBoard.config?.eventId) || null;
    return (
      <BoardBuilder
        board={openBoard}
        event={event}
        sessions={sessions.filter((s) => s.config?.eventId === openBoard.config?.eventId)}
        onBack={closeRecord}
        onPersist={handlePersist(openBoard.id)}
        onDelete={handleDelete}
      />
    );
  }

  const hasFilters = search || statusFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Display Boards"
        description="Craft what the venue's screens show — a rotating queue of schedule slides you build on a canvas, live at a URL and downloadable as a video."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
            disabled={!events.length}
          >
            <Plus className="h-4 w-4" /> New board
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {boards.length > 0 ? (
        <Toolbar>
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search boards…"
          />
        </Toolbar>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading boards…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MonitorPlay}
            title={
              boards.length
                ? "No boards match your filters"
                : events.length
                  ? "No display boards yet"
                  : "No events yet"
            }
            description={
              boards.length
                ? "Try clearing the search or status filter."
                : events.length
                  ? "Create a board to drive the lobby screen, a door display, or an exported billboard video."
                  : "Create an event under All Events, build its agenda, then give it a board here."
            }
            action={
              boards.length && hasFilters ? (
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : events.length ? (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" /> New board
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((board) => {
            const event = eventsById.get(board.config?.eventId);
            const published = board.config?.published === true;
            const slideCount = board.config?.slides?.length || 0;
            return (
              <div
                key={board.id}
                role="button"
                tabIndex={0}
                onClick={() => openRecord(board.id)}
                onKeyDown={(e) => e.key === "Enter" && openRecord(board.id)}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                  <MonitorPlay className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {board.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {[
                      event?.name || "Event removed",
                      event?.date ? formatDate(event.date) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusPill
                  status={published ? "Published" : "Draft"}
                  map={BOARD_STATUS_MAP}
                />
                <span className="hidden w-20 shrink-0 text-right text-xs font-medium text-text-secondary sm:block">
                  {slideCount} slide{slideCount === 1 ? "" : "s"}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Board actions"
                        className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border-border bg-surface-card shadow-xl"
                    >
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                        onClick={() => openRecord(board.id)}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                        onClick={() => handleDuplicate(board)}
                      >
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                        onClick={() => copyUrl(board)}
                      >
                        <MonitorPlay className="h-4 w-4" /> Copy live URL
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-surface-strong" />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                        onClick={() => setDeleteTarget(board)}
                      >
                        <Trash2 className="h-4 w-4 text-red-300" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateBoardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        events={events}
        onCreate={handleCreate}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Any screen showing its live URL will go blank. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default DisplayBoardsScreen;
