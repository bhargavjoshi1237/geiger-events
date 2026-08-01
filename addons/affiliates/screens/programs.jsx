"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeDollarSign,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

import {
  MainScreenWrapper,
  SecondaryScreenWrapper,
} from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { listAffiliates } from "../lib/affiliates";
import {
  createEnrolment,
  createProgram,
  createProgramFromTemplate,
  createTier,
  listEnrolments,
  listPrograms,
  listTemplates,
  listTiers,
  softDeleteEnrolment,
  softDeleteProgram,
  softDeleteTier,
  updateEnrolment,
  updateProgram,
  updateTier,
} from "../lib/programs";
import {
  COMMISSION_BASE_OPTIONS,
  currency,
  DISCOUNT_HANDLING_OPTIONS,
  formatRate,
  PROGRAM_STATUS_FILTER_OPTIONS,
  PROGRAM_STATUS_MAP,
  RATE_MODEL_OPTIONS,
  slugify,
} from "../lib/constants";

// Per-event affiliate programs. Each event runs ONE program, fully independent
// of every other — its own tier ladder, rates, rules, budget and enrolment list.
// A template only seeds a new program; it never syncs afterwards.
//
// The open program lives in the URL (?record=<id>) so a refresh or a shared link
// stays on it.

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

// --- Program editor ----------------------------------------------------------

