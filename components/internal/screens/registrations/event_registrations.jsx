"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Download,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import {
  DataTable,
  EmptyState,
  SearchInput,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  REGISTRATION_STATUS_MAP,
  SOURCE_MAP,
  EVENT_TYPE_MAP_LITE,
  formatDate,
  formatDateTime,
  initials,
} from "./constants";
import { countRegs, PipelineBar, PipelineChips } from "./pipeline";
import {
  RegistrationDrawer,
  AddRegistrantDialog,
  RemoveRegistrationDialog,
} from "./registration_drawer";
import { downloadCsv } from "./csv";

const PAGE_ROWS = 100;

export function EventRegistrationsDetail({
  event,
  regs,
  eventNames,
  onBack,
  onStatusChange,
  onBulkStatus,
  onDelete,
  onCreate,
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_ROWS);
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const counts = useMemo(() => countRegs(regs), [regs]);

  const tabs = [
    { key: "all", label: "All", count: regs.length },
    { key: "Pending", label: "Pending", count: counts.Pending },
    { key: "Confirmed", label: "Confirmed", count: counts.Confirmed },
    { key: "Waitlisted", label: "Waitlist", count: counts.Waitlisted },
    { key: "Checked-in", label: "Checked in", count: counts["Checked-in"] },
  ];

  const filtered = useMemo(() => {
    return regs.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (
        search &&
        !`${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [regs, tab, search]);

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const selectedVisible = useMemo(
    () => [...selected].filter((id) => visibleIds.includes(id)),
    [selected, visibleIds],
  );
  const allSelected =
    filtered.length > 0 && selectedVisible.length === filtered.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  const toggleOne = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = (status) => {
    onBulkStatus(selectedVisible, status);
    setSelected(new Set());
  };

  const handleBulk = async (status) => {
    setBulkBusy(true);
    try {
      await Promise.resolve(runBulk(status));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("Nothing to export here.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Status", value: (r) => r.status },
        { header: "Source", value: (r) => r.source },
        { header: "Party", value: (r) => r.partySize },
        { header: "Dietary", value: (r) => r.dietary },
        { header: "Accessibility", value: (r) => r.accessibility },
        { header: "Registered", value: (r) => formatDateTime(r.createdAt) },
      ],
      filtered,
      `${event.name.replace(/\s+/g, "-").toLowerCase()}-registrations.csv`,
    );
    toast.success(`Exported ${filtered.length} registrations.`);
  };

  const selectedReg = regs.find((r) => r.id === openId) || null;

  const columns = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all"
        />
      ),
      className: "w-10",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected.has(r.id)}
            onCheckedChange={() => toggleOne(r.id)}
            aria-label={`Select ${r.name}`}
          />
        </div>
      ),
    },
    {
      key: "name",
      header: "Registrant",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
            {initials(r.name) || "?"}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{r.name || "Unnamed"}</span>
            <span className="text-xs text-text-secondary">{r.email || "No email"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusPill status={r.status} map={REGISTRATION_STATUS_MAP} />
          {r.status === "Waitlisted" && r.waitlistPosition ? (
            <span className="text-xs text-text-tertiary">#{r.waitlistPosition}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (r) => (
        <Badge variant={SOURCE_MAP[r.source]?.variant || "neutral"}>{r.source}</Badge>
      ),
    },
    {
      key: "party",
      header: "Party",
      align: "right",
      className: "text-right tabular-nums",
      render: (r) =>
        r.plusOnes?.length ? `${r.partySize} (+${r.plusOnes.length})` : r.partySize,
    },
    {
      key: "registered",
      header: "Registered",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {r.status === "Pending" ? (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onStatusChange(r, "Confirmed")}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
          ) : null}
          {r.status === "Waitlisted" ? (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onStatusChange(r, "Confirmed")}
            >
              <ArrowUp className="h-4 w-4" /> Promote
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-subtle"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setOpenId(r.id)}
              >
                View details
              </DropdownMenuItem>
              {r.status === "Confirmed" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => onStatusChange(r, "Checked-in")}
                >
                  <Check className="h-4 w-4" /> Check in
                </DropdownMenuItem>
              ) : null}
              {r.status !== "Waitlisted" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => onStatusChange(r, "Waitlisted")}
                >
                  <ArrowUp className="h-4 w-4 rotate-180" /> Move to waitlist
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const cap = event.capacity || 0;
  const typeVariant = EVENT_TYPE_MAP_LITE[event.type] || "neutral";

  return (
    <MainScreenWrapper>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" /> All Events
      </Button>

      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {event.name}
              </h1>
              <Badge variant={typeVariant}>{event.type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(event.date)}
              {event.venue ? ` · ${event.venue}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Add registrant
            </Button>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground tabular-nums">
              {counts.seats}
              <span className="text-text-secondary">
                {" "}/ {cap || "∞"} seats filled
              </span>
            </span>
            <PipelineChips counts={counts} />
          </div>
          <PipelineBar counts={counts} capacity={cap} size="lg" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setLimit(PAGE_ROWS);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-surface-hover text-foreground"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "text-xs tabular-nums",
                tab === t.key ? "text-text-secondary" : "text-text-tertiary",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
        </div>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setLimit(PAGE_ROWS);
          }}
          placeholder="Search name or email…"
        />
      </div>

      {selectedVisible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {selectedVisible.length} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={bulkBusy}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleBulk("Confirmed")}
            >
              {bulkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => handleBulk("Waitlisted")}
            >
              <ArrowUp className="h-4 w-4 rotate-180" /> Waitlist
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkBusy}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filtered.slice(0, limit)}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={UserPlus}
              title={
                tab === "all"
                  ? "No registrations yet"
                  : `No ${tabs.find((t) => t.key === tab)?.label.toLowerCase()} Registrations`
              }
              description={
                tab === "all"
                  ? "Registrations from this event's page land here. You can also add one by hand."
                  : "Nothing in this stage right now."
              }
              action={
                tab === "all" ? (
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setAddOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" /> Add registrant
                  </Button>
                ) : null
              }
            />
          </div>
        }
      />

      {filtered.length > limit ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setLimit((l) => l + PAGE_ROWS)}
          >
            Show more ({filtered.length - limit} left)
          </Button>
        </div>
      ) : null}

      <RegistrationDrawer
        reg={selectedReg}
        eventName={eventNames[event.id]}
        onStatusChange={onStatusChange}
        onDelete={(r) => setDeleteTarget(r)}
        onClose={() => setOpenId(null)}
      />

      <AddRegistrantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        events={[event]}
        fixedEvent={event}
        onCreate={onCreate}
      />

      <RemoveRegistrationDialog
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(r) => {
          onDelete(r);
          setDeleteTarget(null);
          setOpenId(null);
        }}
      />
    </MainScreenWrapper>
  );
}

export default EventRegistrationsDetail;
