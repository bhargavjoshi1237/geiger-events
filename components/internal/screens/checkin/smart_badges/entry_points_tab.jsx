"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Info, Loader2, Pencil, Plus, Radio } from "lucide-react";

import { DataTable, EmptyState, Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LogoLoading } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { conferenceApi } from "@/lib/supabase/conference";
import { listBoothAssignments } from "@/lib/supabase/expo";
import { createEntryPoint, updateEntryPoint } from "@/lib/supabase/nfc";
import { NFC_BILLING_MODES, formatMoney, genDeviceKey } from "../constants";
import { PURPOSE_MAP, PURPOSE_OPTIONS } from "./constants";

// Sessions a point can check people into: the event's agenda plus its Check-in → Sessions list.
function sessionOptions(agenda, event) {
  const agendaOpts = (agenda || [])
    .filter((s) => s.config?.eventId === event?.id)
    .map((s) => ({
      value: `agenda:${s.id}`,
      id: s.id,
      name: s.name || "Untitled session",
      meta: [s.config?.day, s.config?.startTime, s.config?.room].filter(Boolean).join(" · "),
    }));
  const checkinOpts = (event?.checkinSessions?.sessions || []).map((s) => ({
    value: `checkin:${s.id}`,
    id: String(s.id),
    name: s.name || "Untitled session",
    meta: "Check-in session",
  }));
  return { agendaOpts, checkinOpts };
}

function exhibitorOptions(sponsors, booths) {
  const sponsorOpts = (sponsors || []).map((s) => ({ value: `sponsor:${s.id}`, kind: "sponsor", id: s.id, name: s.name || "Sponsor" }));
  const boothOpts = (booths || [])
    .filter((a) => a.exhibitorName && a.status !== "blocked")
    .map((a) => ({
      value: `booth:${a.id}`,
      kind: "booth",
      id: a.id,
      name: a.exhibitorName,
      meta: a.label,
    }));
  return { sponsorOpts, boothOpts };
}

function linkLabel(point) {
  if (point.purpose === "session") return point.sessionName || "No session linked";
  if (point.purpose === "lead") return point.exhibitorName || "No exhibitor linked";
  if (point.purpose === "gate" || point.purpose === "payment") {
    if (point.billingMode === "free" || !point.amountCents) return point.purpose === "gate" ? "Free entry" : "No price set";
    const mode = NFC_BILLING_MODES.find((m) => m.value === point.billingMode)?.label || point.billingMode;
    return `${formatMoney(point.amountCents, point.currency)} · ${mode}`;
  }
  return "Logs taps only";
}

