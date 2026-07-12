"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, StickyNote, Trash2, User2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listAllNotes, listContacts, updateContact } from "@/lib/supabase/contacts";
import { getUser } from "@/lib/supabase/user";
import { formatDate, formatDateTime, initials } from "./constants";
import { ContactDrawer } from "./contact_drawer";

const NOTE_SORT_OPTIONS = [
  { value: "recent", label: "Recently noted" },
  { value: "oldest", label: "Oldest first" },
  { value: "most", label: "Most notes" },
  { value: "name", label: "Name (A–Z)" },
];

export function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [contactsById, setContactsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [openContact, setOpenContact] = useState(null);
  const [openPerson, setOpenPerson] = useState(null);
  const [deleteAllTarget, setDeleteAllTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  const load = () => listAllNotes(projectId).then((n) => setNotes(n ?? []));

  useEffect(() => {
    let alive = true;
    Promise.all([listAllNotes(projectId), listContacts(projectId)]).then(
      ([ns, cs]) => {
        if (!alive) return;
        setNotes(ns ?? []);
        const map = {};
        for (const c of cs ?? []) map[c.id] = c;
        setContactsById(map);
        setLoading(false);
      },
    );
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  // One entry per contact, carrying all their notes (newest first).
  const people = useMemo(() => {
    const map = new Map();
    for (const n of notes) {
      let p = map.get(n.contactId);
      if (!p) {
        p = {
          contactId: n.contactId,
          contactName: n.contactName,
          contactEmail: n.contactEmail,
          notes: [],
          latestAt: "",
        };
        map.set(n.contactId, p);
      }
      p.notes.push(n);
      if (!p.latestAt || (n.createdAt && n.createdAt > p.latestAt))
        p.latestAt = n.createdAt || p.latestAt;
    }
    for (const p of map.values())
      p.notes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return Array.from(map.values());
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? people.filter((p) => {
          const hay = `${p.contactName} ${p.contactEmail} ${p.notes
            .map((n) => n.body)
            .join(" ")}`.toLowerCase();
          return hay.includes(q);
        })
      : [...people];
    const byName = (a, b) =>
      (a.contactName || a.contactEmail || "").localeCompare(
        b.contactName || b.contactEmail || "",
      );
    list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (a.latestAt || "").localeCompare(b.latestAt || "");
        case "most":
          return b.notes.length - a.notes.length || byName(a, b);
        case "name":
          return byName(a, b);
        case "recent":
        default:
          return (b.latestAt || "").localeCompare(a.latestAt || "");
      }
    });
    return list;
  }, [people, search, sort]);

  const stats = useMemo(() => {
    const people = new Set(notes.map((n) => n.contactId));
    const latest = notes.reduce(
      (max, n) => (n.createdAt && n.createdAt > max ? n.createdAt : max),
      "",
    );
    return [
      { label: "Notes", value: notes.length.toLocaleString() },
      { label: "Contacts with notes", value: people.size.toLocaleString() },
      { label: "Latest", value: latest ? formatDate(latest) : "—" },
    ];
  }, [notes]);

  const openForContact = (contactId) => {
    const c = contactsById[contactId];
    if (!c) {
      toast.message("This contact is no longer available.");
      return;
    }
    setOpenContact(c);
  };

  // Persist a drawer edit, mirror it into the local contact, then re-read the
  // feed so note changes surface immediately.
  const handlePatch = (id, patch) => {
    setOpenContact((c) => (c && c.id === id ? { ...c, ...patch } : c));
    setContactsById((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev,
    );
    updateContact(id, patch).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the change.");
      else load();
    });
  };

  // Delete a single note from a contact and reflect it in the open sheet.
  const handleDeleteNote = (contactId, noteId) => {
    const contact = contactsById[contactId];
    const current = contact?.notes || openPerson?.notes || [];
    const nextNotes = current.filter((x) => x.id !== noteId);
    handlePatch(contactId, {
      metadata: { ...(contact?.metadata || {}), notes: nextNotes },
    });
    setOpenPerson((p) => {
      if (!p || p.contactId !== contactId) return p;
      const remaining = p.notes.filter((x) => x.id !== noteId);
      return remaining.length ? { ...p, notes: remaining } : null;
    });
    toast.success("Note deleted.");
  };

  // Clear every note on a contact.
  const handleDeleteAllNotes = (person) => {
    const contact = contactsById[person.contactId];
    handlePatch(person.contactId, {
      metadata: { ...(contact?.metadata || {}), notes: [] },
    });
    setOpenPerson((p) => (p && p.contactId === person.contactId ? null : p));
    toast.success("All notes deleted.");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Notes"
        description="Every note left on a contact, in one feed. Search across notes, or open a contact to add and edit theirs."
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <FilterDropdown
          value={sort}
          onValueChange={setSort}
          options={NOTE_SORT_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search notes or people…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
        </div>
      ) : filtered.length ? (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.contactId}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 transition-colors hover:bg-surface-hover"
            >
              <button
                type="button"
                onClick={() => setOpenPerson(p)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
                  {initials(p.contactName, p.contactEmail) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.contactName || p.contactEmail || "Unknown contact"}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-text-secondary">
                    {p.notes[0]?.body || "—"}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {p.notes.length} {p.notes.length === 1 ? "note" : "notes"}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-text-tertiary">
                  {formatDate(p.latestAt)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Note actions"
                      className="h-8 w-8 shrink-0 text-text-secondary hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-border bg-surface-subtle text-foreground"
                  >
                    <DropdownMenuItem
                      className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                      onClick={() => setDeleteAllTarget(p)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete all notes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={StickyNote}
            title={search.trim() ? "No notes match" : "No notes yet"}
            description={
              search.trim()
                ? "Try a different search."
                : "Open a contact from the Contact Book or Guest List to leave your first note — it'll show up here."
            }
            action={
              search.trim() ? (
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              ) : null
            }
          />
        </div>
      )}

      {/* Per-contact notes sheet — lists every note left on that contact. */}
      <Sheet open={!!openPerson} onOpenChange={(o) => !o && setOpenPerson(null)}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          {openPerson ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border">
                <div className="flex items-center gap-3 pr-8">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-sm font-semibold text-foreground">
                    {initials(openPerson.contactName, openPerson.contactEmail) ||
                      "?"}
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate">
                      {openPerson.contactName ||
                        openPerson.contactEmail ||
                        "Unknown contact"}
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {openPerson.notes.length}{" "}
                      {openPerson.notes.length === 1 ? "Note" : "Notes"}
                      {openPerson.contactEmail
                        ? ` · ${openPerson.contactEmail}`
                        : ""}
                    </SheetDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Open profile"
                    className="ml-auto shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => {
                      const id = openPerson.contactId;
                      setOpenPerson(null);
                      openForContact(id);
                    }}
                  >
                    <User2 className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>


              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {openPerson.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-border bg-surface-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground">
                        {n.body || "—"}
                      </p>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete note"
                        className="-mr-1 shrink-0 text-text-tertiary hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => handleDeleteNote(openPerson.contactId, n.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-text-tertiary">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!deleteAllTarget}
        onOpenChange={(o) => !o && setDeleteAllTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all notes</DialogTitle>
            <DialogDescription>
              Delete all {deleteAllTarget?.notes.length}{" "}
              {deleteAllTarget?.notes.length === 1 ? "note" : "notes"} on{" "}
              <span className="font-medium text-foreground">
                {deleteAllTarget?.contactName ||
                  deleteAllTarget?.contactEmail ||
                  "this contact"}
              </span>
              ? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteAllTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleDeleteAllNotes(deleteAllTarget);
                setDeleteAllTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactDrawer
        contact={openContact}
        projectId={projectId}
        userId={userId}
        attendedEvents={[]}
        onPatch={handlePatch}
        onDelete={() => {
          toast.message("Delete contacts from the Contact Book.");
          setOpenContact(null);
        }}
        onClose={() => setOpenContact(null)}
      />
    </MainScreenWrapper>
  );
}

export default NotesScreen;
