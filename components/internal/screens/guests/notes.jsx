"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, StickyNote } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SearchInput,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { listAllNotes, listContacts, updateContact } from "@/lib/supabase/contacts";
import { getUser } from "@/lib/supabase/user";
import { formatDate, initials } from "./constants";
import { ContactDrawer } from "./contact_drawer";

export function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [contactsById, setContactsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openContact, setOpenContact] = useState(null);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const hay = `${n.body} ${n.contactName} ${n.contactEmail}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search]);

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

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Notes"
        description="Every note left on a contact, in one feed. Search across notes, or open a contact to add and edit theirs."
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <div />
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
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openForContact(n.contactId)}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
                {initials(n.contactName, n.contactEmail) || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {n.contactName || n.contactEmail || "Unknown contact"}
                  </p>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                  {n.body || "—"}
                </p>
              </div>
            </button>
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
