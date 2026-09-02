"use client";

import React from "react";
import {
  Keyboard,
  Percent,
  Receipt,
  Ticket,
  Wand2,
} from "lucide-react";

import {
  Field,
  SectionCard,
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
import { DiscountRuleEditor } from "./discount_rule_editor";
import {
  couponSummary,
  defaultCouponConfig,
  normalizeCoupon,
  ruleValueLabel,
} from "@/lib/events/discount_rules";

const KINDS = [
  {
    value: "coupon",
    label: "Coupon",
    defaultConfig: defaultCouponConfig(),
  },
  {
    value: "group",
    label: "Group rule",
    defaultConfig: { mode: "automatic", minQty: 5, percent: 10, code: "" },
  },
  {
    value: "earlybird",
    label: "Early-bird rule",
    defaultConfig: { until: "", percent: 15 },
  },
  {
    value: "affiliate",
    label: "Affiliate code",
    defaultConfig: { code: "", partner: "", commission: 0 },
  },
];

function summarize(r) {
  const c = r.config || {};
  if (r.kind === "coupon") return couponSummary(c);
  if (r.kind === "group")
    return `${c.mode === "manual" ? "Manual" : "Auto"} | ${c.percent}% at ${c.minQty}+`;
  if (r.kind === "earlybird")
    return `${c.percent}% off until ${c.until || "—"}`;
  if (r.kind === "affiliate")
    return `${c.code || "no code"} | ${c.partner || "unassigned"}`;
  return "";
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it. Each kind carries its
// own small set of fields, so the one section branches on `record.kind`.

// A coupon has three distinct layers, kept apart because they answer different
// questions:
//
//   Coupon       — the code, and the BASE discount used when no rule matches.
//   Eligibility  — gates. Failing one rejects the code outright; it never
//                  quietly falls back to a smaller discount.
//   Rules        — an ordered list deciding HOW MUCH the code gives. Top match
//                  wins, so the organiser drags the most specific rule up.
//
// Which TICKETS a code works on is not set here — coupons are ticked onto
// individual tickets from the event's Tickets tab, which is what keeps a code
// from leaking onto every ticket in the event.
function CouponSection({ config, setConfig }) {
  const c = normalizeCoupon(config);
  const set = (patch) => setConfig({ ...c, ...patch });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Coupon"
        description="A code buyers type at checkout. Tick it onto a ticket from the event's Tickets tab — that is what makes it redeemable."
      >
        <div className="space-y-4">
          <Field label="Code">
            <Input
              value={c.code || ""}
              onChange={(e) => set({ code: e.target.value })}
              placeholder="SAVE10"
              className="uppercase"
            />
          </Field>
          <Field
            label="Base discount"
            hint="What the code gives when no rule below matches."
          >
            <div className="flex items-center gap-2">
              <Select
                value={c.discountType}
                onValueChange={(v) => set({ discountType: v })}
              >
                <SelectTrigger className="flex-[3_1_0%]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% off</SelectItem>
                  <SelectItem value="flat">$ off</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={c.value ?? 0}
                onChange={(e) => set({ value: Number(e.target.value) || 0 })}
                className="tabular-nums flex-[7_1_0%]"
              />
            </div>
          </Field>
          {c.discountType === "flat" ? (
            <Field
              label="Flat applies"
              hint="Once against the order, or once for every ticket bought."
            >
              <Segmented
                value={c.applyPer}
                onChange={(v) => set({ applyPer: v })}
                options={[
                  { value: "order", label: "Once per order", icon: Receipt },
                  { value: "ticket", label: "Per ticket", icon: Ticket },
                ]}
              />
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Num
              label="Usage Limit"
              hint="0 = unlimited."
              value={c.usageLimit ?? 0}
              onChange={(v) => set({ usageLimit: v })}
              unit="uses"
              fullWidth
            />
            <Field label="Max discount" hint="Blank = uncapped.">
              <Input
                type="number"
                min={0}
                className="tabular-nums"
                value={c.maxDiscount ?? ""}
                onChange={(e) =>
                  set({
                    maxDiscount:
                      e.target.value === "" ? null : Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Eligibility"
        description="When the code works at all. Fail one of these and the buyer is told the code doesn't apply — it never falls back to a smaller discount."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Min. tickets" hint="Blank = any quantity.">
            <Input
              type="number"
              min={0}
              className="tabular-nums"
              value={c.minQty ?? ""}
              onChange={(e) =>
                set({
                  minQty:
                    e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Max. tickets" hint="Blank = no upper bound.">
            <Input
              type="number"
              min={0}
              className="tabular-nums"
              value={c.maxQty ?? ""}
              onChange={(e) =>
                set({
                  maxQty:
                    e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Valid from" hint="Blank = live immediately.">
            <Input
              type="datetime-local"
              value={c.validFrom || ""}
              onChange={(e) => set({ validFrom: e.target.value })}
            />
          </Field>
          <Field label="Valid until" hint="Blank = never expires.">
            <Input
              type="datetime-local"
              value={c.validUntil || ""}
              onChange={(e) => set({ validUntil: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Discount Rules"
        description="How much the code gives, by quantity and by date. Rules are checked top-down and the first match wins — drag the most specific one to the top."
      >
        <DiscountRuleEditor
          rules={c.rules}
          onChange={(rules) => set({ rules })}
          baseLabel={ruleValueLabel(c)}
        />
      </SectionCard>
    </div>
  );
}

function DiscountSection({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  if (record.kind === "coupon") {
    return <CouponSection config={config} setConfig={setConfig} />;
  }

  if (record.kind === "group") {
    return (
      <SectionCard
        title="Group Purchasing"
        description="Reward buyers who bring a crowd."
      >
        <Field
          label="Discount Mode"
          hint="Automatic applies at a quantity threshold; Manual gives groups a code."
        >
          <Segmented
            value={config.mode || "automatic"}
            onChange={(v) => set({ mode: v })}
            options={[
              { value: "automatic", label: "Automatic", icon: Wand2 },
              { value: "manual", label: "Manual code", icon: Keyboard },
            ]}
            className="w-fit"
          />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Num
            label="Min. Quantity"
            value={config.minQty ?? 5}
            onChange={(v) => set({ minQty: v })}
            unit="tickets"
            fullWidth
          />
          <Num
            label="Discount"
            value={config.percent ?? 10}
            onChange={(v) => set({ percent: v })}
            unit="%"
            fullWidth
          />
        </div>
        {/* The code only exists in manual mode, so it grows inside this card. */}
        {config.mode === "manual" ? (
          <div className="mt-4 border-t border-border pt-4">
            <Field label="Group Code">
              <Input
                value={config.code || ""}
                onChange={(e) => set({ code: e.target.value })}
                placeholder="TEAM"
                className="uppercase"
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>
    );
  }

  if (record.kind === "earlybird") {
    return (
      <SectionCard
        title="Early-Bird"
        description="A limited-time discount before a cut-off date."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Discount"
            value={config.percent ?? 15}
            onChange={(v) => set({ percent: v })}
            unit="%"
            fullWidth
          />
          <Field label="Available Until">
            <Input
              type="date"
              value={config.until || ""}
              onChange={(e) => set({ until: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>
    );
  }

  // affiliate
  return (
    <SectionCard
      title="Affiliate Code"
      description="A tracked code that attributes sales to a partner."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code">
          <Input
            value={config.code || ""}
            onChange={(e) => set({ code: e.target.value })}
            placeholder="PARTNER"
            className="uppercase"
          />
        </Field>
        <Field label="Partner Name">
          <Input
            value={config.partner || ""}
            onChange={(e) => set({ partner: e.target.value })}
            placeholder="e.g. City Radio"
          />
        </Field>
      </div>
      <div className="mt-4">
        <Num
          label="Commission"
          hint="Paid to the partner per sale."
          value={config.commission ?? 0}
          onChange={(v) => set({ commission: v })}
          unit="%"
          fullWidth
        />
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "discount",
    label: "Discount",
    icon: Percent,
    desc: "How this rule is applied at checkout.",
    render: DiscountSection,
  },
];

export function DiscountsScreen() {
  return (
    <RecordsScreen
      module="discount"
      title="Discounts & Codes"
      description="Reusable coupons and discount rules. Create them here, then attach to any event from its edit page."
      singular="discount"
      icon={Percent}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default DiscountsScreen;