function PointDialogBody({ initial, sessions, exhibitors, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [purpose, setPurpose] = useState(initial?.purpose || "gate");
  const allSessions = [...sessions.agendaOpts, ...sessions.checkinOpts];
  const allExhibitors = [...exhibitors.sponsorOpts, ...exhibitors.boothOpts];
  const [sessionValue, setSessionValue] = useState(
    () => allSessions.find((s) => s.id === initial?.sessionId)?.value || "",
  );
  const [exhibitorValue, setExhibitorValue] = useState(() => {
    if (!initial?.exhibitorName) return "";
    const hit = allExhibitors.find((x) => x.id === initial.exhibitorId);
    return hit ? hit.value : "custom";
  });
  const [customExhibitor, setCustomExhibitor] = useState(
    initial?.exhibitorKind === "custom" || (initial?.exhibitorName && !initial?.exhibitorId) ? initial.exhibitorName : "",
  );
  const [saving, setSaving] = useState(false);

  const hint = PURPOSE_OPTIONS.find((p) => p.value === purpose)?.hint;

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the point a name.");
      return;
    }
    const patch = { name: name.trim(), location: location.trim(), purpose };
    if (purpose === "session") {
      const s = allSessions.find((x) => x.value === sessionValue);
      if (!s) {
        toast.error("Pick the session this reader checks people into.");
        return;
      }
      patch.sessionId = s.id;
      patch.sessionName = s.name;
    }
    if (purpose === "lead") {
      if (exhibitorValue === "custom") {
        if (!customExhibitor.trim()) {
          toast.error("Name the exhibitor collecting these leads.");
          return;
        }
        patch.exhibitorKind = "custom";
        patch.exhibitorId = null;
        patch.exhibitorName = customExhibitor.trim();
      } else {
        const x = allExhibitors.find((e) => e.value === exhibitorValue);
        if (!x) {
          toast.error("Pick the exhibitor collecting these leads.");
          return;
        }
        patch.exhibitorKind = x.kind;
        patch.exhibitorId = x.id;
        patch.exhibitorName = x.name;
      }
    }
    setSaving(true);
    await onSave(patch);
    setSaving(false);
  };

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hall B doors" className="bg-surface-card" />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Level 1, east" className="bg-surface-card" />
          </Field>
        </div>
        <Field label="Purpose">
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger className="bg-surface-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSE_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-text-tertiary">{hint}</p>
        </Field>

        {purpose === "session" ? (
          <Field label="Session">
            {allSessions.length ? (
              <Select value={sessionValue} onValueChange={setSessionValue}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Pick a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.agendaOpts.length ? (
                    <SelectGroup>
                      <SelectLabel>Agenda</SelectLabel>
                      {sessions.agendaOpts.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.name}
                          {s.meta ? <span className="text-text-tertiary"> · {s.meta}</span> : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {sessions.checkinOpts.length ? (
                    <SelectGroup>
                      <SelectLabel>Check-in sessions</SelectLabel>
                      {sessions.checkinOpts.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-3 py-2.5 text-xs text-text-secondary">
                This event has no sessions yet. Add them in Conference → Agenda Builder or the event&apos;s Check-in →
                Sessions tab.
              </p>
            )}
          </Field>
        ) : null}

        {purpose === "lead" ? (
          <>
            <Field label="Exhibitor">
              <Select value={exhibitorValue} onValueChange={setExhibitorValue}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Pick who collects the leads" />
                </SelectTrigger>
                <SelectContent>
                  {exhibitors.boothOpts.length ? (
                    <SelectGroup>
                      <SelectLabel>Booth exhibitors</SelectLabel>
                      {exhibitors.boothOpts.map((x) => (
                        <SelectItem key={x.value} value={x.value}>
                          {x.name}
                          {x.meta ? <span className="text-text-tertiary"> · {x.meta}</span> : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {exhibitors.sponsorOpts.length ? (
                    <SelectGroup>
                      <SelectLabel>Sponsors</SelectLabel>
                      {exhibitors.sponsorOpts.map((x) => (
                        <SelectItem key={x.value} value={x.value}>
                          {x.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    <SelectItem value="custom">Someone else…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {exhibitorValue === "custom" ? (
              <Field label="Exhibitor name">
                <Input
                  value={customExhibitor}
                  onChange={(e) => setCustomExhibitor(e.target.value)}
                  placeholder="e.g. Northwind Labs"
                  className="bg-surface-card"
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {purpose === "payment" || purpose === "gate" ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-xs text-text-secondary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            Prices and billing modes are set in Check-in → RFID / NFC.
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {initial ? "Save" : "Create point"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EntryPointsTab({ eventId, projectId, event, points, userId, loading, onChanged, onOpenRfid }) {
  const [refs, setRefs] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      conferenceApi.list(projectId, "session"),
      conferenceApi.list(projectId, "sponsor"),
      listBoothAssignments(eventId),
    ]).then(([agenda, sponsors, booths]) => {
      if (alive) setRefs({ agenda: agenda ?? [], sponsors: sponsors ?? [], booths: booths ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [projectId, eventId]);

  const sessions = useMemo(() => sessionOptions(refs?.agenda, event), [refs, event]);
  const exhibitors = useMemo(() => exhibitorOptions(refs?.sponsors, refs?.booths), [refs]);

  const save = async (patch) => {
    if (editing?.point) {
      const saved = await updateEntryPoint(editing.point.id, patch);
      if (!saved) {
        toast.error("Couldn't save the point.");
        return;
      }
      toast.success("Entry point saved.");
    } else {
      const saved = await createEntryPoint({
        id: crypto.randomUUID(),
        projectId,
        eventId,
        deviceKey: genDeviceKey(),
        createdBy: userId,
        billingMode: patch.purpose === "payment" ? "paid_every_tap" : "free",
        amountCents: 0,
        currency: "usd",
        active: true,
        ...patch,
      });
      if (!saved) {
        toast.error("Couldn't create the point.");
        return;
      }
      toast.success(
        patch.purpose === "payment"
          ? "Point created — set its price in RFID / NFC, then copy the device key onto the reader."
          : "Point created — copy its device key onto the reader.",
      );
    }
    setEditing(null);
    onChanged();
  };

  const copyKey = async (point) => {
    try {
      await navigator.clipboard.writeText(point.deviceKey);
      toast.success("Device key copied — paste it onto the reader.");
    } catch {
      toast.error("Couldn't copy — open RFID / NFC to reveal the key.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Point",
      className: "w-full",
      headClassName: "w-full",
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{p.name}</p>
          <p className="truncate text-xs text-text-secondary">{p.location || "No location"}</p>
        </div>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (p) => <StatusPill status={p.purpose} map={PURPOSE_MAP} />,
    },
    {
      key: "link",
      header: "Does",
      className: "max-w-[260px] truncate text-sm text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (p) => linkLabel(p),
    },
    {
      key: "state",
      header: "State",
      className: "whitespace-nowrap text-sm",
      headClassName: "whitespace-nowrap",
      render: (p) => (p.active ? "Live" : <span className="text-text-tertiary">Inactive</span>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (p) => (
        <ActionMenu
          label={`Actions for ${p.name}`}
          items={[
            { icon: Pencil, label: "Edit purpose", onSelect: () => setEditing({ point: p }) },
            { icon: Copy, label: "Copy device key", disabled: !p.deviceKey, onSelect: () => copyKey(p) },
            { separator: true },
            { icon: ExternalLink, label: "Prices & keys in RFID / NFC", onSelect: onOpenRfid },
          ]}
        />
      ),
    },
  ];

  const ghost = "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">
          Each reader does one job when a badge taps it. Readers authenticate with their point&apos;s device key; the
          hardware contract is unchanged, so existing readers keep working.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={ghost} onClick={onOpenRfid}>
            <Radio className="h-4 w-4" /> RFID / NFC
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!eventId || !refs}
            onClick={() => setEditing({ point: null })}
          >
            <Plus className="h-4 w-4" /> New point
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} label="Loading entry points" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={points}
          getRowKey={(p) => p.id}
          onRowClick={(p) => setEditing({ point: p })}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Radio}
                title="No readers on this event"
                description="Add a point for each reader — a door, a session room, an exhibitor's stand or a bar."
              />
            </div>
          }
        />
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.point ? "Edit entry point" : "New entry point"}</DialogTitle>
            <DialogDescription>Choose what a badge tap on this reader does.</DialogDescription>
          </DialogHeader>
          {editing && refs ? (
            <PointDialogBody
              key={editing.point?.id || "new"}
              initial={editing.point}
              sessions={sessions}
              exhibitors={exhibitors}
              onSave={save}
              onClose={() => setEditing(null)}
            />
          ) : editing ? (
            <div className="flex items-center justify-center py-8">
              <LogoLoading size={40} label="Loading sessions and exhibitors" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EntryPointsTab;
