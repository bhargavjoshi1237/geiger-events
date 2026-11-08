"use client";

import React, { useMemo, useState } from "react";
import { Eye, EyeOff, Store, UserRound, Users } from "lucide-react";

import { DataTable, EmptyState, Field, SearchInput, StatusPill, Toolbar } from "@/components/internal/shared/screen_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { DIRECTORY_FILTER_OPTIONS, PROFILE_STATUS_MAP, ROLE_FILTER_OPTIONS, profileStatus } from "./constants";
import { PersonAvatar } from "./meeting_dialogs";

function Tags({ list }) {
  if (!list?.length) return <span className="text-text-tertiary">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, 3).map((t) => (
        <Badge key={t} variant="neutral">
          {t}
        </Badge>
      ))}
      {list.length > 3 ? <span className="text-xs text-text-tertiary">+{list.length - 3}</span> : null}
    </div>
  );
}

// Networking profiles: who opted in, their role, and moderation (hide abusive profiles).
export function DirectoryTab({ tabs, profiles, people, meetings, onUpdateProfile }) {
  const [status, setStatus] = useState("opted_in");
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const [hiding, setHiding] = useState(null);
  const [reason, setReason] = useState("");

  const meetingCount = useMemo(() => {
    const counts = new Map();
    for (const m of meetings) {
      if (m.status === "cancelled") continue;
      for (const id of m.participants) counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((p) => (status === "all" ? true : profileStatus(p) === status))
      .filter((p) => (role === "all" ? true : p.role === role))
      .filter((p) =>
        !q
          ? true
          : `${p.displayName} ${p.company} ${p.title} ${p.email} ${p.interests.join(" ")}`.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  }, [profiles, status, role, search]);

  const columns = [
    {
      key: "person",
      header: "Person",
      render: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={p.displayName || p.email} url={p.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{p.displayName || p.email || "Attendee"}</p>
            <p className="truncate text-xs text-text-secondary">
              {[p.title, p.company].filter(Boolean).join(" at ") || p.email}
            </p>
          </div>
          {!people.get(p.memberId)?.hasTicket ? (
            <Badge variant="warning" className="shrink-0">
              No ticket
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (p) => (
        <Badge variant={p.role === "exhibitor" ? "purple" : "neutral"}>
          {p.role === "exhibitor" ? "Exhibitor" : "Attendee"}
        </Badge>
      ),
    },
    { key: "interests", header: "Interests", render: (p) => <Tags list={p.interests} /> },
    {
      key: "meetings",
      header: "Meetings",
      align: "right",
      className: "text-right tabular-nums text-foreground",
      render: (p) => meetingCount.get(p.memberId) || 0,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusPill status={profileStatus(p)} map={PROFILE_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (p) => (
        <ActionMenu
          label={`Actions for ${p.displayName || p.email}`}
          items={[
            p.role === "exhibitor"
              ? { icon: UserRound, label: "Make attendee", onSelect: () => onUpdateProfile(p, { role: "attendee" }) }
              : { icon: Store, label: "Make exhibitor", onSelect: () => onUpdateProfile(p, { role: "exhibitor" }) },
            { separator: true },
            p.hidden
              ? { icon: Eye, label: "Unhide", onSelect: () => onUpdateProfile(p, { hidden: false, hiddenReason: "" }) }
              : {
                  icon: EyeOff,
                  label: "Hide profile",
                  destructive: true,
                  onSelect: () => {
                    setReason("");
                    setHiding(p);
                  },
                },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Toolbar>
        {tabs}
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full sm:justify-end">
          <FilterDropdown value={status} onValueChange={setStatus} options={DIRECTORY_FILTER_OPTIONS} height="h-9" />
          <FilterDropdown value={role} onValueChange={setRole} options={ROLE_FILTER_OPTIONS} height="h-9" />
          <SearchInput value={search} onChange={setSearch} placeholder="Search names, companies, interests…" />
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(p) => p.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Users}
              title={profiles.length ? "No profiles match your filters" : "No networking profiles yet"}
              description={
                profiles.length
                  ? "Try another status, role or search."
                  : "Attendees create a profile when they join networking from the members portal."
              }
            />
          </div>
        }
      />

      <Dialog open={Boolean(hiding)} onOpenChange={(o) => !o && setHiding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hide profile</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{hiding?.displayName || hiding?.email}</span> leaves the
              directory and can&apos;t send new requests. Meetings already booked stay booked.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" hint="For your team only.">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Spamming requests" />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHiding(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                onUpdateProfile(hiding, { hidden: true, hiddenReason: reason.trim() });
                setHiding(null);
              }}
            >
              <EyeOff className="h-4 w-4" /> Hide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DirectoryTab;
