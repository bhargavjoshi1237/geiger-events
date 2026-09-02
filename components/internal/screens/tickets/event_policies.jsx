"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Coins,
  FileText,
  Gauge,
  Hash,
  IdCard,
  Landmark,
  Loader2,
  Percent,
  Plus,
  Receipt,
  Repeat,
  RotateCcw,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
  StatGrid,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";
import { listOrders } from "@/lib/supabase/orders";
import {
  currency,
  formatDate,
  pricingRuleSummary,
  PRICING_RULE_KIND_LABELS,
  TRANSFER_POLICY_OPTIONS,
} from "./constants";

// Per-event sections for the ticketing modules that used to share one long
// "Ticketing" attach page. Each promotes a single module: a header, a stat strip,
// the attach picker for its reusable records, and a summary of what those records
// actually put in effect for this event. Records themselves stay under the
// Tickets sidebar — this is only ever the event side of that relationship.

const OUTLINE_BUTTON =
  "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

// --- Shared kit ---------------------------------------------------------------

// One module's reusable records plus the ids this event has attached, with a
// toggle that writes straight back to the event's `attached` metadata bag.
function useModuleRecords(event, module, tab) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, module).then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, module]);

  const selected = Array.isArray(attached?.[module]) ? attached[module] : [];
  const attachedRecords = records.filter((r) => selected.includes(r.id));
  // Inactive records never reach the storefront, so summaries read active ones only.
  const effective = attachedRecords.filter((r) => r.active);

  const toggle = (id) =>
    save({
      ...attached,
      [module]: selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    });

  return {
    loading,
    records,
    selected,
    attachedRecords,
    effective,
    toggle,
    manage: () => setTab(tab),
  };
}

function LoadingBlock({ label = "Loading records…" }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-10 text-sm text-text-secondary">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function RecordPill({ record, on, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(record.id)}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        on
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
        !record.active && !on ? "opacity-60" : "",
      )}
    >
      {record.name}
      {!record.active ? " · inactive" : ""}
    </button>
  );
}

