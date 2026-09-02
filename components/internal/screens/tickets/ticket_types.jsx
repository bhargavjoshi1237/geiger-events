"use client";

import React from "react";
import {
  Armchair,
  CalendarClock,
  Infinity as InfinityIcon,
  KeyRound,
  ListChecks,
  RotateCcw,
  Ticket,
} from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";
import { TicketQuestionsEditor } from "./ticket_questions_editor";
import { defaultTicketConfig, VISIBILITY_OPTIONS } from "./constants";

const KINDS = [
  { value: "ticket", label: "Ticket", defaultConfig: defaultTicketConfig },
];

// List-card summary line: "Refundable · Public · 2 questions".
function summarize(r) {
  const c = r.config || {};
  const vis = c.visibility || "public";
  const qCount = Array.isArray(c.questionIds) ? c.questionIds.length : 0;
  return [
    c.refund?.refundable ? "Refundable" : "Non-refundable",
    vis.charAt(0).toUpperCase() + vis.slice(1),
    qCount ? `${qCount} question${qCount > 1 ? "s" : ""}` : "no questions",
  ].join(" · ");
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each of these as an element (never calls it), so a
// section can hold hooks of its own. The shell draws the section heading from
// `label` + `desc`, so a section only groups its own fields.

function AvailabilitySection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const sales = config.sales || {};
  const setSales = (patch) => set({ sales: { ...sales, ...patch } });

  return (
    <div className="space-y-6">
      {/* The card header carries the description, so the control needs no label
          of its own — the section heading already reads "Availability". */}
      <SectionCard
        title="Sales window"
        description="When buyers can add this ticket to an order."
      >
        <div className="space-y-4">
          <Segmented
            value={sales.mode || "always"}
            onChange={(v) => setSales({ mode: v })}
            options={[
              { value: "always", label: "Always on sale", icon: InfinityIcon },
              { value: "window", label: "Scheduled window", icon: CalendarClock },
            ]}
            className="w-fit"
          />
          {sales.mode === "window" ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Field label="On sale from">
                <Input
                  type="datetime-local"
                  value={sales.startAt || ""}
                  onChange={(e) => setSales({ startAt: e.target.value })}
                />
              </Field>
              <Field label="On sale until">
                <Input
                  type="datetime-local"
                  value={sales.endAt || ""}
                  onChange={(e) => setSales({ endAt: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Order limits"
        description="How many of this ticket a buyer can purchase per order."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Min per order"
            value={config.minPerOrder ?? 1}
            onChange={(v) => set({ minPerOrder: v })}
            unit="Tickets"
            fullWidth
          />
          <Num
            label="Max per order"
            value={config.maxPerOrder ?? 0}
            onChange={(v) => set({ maxPerOrder: v })}
            unit="Tickets"
            fullWidth
          />
        </div>
      </SectionCard>
    </div>
  );
}

function RefundSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const refund = config.refund || {};
  const setRefund = (patch) => set({ refund: { ...refund, ...patch } });

  return (
    <div className="space-y-6">
      {/* Cutoff and fees only exist while refunds are on, so they grow inside
          the toggle's own card rather than popping a second one below it. */}
      <SectionCard>
        <SettingsList>
          <SettingRow
            icon={RotateCcw}
            title="Refundable"
            description="Allow buyers to Request A Refund before the cutoff."
            checked={!!refund.refundable}
            onCheckedChange={(v) => setRefund({ refundable: v })}
          />
        </SettingsList>

        {refund.refundable ? (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Num
              label="Refund cutoff"
              hint="Days before the event refunds close."
              value={refund.cutoffDays ?? 7}
              onChange={(v) => setRefund({ cutoffDays: v })}
              unit="days"
              fullWidth
            />
            <Field label="Processing fees" hint="Who absorbs the payment fees on a refund.">
              <Select
                value={refund.feeHandling || "absorb"}
                onValueChange={(v) => setRefund({ feeHandling: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absorb">Refund in full</SelectItem>
                  <SelectItem value="deduct">Keep processing fees</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function AccessSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const access = config.accessCode || {};
  const setAccess = (patch) => set({ accessCode: { ...access, ...patch } });

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility">
            <Select
              value={config.visibility || "public"}
              onValueChange={(v) => set({ visibility: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {config.visibility === "scheduled" ? (
            <Field label="On sale from">
              <Input
                type="datetime-local"
                value={config.onSaleAt || ""}
                onChange={(e) => set({ onSaleAt: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        <SettingsList className="mt-4 border-t border-border pt-4">
          <SettingRow
            icon={KeyRound}
            title="Access-code gating"
            description="Hide this ticket until a buyer enters an unlock code."
            checked={!!access.enabled}
            onCheckedChange={(v) => setAccess({ enabled: v })}
          />
          {/* The code belongs to the gating toggle above it, so it sits inside
              the same list — indented past the row icon (2rem + 0.75rem gap)
              to line up with the row's own title text. */}
          {access.enabled ? (
            <div className="py-3.5 pl-11">
              <Field label="Unlock code" hint="Share this with invited buyers only.">
                <Input
                  value={access.code || ""}
                  onChange={(e) => setAccess({ code: e.target.value })}
                  placeholder="e.g. INSIDER25"
                  className="w-full uppercase sm:max-w-xs"
                />
              </Field>
            </div>
          ) : null}
          <SettingRow
            icon={Armchair}
            title="Reserved seating"
            description="Buyers pick a seat from a map instead of general admission."
            checked={!!config.reservedSeating}
            onCheckedChange={(v) => set({ reservedSeating: v })}
          />
        </SettingsList>
      </SectionCard>
    </div>
  );
}

function QuestionsSection({ config, setConfig }) {
  return <TicketQuestionsEditor config={config} setConfig={setConfig} />;
}

// The active/inactive switch lives in the header, so it isn't repeated here.
const SECTIONS = [
  {
    key: "availability",
    label: "Availability",
    icon: CalendarClock,
    desc: "When this ticket goes on sale, and how many one buyer can purchase.",
    render: AvailabilitySection,
  },
  {
    key: "refunds",
    label: "Refund policy",
    icon: RotateCcw,
    desc: "Whether and when buyers can get their money back.",
    render: RefundSection,
  },
  {
    key: "access",
    label: "Visibility & access",
    icon: KeyRound,
    desc: "Who can see and unlock this ticket, and whether buyers pick a seat.",
    render: AccessSection,
  },
  {
    key: "questions",
    label: "Questions",
    icon: ListChecks,
    desc: "What you ask each attendee at checkout.",
    render: QuestionsSection,
  },
];

export function TicketTypesScreen() {
  return (
    <RecordsScreen
      module="ticket_type"
      title="Ticket Types"
      description="Reusable rule sets — refund policy, sales window, visibility, and questions. Apply one to an event's tickets from the event editor."
      singular="ticket"
      icon={Ticket}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default TicketTypesScreen;
