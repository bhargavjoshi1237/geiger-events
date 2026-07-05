"use client";

import React from "react";
import { Armchair, KeyRound, RotateCcw, Ticket } from "lucide-react";

import { Field, SectionCard, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";
import { currency, defaultTicketConfig, VISIBILITY_OPTIONS } from "./constants";

const KINDS = [{ value: "ticket", label: "Ticket", defaultConfig: defaultTicketConfig }];

// List-card summary line: "$25 · 200 cap · refundable".
function summarize(r) {
  const c = r.config || {};
  const price = Number(c.price) || 0;
  const qty = Number(c.qty) || 0;
  return [
    price === 0 ? "Free" : currency(price),
    qty > 0 ? `${qty.toLocaleString()} cap` : "unlimited",
    c.refund?.refundable ? "refundable" : "non-refundable",
  ].join(" · ");
}

function TicketEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const refund = config.refund || {};
  const sales = config.sales || {};
  const access = config.accessCode || {};
  const setRefund = (patch) => set({ refund: { ...refund, ...patch } });
  const setSales = (patch) => set({ sales: { ...sales, ...patch } });
  const setAccess = (patch) => set({ accessCode: { ...access, ...patch } });

  return (
    <div className="space-y-6">
      <SectionCard title="Pricing & inventory" description="What buyers pay and how many are available.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-text-secondary">$</span>
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={config.price ?? 0}
                onChange={(e) => set({ price: Number(e.target.value) || 0 })}
                className="tabular-nums"
                placeholder="0"
              />
            </div>
          </Field>
          <Num label="Quantity" hint="0 = unlimited." value={config.qty ?? 0} onChange={(v) => set({ qty: v })} unit="tickets" />
          <Num label="Min per order" value={config.minPerOrder ?? 1} onChange={(v) => set({ minPerOrder: v })} unit="tickets" />
          <Num label="Max per order" hint="0 = no limit." value={config.maxPerOrder ?? 0} onChange={(v) => set({ maxPerOrder: v })} unit="tickets" />
        </div>
        <div className="mt-4">
          <Field label="Description" hint="Shown to buyers under the ticket name.">
            <Textarea
              rows={2}
              value={config.description || ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. Includes front-row seating and after-party access."
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Refund policy" description="Whether and when buyers can get their money back.">
        <SettingsList>
          <SettingRow
            icon={RotateCcw}
            title="Refundable"
            description="Allow buyers to request a refund before the cutoff."
            checked={!!refund.refundable}
            onCheckedChange={(v) => setRefund({ refundable: v })}
          />
        </SettingsList>
        {refund.refundable ? (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Num label="Refund cutoff" hint="Days before the event refunds close." value={refund.cutoffDays ?? 7} onChange={(v) => setRefund({ cutoffDays: v })} unit="days" />
            <Field label="Processing fees" hint="Who absorbs the payment fees on a refund.">
              <Select value={refund.feeHandling || "absorb"} onValueChange={(v) => setRefund({ feeHandling: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="absorb">Refund in full</SelectItem>
                  <SelectItem value="deduct">Keep processing fees</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Sales window" description="When this ticket is on sale.">
        <Field label="Availability">
          <Segmented
            value={sales.mode || "always"}
            onChange={(v) => setSales({ mode: v })}
            options={[
              { value: "always", label: "Always on sale" },
              { value: "window", label: "Scheduled window" },
            ]}
          />
        </Field>
        {sales.mode === "window" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="On sale from">
              <Input type="datetime-local" value={sales.startAt || ""} onChange={(e) => setSales({ startAt: e.target.value })} />
            </Field>
            <Field label="On sale until">
              <Input type="datetime-local" value={sales.endAt || ""} onChange={(e) => setSales({ endAt: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Visibility & access" description="Who can see and unlock this ticket, and seating.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility">
            <Select value={config.visibility || "public"} onValueChange={(v) => set({ visibility: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {config.visibility === "scheduled" ? (
            <Field label="On sale from">
              <Input type="datetime-local" value={config.onSaleAt || ""} onChange={(e) => set({ onSaleAt: e.target.value })} />
            </Field>
          ) : null}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <SettingsList>
            <SettingRow
              icon={KeyRound}
              title="Access-code gating"
              description="Hide this ticket until a buyer enters an unlock code."
              checked={!!access.enabled}
              onCheckedChange={(v) => setAccess({ enabled: v })}
            />
            <SettingRow
              icon={Armchair}
              title="Reserved seating"
              description="Buyers pick a seat from a map instead of general admission."
              checked={!!config.reservedSeating}
              onCheckedChange={(v) => set({ reservedSeating: v })}
            />
          </SettingsList>
        </div>
        {access.enabled ? (
          <div className="mt-4 border-t border-border pt-4">
            <Field label="Unlock code" hint="Share this with invited buyers only.">
              <Input value={access.code || ""} onChange={(e) => setAccess({ code: e.target.value })} placeholder="e.g. INSIDER25" className="max-w-xs uppercase" />
            </Field>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function TicketTypesScreen() {
  return (
    <RecordsScreen
      module="ticket_type"
      title="Ticket Types"
      description="Reusable tickets. Create one here with its price, refund policy, and settings, then attach it to any event from its edit page."
      singular="ticket"
      icon={Ticket}
      kinds={KINDS}
      summarize={summarize}
      EditForm={TicketEditForm}
    />
  );
}

export default TicketTypesScreen;