// The attach picker — the one piece every section here shares.
function AttachCard({
  label,
  records,
  selected,
  loading,
  onToggle,
  onManage,
  emptyHint,
}) {
  return (
    <SectionCard
      bare
      title={`Attached ${label.toLowerCase()}`}
      description={
        loading
          ? "Reading the records in your project…"
          : selected.length
            ? `${selected.length} attached to this event`
            : "None attached — the project default applies."
      }
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={onManage}
          className={OUTLINE_BUTTON}
        >
          Manage <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : records.length ? (
        <div className="flex flex-wrap gap-2">
          {records.map((r) => (
            <RecordPill
              key={r.id}
              record={r}
              on={selected.includes(r.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-text-secondary">
            {emptyHint || `No ${label.toLowerCase()} records in this project yet.`}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onManage}
            className={OUTLINE_BUTTON}
          >
            <Plus className="h-4 w-4" /> Create one
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

// A label/value line, sized to sit two-up like Overview's "At a glance" rows.
function FactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {label}
      </span>
      <span className="shrink-0 font-medium text-foreground">{value}</span>
    </div>
  );
}

function FactGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      {children}
    </div>
  );
}

// --- Orders & Attendees ------------------------------------------------------

export function EventOrdersSection({ event, headerItem }) {
  const mod = useModuleRecords(event, "order_policy", "Orders & Attendees");
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    let alive = true;
    listOrders(event?.id).then((rows) => {
      if (!alive) return;
      setOrders(rows ?? []);
    });
    return () => {
      alive = false;
    };
  }, [event?.id]);

  const placed = orders ?? [];
  const open = placed.filter((o) => !o.cancelledAt);
  const tickets = open.reduce((n, o) => n + (o.quantity || 0), 0);
  const gross = open.reduce((n, o) => n + (o.total || 0), 0);
  const avg = open.length ? Math.round(gross / open.length) : 0;

  const has = mod.effective.length > 0;
  const policy = mod.effective[0]?.config || {};
  const fallback = "Project default";
  const refundLabel = !has
    ? fallback
    : policy.refundPolicy === "none"
      ? "No refunds"
      : policy.refundPolicy === "full"
        ? "Full refunds"
        : "Partial refunds";

  const stats = [
    {
      label: "Orders",
      value: orders ? String(open.length) : "—",
      icon: ShoppingBag,
      hint: `${placed.length - open.length} cancelled`,
    },
    {
      label: "Tickets",
      value: orders ? String(tickets) : "—",
      icon: Ticket,
      hint: `${(event.sold || 0).toLocaleString("en-US")} counted as sold`,
    },
    {
      label: "Gross",
      value: orders ? currency(gross) : "—",
      icon: Wallet,
      hint: "Before fees and refunds",
    },
    {
      label: "Avg order",
      value: orders ? currency(avg) : "—",
      icon: Receipt,
      hint: "Gross ÷ orders placed",
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Orders & Attendees"}
        description={
          headerItem?.desc ||
          "Who bought tickets, what they paid, and the order policy that governs refunds and transfers."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={mod.manage}
            className={OUTLINE_BUTTON}
          >
            Manage policies <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <StatGrid stats={stats} />

      <AttachCard
        label="Order policies"
        records={mod.records}
        selected={mod.selected}
        loading={mod.loading}
        onToggle={mod.toggle}
        onManage={mod.manage}
        emptyHint="Order policies are reusable — create one under the Tickets sidebar, then attach it here."
      />

      <SectionCard
        bare
        className="pt-4"
        title="What buyers can do"
        description={
          has
            ? `In effect from “${mod.effective[0].name}”.`
            : "Attach an order policy to set these for this event."
        }
      >
        <FactGrid>
          <FactRow
            icon={Settings2}
            label="Self-service"
            value={
              !has ? fallback : policy.selfService ? "Enabled" : "Disabled"
            }
          />
          <FactRow icon={RotateCcw} label="Refunds" value={refundLabel} />
          <FactRow
            icon={Repeat}
            label="Ticket transfer"
            value={
              !has ? fallback : policy.allowTicketTransfer ? "Allowed" : "Blocked"
            }
          />
          <FactRow
            icon={UserCheck}
            label="Name changes"
            value={!has ? fallback : policy.allowNameChange ? "Allowed" : "Blocked"}
          />
          <FactRow
            icon={Gauge}
            label="Refund window"
            value={
              !has || policy.refundPolicy === "none"
                ? "—"
                : `${policy.refundWindowDays ?? 7} days before the event`
            }
          />
          <FactRow
            icon={IdCard}
            label="Refund approval"
            value={
              !has || policy.refundPolicy === "none"
                ? "—"
                : policy.refundApproval === "auto"
                  ? "Automatic"
                  : "Manual review"
            }
          />
        </FactGrid>
      </SectionCard>
    </div>
  );
}

// --- Invoices & Receipts -----------------------------------------------------

export function EventInvoicesSection({ event, headerItem }) {
  const mod = useModuleRecords(event, "invoice_profile", "Invoices & Receipts");
  const has = mod.effective.length > 0;
  const profile = mod.effective[0]?.config || {};

  const generation = has
    ? profile.generation === "auto"
      ? "Automatic"
      : "Manual"
    : "—";

  const stats = [
    {
      label: "Profiles attached",
      value: String(mod.selected.length),
      icon: FileText,
      hint: has ? mod.effective[0].name : "None in effect",
    },
    {
      label: "Generation",
      value: generation,
      icon: Receipt,
      hint: "How invoices are issued",
    },
    {
      label: "Numbering",
      value: has ? `${profile.prefix || "INV"}-…` : "—",
      icon: Hash,
      hint: "Leads the invoice number",
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Invoices & Receipts"}
        description={
          headerItem?.desc ||
          "The invoice profile behind this event's tax documents and what prints on every receipt."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={mod.manage}
            className={OUTLINE_BUTTON}
          >
            Manage profiles <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <StatGrid columns={3} stats={stats} />

      <AttachCard
        label="Invoice profiles"
        records={mod.records}
        selected={mod.selected}
        loading={mod.loading}
        onToggle={mod.toggle}
        onManage={mod.manage}
        emptyHint="Invoice profiles are reusable — create one under the Tickets sidebar, then attach it here."
      />

      <SectionCard
        bare
        className="pt-4"
        title="Documents in effect"
        description={
          has
            ? `In effect from “${mod.effective[0].name}”.`
            : "Attach an invoice profile to set these for this event."
        }
      >
        <FactGrid>
          <FactRow
            icon={FileText}
            label="Invoices"
            value={
              !has
                ? "Project default"
                : profile.generation === "auto"
                  ? "Issued automatically"
                  : "Issued on request"
            }
          />
          <FactRow
            icon={Hash}
            label="Number prefix"
            value={has ? profile.prefix || "INV" : "—"}
          />
          <FactRow
            icon={Landmark}
            label="Business / VAT ID"
            value={has ? profile.businessId || "Not set" : "—"}
          />
          <FactRow
            icon={Receipt}
            label="Receipt footer"
            value={!has ? "Project default" : profile.receiptFooter ? "Custom" : "Not set"}
          />
        </FactGrid>
      </SectionCard>

      <SectionCard
        bare
        className="border-t border-border pt-6"
        title="Preview"
        description="How an invoice for this event is headed."
      >
        <div className="rounded-lg border border-border bg-surface-card px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary tabular-nums">
                {profile.prefix || "INV"}-1042
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {event?.name || "Your event"}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-text-secondary">
              <p>{formatDate(new Date().toISOString())}</p>
              <p>{profile.businessId || "No business ID set"}</p>
            </div>
          </div>
          {profile.receiptFooter ? (
            <p className="mt-3 border-t border-border pt-2 text-xs text-text-tertiary">
              {profile.receiptFooter}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

// --- Anti-scalping & Resale --------------------------------------------------

const transferLabel = (value) =>
  TRANSFER_POLICY_OPTIONS.find((o) => o.value === value)?.label ||
  "No transfers";

const transferShort = (value) =>
  value === "open" ? "Open" : value === "organizer-approval" ? "Approval" : "Blocked";

export function EventResaleSection({ event, headerItem }) {
  const mod = useModuleRecords(event, "resale_rule", "Anti-scalping & Resale");
  const rule = mod.effective[0]?.config || {};
  const has = mod.effective.length > 0;

  const maxPerBuyer = Number(rule.maxPerBuyer ?? 0) || 0;
  const capped = rule.maxResalePrice === "face";

  const controls = [
    {
      icon: UserCheck,
      label: "Name lock",
      on: !!rule.nameLockRequired,
      value: rule.nameLockRequired
        ? "Each ticket tied to the buyer's name"
        : "Tickets are freely transferable",
    },
    {
      icon: IdCard,
      label: "ID check at entry",
      on: !!rule.identityCheck,
      value: rule.identityCheck
        ? "Staff verify a matching ID"
        : "No ID check",
    },
    {
      icon: Repeat,
      label: "Transfers",
      on: !!rule.transferPolicy && rule.transferPolicy !== "off",
      value: transferLabel(rule.transferPolicy || "off"),
    },
    {
      icon: ShieldAlert,
      label: "Resale price cap",
      on: capped,
      value: capped ? "Capped at face value" : "No cap",
    },
    {
      icon: Users,
      label: "Max per buyer",
      on: maxPerBuyer > 0,
      value: maxPerBuyer > 0 ? `${maxPerBuyer} tickets per buyer` : "No limit",
    },
  ];

  const score = controls.filter((c) => c.on).length;
  const level =
    score === 0 ? "None" : score <= 2 ? "Light" : score === 3 ? "Standard" : "Strict";

  const stats = [
    {
      label: "Protection level",
      value: has ? level : "—",
      icon: ShieldAlert,
      hint: `${score} of ${controls.length} controls on`,
    },
    {
      label: "Transfers",
      value: has ? transferShort(rule.transferPolicy || "off") : "—",
      icon: Repeat,
      hint: "How tickets change hands",
    },
    {
      label: "Per buyer",
      value: has ? (maxPerBuyer > 0 ? String(maxPerBuyer) : "No cap") : "—",
      icon: Users,
      hint: "Tickets one buyer can hold",
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Anti-scalping & Resale"}
        description={
          headerItem?.desc ||
          "Rules that curb scalping — name locks, ID checks, transfer policy, and resale caps."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={mod.manage}
            className={OUTLINE_BUTTON}
          >
            Manage rules <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <StatGrid columns={3} stats={stats} />

      <AttachCard
        label="Resale rules"
        records={mod.records}
        selected={mod.selected}
        loading={mod.loading}
        onToggle={mod.toggle}
        onManage={mod.manage}
        emptyHint="Resale rules are reusable — create one under the Tickets sidebar, then attach it here."
      />

      <SectionCard
        bare
        className="pt-4"
        title="Protections in effect"
        description={
          has
            ? `In effect from “${mod.effective[0].name}”.`
            : "Nothing attached — buyers face no resale restrictions."
        }
      >
        <SettingsList>
          {controls.map((c) => (
            <SettingRow
              key={c.label}
              icon={c.icon}
              title={c.label}
              description={c.value}
              control={
                <Badge variant={c.on ? "success" : "neutral"}>
                  {c.on ? "On" : "Off"}
                </Badge>
              }
            />
          ))}
        </SettingsList>
      </SectionCard>
    </div>
  );
}

// --- Multi-currency ----------------------------------------------------------

export function EventCurrenciesSection({ event, headerItem }) {
  const mod = useModuleRecords(event, "currency", "Multi-currency");
  const rows = mod.effective;
  const rates = rows.map((r) => Number(r.config?.rate ?? 1) || 0);
  const base = rows.find((r) => (Number(r.config?.rate ?? 1) || 0) === 1);

  const stats = [
    {
      label: "Accepted",
      value: String(rows.length),
      icon: Coins,
      hint: rows.length ? "Currencies offered at checkout" : "Base currency only",
    },
    {
      label: "Base",
      value: base?.config?.code || "USD",
      icon: Landmark,
      hint: "Ticket prices are set in this currency",
    },
    {
      label: "Widest rate",
      value: rates.length ? Math.max(...rates).toFixed(2) : "1.00",
      icon: TrendingUp,
      hint: "Farthest conversion from base",
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Multi-currency"}
        description={
          headerItem?.desc ||
          "Currencies buyers can pay in, with their conversion rates and settlement accounts."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={mod.manage}
            className={OUTLINE_BUTTON}
          >
            Manage currencies <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <StatGrid columns={3} stats={stats} />

      <AttachCard
        label="Currencies"
        records={mod.records}
        selected={mod.selected}
        loading={mod.loading}
        onToggle={mod.toggle}
        onManage={mod.manage}
        emptyHint="Currencies are reusable — add one under the Tickets sidebar, then attach it here."
      />

      <SectionCard
        bare
        className="pt-4"
        title="Exchange rates"
        description="Offered at the Stripe payment stage, converted from your base currency."
      >
        {rows.length ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div className="grid grid-cols-[1fr_4rem_8rem] gap-4 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <span>Currency</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Settles to</span>
            </div>
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const rate = Number(r.config?.rate ?? 1) || 0;
                const isBase = rate === 1;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_4rem_8rem] items-center gap-4 px-4 py-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-medium text-foreground">
                        {r.config?.code || "—"}
                      </span>
                      <span className="text-text-tertiary">
                        {r.config?.symbol || "?"}
                      </span>
                      {isBase ? <Badge variant="info">Base</Badge> : null}
                      <span className="truncate text-xs text-text-tertiary">
                        {r.name}
                      </span>
                    </span>
                    <span className="text-right tabular-nums text-foreground">
                      {rate.toFixed(2)}
                    </span>
                    <span className="truncate text-right text-xs text-text-tertiary">
                      {r.config?.stripeAccount || "Default account"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
            Attach a currency to offer it at checkout.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

// --- Dynamic Pricing ---------------------------------------------------------

const CURVE_STEPS = [0, 25, 50, 75, 100];

// Uplift at a given sell-through: every demand rule whose trigger has been
// reached stacks its bump on top of the base price.
function upliftAt(rules, pct) {
  return rules.reduce((total, r) => {
    const threshold =
      r.config?.threshold == null ? 75 : Number(r.config.threshold) || 0;
    return threshold <= pct ? total + (Number(r.config?.bump) || 0) : total;
  }, 0);
}

// Area chart of price uplift against sell-through — the only way to read a stack
// of demand rules at a glance.
function PriceCurve({ rules }) {
  const points = CURVE_STEPS.map((pct) => upliftAt(rules, pct));
  const top = Math.max(10, ...points);

  const W = 640;
  const H = 168;
  const padX = 30;
  const padY = 26;
  const x = (i) => padX + (i * (W - padX * 2)) / (CURVE_STEPS.length - 1);
  const y = (v) => H - padY - (v / top) * (H - padY * 2);

  const line = points
    .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
    .join(" ");
  const area = `${line} L${x(CURVE_STEPS.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[168px] w-full text-primary"
      role="img"
      aria-label="Ticket price uplift as the event sells through"
    >
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line
            x1={padX}
            x2={W - padX}
            y1={y(v)}
            y2={y(v)}
            className="text-border"
            stroke="currentColor"
            strokeWidth="1"
          />
          <text
            x={padX - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="text-[9px] text-text-tertiary"
            fill="currentColor"
          >
            {Math.round(v)}%
          </text>
        </g>
      ))}

      <path d={area} fill="currentColor" opacity="0.14" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((v, i) => (
        <g key={CURVE_STEPS[i]}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="currentColor" />
          <text
            x={x(i)}
            y={y(v) - 10}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill="currentColor"
          >
            {v ? `+${v}%` : "base"}
          </text>
          <text
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="text-[9px] text-text-tertiary"
            fill="currentColor"
          >
            {CURVE_STEPS[i]}% sold
          </text>
        </g>
      ))}
    </svg>
  );
}

// The summary lives with the config in constants.js so this list and the
// Tickets screen's table always read the same.
const ruleSummary = pricingRuleSummary;

// Badge tone per rule kind: the three price-moving kinds read as violet/blue,
// the resale cap as amber.
const PRICING_KIND_VARIANT = {
  demand: "purple",
  time: "info",
  quantity: "info",
  resale: "warning",
};

export function EventPricingSection({ event, headerItem }) {
  const mod = useModuleRecords(event, "pricing_rule", "Dynamic Pricing");
  const rules = mod.effective;
  const demand = rules.filter((r) => (r.kind || "demand") === "demand");
  const time = rules.filter((r) => r.kind === "time");
  const quantity = rules.filter((r) => r.kind === "quantity");
  const resale = rules.filter((r) => r.kind === "resale");

  const bumps = demand.map((r) => Number(r.config?.bump) || 0);
  const maxBump = bumps.length ? Math.max(...bumps) : 0;
  const triggers = demand.map((r) =>
    r.config?.threshold == null ? 75 : Number(r.config.threshold) || 0,
  );
  const firstTrigger = triggers.length ? Math.min(...triggers) : null;

  const stats = [
    {
      label: "Rules attached",
      value: String(rules.length),
      icon: TrendingUp,
      hint: [
        `${demand.length} sell-through`,
        `${time.length} date`,
        `${quantity.length} quantity`,
        `${resale.length} resale`,
      ].join(" · "),
    },
    {
      label: "Top uplift",
      value: maxBump ? `+${maxBump}%` : "—",
      icon: Percent,
      hint: "Largest single price increase",
    },
    {
      label: "First trigger",
      value: firstTrigger == null ? "—" : `${firstTrigger}%`,
      icon: Gauge,
      hint: "Sell-through that starts pricing",
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Dynamic Pricing"}
        description={
          headerItem?.desc ||
          "Demand-based rules that move the ticket price as the event sells through."
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={mod.manage}
            className={OUTLINE_BUTTON}
          >
            Manage rules <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <StatGrid columns={3} stats={stats} />

      <AttachCard
        label="Pricing rules"
        records={mod.records}
        selected={mod.selected}
        loading={mod.loading}
        onToggle={mod.toggle}
        onManage={mod.manage}
        emptyHint="Pricing rules are reusable — create one under the Tickets sidebar, then attach it here."
      />

      <SectionCard
        bare
        className="pt-4"
        title="Price curve"
        description="How the ticket price moves as this event sells through. Sell-through rules stack; date and quantity rules fire on their own triggers."
      >
        <PriceCurve rules={demand} />
      </SectionCard>

      <SectionCard
        bare
        className="border-t border-border pt-6"
        title="Rules in effect"
        description={
          rules.length
            ? `${rules.length} active rule${rules.length === 1 ? "" : "s"} attached to this event.`
            : "Attach a pricing rule to price this event by demand."
        }
      >
        {rules.length ? (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-subtle">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {ruleSummary(r)}
                  </p>
                </div>
                <Badge variant={PRICING_KIND_VARIANT[r.kind || "demand"]}>
                  {PRICING_RULE_KIND_LABELS[r.kind || "demand"]}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
            No pricing rules attached — tickets stay at their listed price.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
