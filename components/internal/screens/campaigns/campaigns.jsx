"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Copy,
  Info,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  softDeleteCampaign,
  listAssets,
} from "@/lib/supabase/campaigns";
import { listSegments, isSegmentMember } from "@/lib/supabase/segments";
import { listContacts, listGuests } from "@/lib/supabase/contacts";
import {
  CAMPAIGN_STATUS_MAP,
  CHANNEL_FILTER_OPTIONS,
  CHANNEL_MAP,
  CHANNEL_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_MAP,
  TYPE_OPTIONS,
  defaultAb,
  defaultContent,
  defaultMetrics,
  formatDateTime,
} from "./constants";
import { CampaignEditor } from "./campaign_editor";

// --- Create dialog -----------------------------------------------------------

function CreateCampaignDialog({ open, onOpenChange, preset, onCreate }) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(preset?.channel || "email");
  const [type, setType] = useState(preset?.type || "newsletter");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setChannel(preset?.channel || "email");
      setType(preset?.type || "newsletter");
    }
  }

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give the campaign a name.");
      return;
    }
    onCreate(name.trim(), channel, type);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Name it and pick a channel — you&apos;ll write the content and set the
            audience on the next screen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="camp-name">
            <Input
              id="camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. June newsletter"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <Select value={channel} onValueChange={setChannel} disabled={preset?.lockChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Campaign card -----------------------------------------------------------

function scheduleLine(c) {
  if (c.status === "sent") return c.sentAt ? `Sent ${formatDateTime(c.sentAt)}` : "Sent";
  if (c.status === "scheduled" && c.scheduledAt)
    return `Scheduled for ${formatDateTime(c.scheduledAt)}`;
  return "Not scheduled";
}

function CampaignCard({ campaign, segmentName, recipients, onOpen, onDuplicate, onDelete }) {
  const ch = CHANNEL_MAP[campaign.channel] || CHANNEL_MAP.email;
  const Icon = ch.icon;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{campaign.name}</span>
          <StatusPill status={campaign.status} map={CAMPAIGN_STATUS_MAP} />
          <Badge variant={TYPE_MAP[campaign.type]?.variant || "neutral"}>
            {TYPE_MAP[campaign.type]?.label || campaign.type}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {segmentName}
          </span>
          <span className="tabular-nums">{recipients.toLocaleString()} recipients</span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> {scheduleLine(campaign)}
          </span>
        </p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              aria-label="Campaign actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 border-border bg-surface-card shadow-xl">
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={onOpen}
            >
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
              onClick={onDuplicate}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-surface-strong" />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-red-300" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// --- Screen (hub + lens) -----------------------------------------------------

// `preset` turns the hub into a filtered lens (see LENS in constants). Without
// it, this is the full Campaigns hub.
export function CampaignsScreen({ preset }) {
  const { projectId } = useProject();
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [ctx, setCtx] = useState({ attendingEmails: new Set(), eventsByEmail: new Map() });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listCampaigns(projectId),
      listSegments(projectId),
      listContacts(projectId),
      listGuests(projectId),
      listAssets(projectId, "template"),
    ]).then(([camps, segs, cs, guests, tpls]) => {
      if (!alive) return;
      setCampaigns(camps ?? []);
      setSegments(segs ?? []);
      setContacts(cs ?? []);
      setTemplates(tpls ?? []);
      const emails = new Set();
      const byEmail = new Map();
      for (const g of guests ?? []) {
        const key = String(g.email || "").toLowerCase();
        if (!key) continue;
        emails.add(key);
        byEmail.set(key, g.eventIds || []);
      }
      setCtx({ attendingEmails: emails, eventsByEmail: byEmail });
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const segmentById = useMemo(
    () => Object.fromEntries(segments.map((s) => [s.id, s])),
    [segments],
  );

  const estimateRecipients = useCallback(
    (segmentId) => {
      if (!segmentId) return contacts.length;
      const seg = segmentById[segmentId];
      if (!seg) return 0;
      return contacts.filter((c) => isSegmentMember(seg, c, ctx)).length;
    },
    [contacts, segmentById, ctx],
  );

  const segmentName = (segmentId) =>
    segmentId ? segmentById[segmentId]?.name || "Segment" : "All contacts";

  // Base list narrowed by the lens preset.
  const presetList = useMemo(() => {
    let rows = campaigns;
    if (preset?.channel) rows = rows.filter((c) => c.channel === preset.channel);
    if (preset?.type) rows = rows.filter((c) => c.type === preset.type);
    if (preset?.abOnly) rows = rows.filter((c) => c.ab?.enabled);
    if (preset?.scheduledOnly) {
      rows = rows
        .filter((c) => c.status === "scheduled" && c.scheduledAt)
        .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
    }
    return rows;
  }, [campaigns, preset]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presetList.filter((c) => {
      if (q && !(c.name || "").toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      return true;
    });
  }, [presetList, search, statusFilter, channelFilter]);

  const stats = useMemo(() => {
    const scheduled = presetList.filter((c) => c.status === "scheduled").length;
    const sent = presetList.filter((c) => c.status === "sent");
    const reached = sent.reduce((s, c) => s + (Number(c.metrics?.recipients) || 0), 0);
    return [
      { label: "Campaigns", value: presetList.length.toLocaleString() },
      { label: "Scheduled", value: scheduled.toLocaleString() },
      { label: "Sent", value: sent.length.toLocaleString() },
      { label: "Recipients reached", value: reached.toLocaleString() },
    ];
  }, [presetList]);

  const handleCreate = (name, channel, type) => {
    const campaign = {
      id: crypto.randomUUID(),
      projectId,
      name,
      channel,
      type,
      status: "draft",
      segmentId: null,
      eventId: null,
      scheduledAt: null,
      sentAt: null,
      content: defaultContent(channel),
      ab: defaultAb(),
      metrics: defaultMetrics(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [campaign, ...prev]);
    setOpenId(campaign.id);
    createCampaign(campaign).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the campaign to the server.");
      else setCampaigns((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    });
  };

  const handleSave = async (id, patch) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const saved = await updateCampaign(id, patch);
    if (saved === false) {
      toast.error("Couldn't save your changes to the server.");
      return;
    }
    toast.success("Campaign saved.");
  };

  const handleDuplicate = (c) => {
    const copy = {
      ...c,
      id: crypto.randomUUID(),
      name: `${c.name} (copy)`,
      status: "draft",
      scheduledAt: null,
      sentAt: null,
      metrics: defaultMetrics(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [copy, ...prev]);
    toast.success("Campaign duplicated.");
    createCampaign(copy).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the copy to the server.");
      else setCampaigns((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    });
  };

  const handleDelete = (c) => {
    setDeleteTarget(null);
    setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(`Deleted "${c.name}".`);
    softDeleteCampaign(c.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  // Editor takes over the screen when a campaign is open.
  const openCampaign = campaigns.find((c) => c.id === openId) || null;
  if (openCampaign) {
    return (
      <CampaignEditor
        campaign={openCampaign}
        segments={segments}
        templates={templates}
        estimateRecipients={estimateRecipients}
        onBack={() => setOpenId(null)}
        onSave={handleSave}
      />
    );
  }

  const title = preset?.title || "Campaigns";
  const description =
    preset?.description ||
    "Reach your audience across email, SMS, WhatsApp, and push — compose, segment, schedule, and track every send.";
  const filtersActive = search || statusFilter !== "all" || channelFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title={title}
        description={description}
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        }
      />

      {preset?.banner ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <p className="text-sm text-text-secondary">{preset.banner}</p>
        </div>
      ) : null}

      <StatsBar stats={stats} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search campaigns…"
          className="w-full sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          {!preset?.lockChannel ? (
            <FilterDropdown
              value={channelFilter}
              onValueChange={setChannelFilter}
              options={CHANNEL_FILTER_OPTIONS}
              height="h-9"
            />
          ) : null}
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              segmentName={segmentName(c.segmentId)}
              recipients={
                c.status === "sent"
                  ? Number(c.metrics?.recipients) || estimateRecipients(c.segmentId)
                  : estimateRecipients(c.segmentId)
              }
              onOpen={() => setOpenId(c.id)}
              onDuplicate={() => handleDuplicate(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Megaphone}
            title={
              filtersActive
                ? "No matches"
                : presetList.length
                  ? "No matches"
                  : "No campaigns yet"
            }
            description={
              filtersActive
                ? "Try a different search or filter."
                : "Create your first campaign — pick a channel, choose an audience, and schedule the send."
            }
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setChannelFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" /> New campaign
                </Button>
              )
            }
          />
        </div>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        preset={preset}
        onCreate={handleCreate}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete campaign</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default CampaignsScreen;