function ProgramDetail({ program, events, onBack, onChange, onDeleted }) {
  const { projectId } = useProject();
  const [tiers, setTiers] = useState([]);
  const [enrolments, setEnrolments] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolDraft, setEnrolDraft] = useState({ affiliateId: "", tierId: "", code: "" });

  const event = useMemo(
    () => events.find((e) => e.id === program.eventId) || null,
    [events, program.eventId],
  );

  useEffect(() => {
    let alive = true;
    Promise.all([
      listTiers(program.id),
      listEnrolments(program.id),
      listAffiliates(projectId),
    ]).then(([t, e, a]) => {
      if (!alive) return;
      setTiers(t ?? []);
      setEnrolments(e ?? []);
      setAffiliates(a ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [program.id, projectId]);

  // Persist one program field, optimistically, and lift it back to the list.
  const patchProgram = async (patch) => {
    const previous = { ...program };
    onChange({ ...program, ...patch });
    const saved = await updateProgram(program.id, patch);
    if (!saved) {
      onChange(previous);
      toast.error("Couldn't save that change.");
    }
  };

  const handleAddTier = async () => {
    const rank = tiers.length;
    const optimistic = {
      id: crypto.randomUUID(),
      programId: program.id,
      name: `Tier ${rank + 1}`,
      rank,
      thresholdSales: 0,
      thresholdRevenue: 0,
      rateModel: "percent",
      rateValue: 10,
      ticketTypeRates: {},
    };
    setTiers((prev) => [...prev, optimistic]);
    const created = await createTier(program.id, optimistic);
    if (created) {
      setTiers((prev) => prev.map((t) => (t.id === created.id ? created : t)));
    } else {
      setTiers((prev) => prev.filter((t) => t.id !== optimistic.id));
      toast.error("Couldn't add that tier.");
    }
  };

  const handleTierChange = async (tier, patch) => {
    const previous = { ...tier };
    setTiers((prev) => prev.map((t) => (t.id === tier.id ? { ...t, ...patch } : t)));
    const saved = await updateTier(tier.id, patch);
    if (!saved) {
      setTiers((prev) => prev.map((t) => (t.id === tier.id ? previous : t)));
      toast.error("Couldn't save that tier.");
    }
  };

  const handleTierDelete = async (tier) => {
    const snapshot = tiers;
    setTiers((prev) => prev.filter((t) => t.id !== tier.id));
    const ok = await softDeleteTier(tier.id);
    if (!ok) {
      setTiers(snapshot);
      toast.error("Couldn't remove that tier.");
    }
  };

  const handleEnrol = async () => {
    if (!enrolDraft.affiliateId) return toast.error("Pick an affiliate to enrol.");
    if (enrolments.some((e) => e.affiliateId === enrolDraft.affiliateId)) {
      return toast.error("That affiliate is already in this program.");
    }
    const affiliate = affiliates.find((a) => a.id === enrolDraft.affiliateId);
    const optimistic = {
      id: crypto.randomUUID(),
      programId: program.id,
      affiliateId: enrolDraft.affiliateId,
      tierId: enrolDraft.tierId || tiers[0]?.id || null,
      refSlug: affiliate?.slug || slugify(affiliate?.name),
      code: enrolDraft.code.trim() || null,
      status: "active",
      affiliate: affiliate
        ? { id: affiliate.id, name: affiliate.name, email: affiliate.email }
        : null,
    };
    setEnrolments((prev) => [optimistic, ...prev]);
    const created = await createEnrolment(program.id, optimistic);
    if (created) {
      setEnrolments((prev) =>
        prev.map((e) => (e.id === created.id ? created : e)),
      );
      setEnrolDraft({ affiliateId: "", tierId: "", code: "" });
      setEnrolOpen(false);
      toast.success("Affiliate enrolled");
    } else {
      setEnrolments((prev) => prev.filter((e) => e.id !== optimistic.id));
      toast.error("Couldn't enrol that affiliate — the link token or code may already be taken.");
    }
  };

  const handleEnrolmentChange = async (enrolment, patch) => {
    const previous = { ...enrolment };
    setEnrolments((prev) =>
      prev.map((e) => (e.id === enrolment.id ? { ...e, ...patch } : e)),
    );
    const saved = await updateEnrolment(enrolment.id, patch);
    if (!saved) {
      setEnrolments((prev) =>
        prev.map((e) => (e.id === enrolment.id ? previous : e)),
      );
      toast.error("Couldn't save that enrolment.");
    }
  };

  const handleEnrolmentRemove = async (enrolment) => {
    const snapshot = enrolments;
    setEnrolments((prev) => prev.filter((e) => e.id !== enrolment.id));
    const ok = await softDeleteEnrolment(enrolment.id);
    if (!ok) {
      setEnrolments(snapshot);
      toast.error("Couldn't remove that enrolment.");
    }
  };

  const copyLink = (enrolment) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/e/${program.eventId}?ref=${enrolment.refSlug}`;
    navigator.clipboard?.writeText(url);
    toast.success("Tracked link copied");
  };

  const rules = program.rules || {};
  const setRule = (key, value) =>
    patchProgram({ rules: { ...rules, [key]: value } });

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title={program.name}
        description={
          event
            ? `Affiliate program for ${event.name}. Independent of every other event's program.`
            : "Affiliate program."
        }
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={program.status}
              onValueChange={(status) => patchProgram({ status })}
            >
              <SelectTrigger className="h-9 w-[140px] border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {loading ? (
        <LoadingArea />
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Commission"
            description="What the rate multiplies. The default never pays commission on money you discounted away, or on add-ons."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base">
                <Select
                  value={program.commissionBase}
                  onValueChange={(v) => patchProgram({ commissionBase: v })}
                >
                  <SelectTrigger className="border-border bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-surface-subtle">
                    {COMMISSION_BASE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Applied">
                <Select
                  value={program.discountHandling}
                  onValueChange={(v) => patchProgram({ discountHandling: v })}
                >
                  <SelectTrigger className="border-border bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-surface-subtle">
                    {DISCOUNT_HANDLING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Attribution window (days)"
                hint="How long a tracked-link click keeps earning after the visit."
              >
                <Input
                  type="number"
                  min={1}
                  value={program.attributionWindowDays}
                  onChange={(e) =>
                    patchProgram({ attributionWindowDays: Number(e.target.value) })
                  }
                />
              </Field>
              <Field
                label="Program budget"
                hint="Total commission this program may accrue. Blank = uncapped."
              >
                <Input
                  type="number"
                  min={0}
                  value={program.budgetCap ?? ""}
                  onChange={(e) => patchProgram({ budgetCap: e.target.value })}
                  placeholder="Uncapped"
                />
              </Field>
              <Field
                label="Per-affiliate cap"
                hint="Default ceiling per affiliate. An enrolment can override it."
              >
                <Input
                  type="number"
                  min={0}
                  value={program.affiliateCap ?? ""}
                  onChange={(e) => patchProgram({ affiliateCap: e.target.value })}
                  placeholder="Uncapped"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Tier ladder"
            description="A tier is a named commission plan. With automatic tiers on, affiliates move up the ladder on their rolling sales; otherwise you assign tiers by hand."
            action={
              <Button variant="ghost" onClick={handleAddTier}>
                <Plus className="mr-2 h-4 w-4" />
                Add tier
              </Button>
            }
          >
            {tiers.length === 0 ? (
              <EmptyState
                icon={BadgeDollarSign}
                title="No tiers yet"
                description="Add at least one tier — an affiliate with no tier and no rate override earns nothing."
              />
            ) : (
              <div className="space-y-3">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="grid items-end gap-3 rounded-lg border border-border bg-surface-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
                  >
                    <Field label="Name">
                      <Input
                        value={tier.name}
                        onChange={(e) =>
                          setTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id ? { ...t, name: e.target.value } : t,
                            ),
                          )
                        }
                        onBlur={(e) => handleTierChange(tier, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Model">
                      <Select
                        value={tier.rateModel}
                        onValueChange={(v) => handleTierChange(tier, { rateModel: v })}
                      >
                        <SelectTrigger className="border-border bg-surface-subtle">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-surface-subtle">
                          {RATE_MODEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Rate">
                      <Input
                        type="number"
                        min={0}
                        value={tier.rateValue}
                        onChange={(e) =>
                          setTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id
                                ? { ...t, rateValue: e.target.value }
                                : t,
                            ),
                          )
                        }
                        onBlur={(e) =>
                          handleTierChange(tier, { rateValue: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label="Sales to reach"
                      hint={program.autoTiers ? undefined : "Automatic tiers are off"}
                    >
                      <Input
                        type="number"
                        min={0}
                        disabled={!program.autoTiers}
                        value={tier.thresholdSales}
                        onChange={(e) =>
                          setTiers((prev) =>
                            prev.map((t) =>
                              t.id === tier.id
                                ? { ...t, thresholdSales: e.target.value }
                                : t,
                            ),
                          )
                        }
                        onBlur={(e) =>
                          handleTierChange(tier, { thresholdSales: e.target.value })
                        }
                      />
                    </Field>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${tier.name}`}
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => handleTierDelete(tier)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Enrolled affiliates"
            description="Each affiliate gets a tracked link for this event, and optionally a code that also discounts the buyer."
            action={
              <Button variant="ghost" onClick={() => setEnrolOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Enrol affiliate
              </Button>
            }
          >
            {enrolments.length === 0 ? (
              <EmptyState
                icon={BadgeDollarSign}
                title="Nobody enrolled yet"
                description="Enrol an affiliate to generate their tracked link for this event."
              />
            ) : (
              <div className="space-y-2">
                {enrolments.map((enrolment) => (
                  <div
                    key={enrolment.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {enrolment.affiliate?.name || "Affiliate"}
                      </p>
                      <code className="text-xs text-text-secondary">
                        ?ref={enrolment.refSlug}
                        {enrolment.code ? ` · code ${enrolment.code}` : ""}
                      </code>
                    </div>
                    <Select
                      value={enrolment.tierId || ""}
                      onValueChange={(v) =>
                        handleEnrolmentChange(enrolment, { tierId: v })
                      }
                    >
                      <SelectTrigger className="h-8 w-[160px] border-border bg-surface-subtle text-xs">
                        <SelectValue placeholder="No tier" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-surface-subtle">
                        {tiers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · {formatRate(t.rateModel, t.rateValue)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy tracked link"
                      onClick={() => copyLink(enrolment)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove from program"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => handleEnrolmentRemove(enrolment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Rules & rails"
            description="Checked server-side at attribution time — the cookie half of attribution is untrusted input."
          >
            <SettingsList>
              <SettingRow
                title="Automatic tiers"
                description="Move affiliates up the ladder on their rolling sales instead of assigning tiers by hand."
                checked={program.autoTiers}
                onCheckedChange={(v) => patchProgram({ autoTiers: v })}
              />
              <SettingRow
                title="Stop at event start"
                description="Refuse attribution once the event's date arrives, whatever the end date says."
                checked={program.stopAtEventStart}
                onCheckedChange={(v) => patchProgram({ stopAtEventStart: v })}
              />
              <SettingRow
                title="Exclude free tickets"
                description="Zero-price tickets earn no commission."
                checked={Boolean(rules.excludeFreeTickets)}
                onCheckedChange={(v) => setRule("excludeFreeTickets", v)}
              />
              <SettingRow
                title="Exclude discounted orders"
                description="Orders that already used any coupon earn no commission."
                checked={Boolean(rules.excludeDiscountedOrders)}
                onCheckedChange={(v) => setRule("excludeDiscountedOrders", v)}
              />
              <SettingRow
                title="Minimum order value"
                description="Orders below this total are ineligible."
                control={
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={rules.minOrderValue ?? ""}
                    onChange={(e) => setRule("minOrderValue", e.target.value)}
                    placeholder="0"
                  />
                }
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Danger zone">
            <Button
              variant="ghost"
              className="text-red-400 hover:bg-red-500/10"
              onClick={async () => {
                const ok = await softDeleteProgram(program.id);
                if (ok) {
                  toast.success("Program deleted");
                  onDeleted(program.id);
                } else {
                  toast.error("Couldn't delete that program.");
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete this program
            </Button>
          </SectionCard>
        </div>
      )}

      <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enrol an affiliate</DialogTitle>
            <DialogDescription>
              They get a tracked link for this event. A code is optional — when
              set, it also discounts the buyer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Affiliate">
              <Select
                value={enrolDraft.affiliateId}
                onValueChange={(v) =>
                  setEnrolDraft((d) => ({ ...d, affiliateId: v }))
                }
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue placeholder="Choose an affiliate" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {affiliates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tier">
              <Select
                value={enrolDraft.tierId}
                onValueChange={(v) => setEnrolDraft((d) => ({ ...d, tierId: v }))}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue placeholder="Lowest tier" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {formatRate(t.rateModel, t.rateValue)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Discount code"
              hint="Optional. Buyers type it at checkout; it attributes the sale and discounts them."
            >
              <Input
                value={enrolDraft.code}
                onChange={(e) =>
                  setEnrolDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))
                }
                placeholder="JAMIE10"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnrolOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleEnrol}
            >
              Enrol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SecondaryScreenWrapper>
  );
}

// --- Programs list -----------------------------------------------------------

export function ProgramsScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const [programs, setPrograms] = useState([]);
  const [events, setEvents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ eventId: "", templateId: "", name: "" });

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    Promise.all([
      listPrograms(projectId),
      listEvents(projectId),
      listTemplates(projectId),
    ]).then(([p, e, t]) => {
      if (!alive) return;
      setPrograms(p ?? []);
      setEvents(e ?? []);
      setTemplates(t ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventName = (id) => events.find((e) => e.id === id)?.name || "Unknown event";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        eventName(p.eventId).toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, events, search, statusFilter]);

  const stats = useMemo(() => {
    const active = programs.filter((p) => p.status === "active").length;
    const budget = programs.reduce((s, p) => s + (p.budgetCap || 0), 0);
    return [
      { label: "Programs", value: String(programs.length) },
      { label: "Active", value: String(active) },
      { label: "Events without one", value: String(Math.max(events.length - programs.length, 0)) },
      { label: "Committed budget", value: currency(budget) },
    ];
  }, [programs, events]);

  const open = useMemo(
    () => programs.find((p) => p.id === recordId) || null,
    [programs, recordId],
  );

  const handleCreate = async () => {
    if (!draft.eventId) return toast.error("Pick the event this program runs for.");
    if (programs.some((p) => p.eventId === draft.eventId)) {
      return toast.error("That event already has a program.");
    }
    const template = templates.find((t) => t.id === draft.templateId) || null;
    const name = draft.name.trim() || `${eventName(draft.eventId)} affiliates`;

    const created = template
      ? await createProgramFromTemplate(projectId, draft.eventId, template, { name })
      : await createProgram(projectId, { eventId: draft.eventId, name, status: "draft" });

    if (created) {
      setPrograms((prev) => [created, ...prev]);
      setDraft({ eventId: "", templateId: "", name: "" });
      setCreateOpen(false);
      toast.success("Program created");
      openRecord(created.id);
    } else {
      toast.error("Couldn't create that program.");
    }
  };

  if (open) {
    return (
      <ProgramDetail
        program={open}
        events={events}
        onBack={closeRecord}
        onChange={(next) =>
          setPrograms((prev) => prev.map((p) => (p.id === next.id ? next : p)))
        }
        onDeleted={(id) => {
          setPrograms((prev) => prev.filter((p) => p.id !== id));
          closeRecord();
        }}
      />
    );
  }

  const createButton = (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="mr-2 h-4 w-4" />
      New program
    </Button>
  );

  const columns = [
    {
      key: "name",
      header: "Program",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {eventName(row.eventId)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status} map={PROGRAM_STATUS_MAP} />,
    },
    {
      key: "base",
      header: "Base",
      render: (row) => (
        <span className="text-text-secondary">
          {row.commissionBase === "tickets_addons" ? "Tickets + add-ons" : "Tickets"} ·{" "}
          {row.discountHandling === "post" ? "post-discount" : "pre-discount"}
        </span>
      ),
    },
    {
      key: "window",
      header: "Window",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {row.attributionWindowDays}d
        </span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-foreground">
          {row.budgetCap === null ? "Uncapped" : currency(row.budgetCap)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Actions for ${row.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-surface-subtle"
            >
              <DropdownMenuItem onClick={() => openRecord(row.id)}>
                Open program
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={async () => {
                  const snapshot = programs;
                  setPrograms((prev) => prev.filter((p) => p.id !== row.id));
                  const ok = await softDeleteProgram(row.id);
                  if (ok) toast.success("Program deleted");
                  else {
                    setPrograms(snapshot);
                    toast.error("Couldn't delete that program.");
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Programs"
        description="One affiliate program per event, each fully independent. Start from a template to avoid rebuilding the ladder every time."
        actions={createButton}
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={PROGRAM_STATUS_FILTER_OPTIONS}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search programs"
          className="sm:w-72"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.id}
          onRowClick={(row) => openRecord(row.id)}
          empty={
            programs.length === 0 ? (
              <EmptyState
                icon={BadgeDollarSign}
                title="No programs yet"
                description="Create a program for an event to start attributing ticket sales to affiliates."
                action={createButton}
              />
            ) : (
              <EmptyState
                icon={BadgeDollarSign}
                title="No matching programs"
                description="No program matches the current search and filter."
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New affiliate program</DialogTitle>
            <DialogDescription>
              A program belongs to exactly one event. Picking a template copies
              its ladder and rules — the program evolves on its own afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Event">
              <Select
                value={draft.eventId}
                onValueChange={(v) => setDraft((d) => ({ ...d, eventId: v }))}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue placeholder="Choose an event" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {events
                    .filter((e) => !programs.some((p) => p.eventId === e.id))
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start from a template" hint="Optional.">
              <Select
                value={draft.templateId}
                onValueChange={(v) => setDraft((d) => ({ ...d, templateId: v }))}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Program name" hint="Defaults to the event's name.">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={
                  draft.eventId ? `${eventName(draft.eventId)} affiliates` : ""
                }
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleCreate}
            >
              Create program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ProgramsScreen;
