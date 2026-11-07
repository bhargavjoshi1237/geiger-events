"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Plus, Send, Sparkles, X } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { Field } from "@geiger/ui";
import { cn } from "@/lib/utils";
import {
  LINE_CATEGORIES,
  bidTotals,
  formatMoney,
  formatDay,
  lineCategoryLabel,
  normalizeConcessions,
  normalizeLineItems,
  rowKey,
  suggestedLineItems,
  toNumber,
  validateBidDraft,
} from "@/lib/sourcing/rfp_model";

const str = (v) => (v === null || v === undefined ? "" : String(v));

// Editable draft from the venue's current bid, or line items suggested by the brief.
export function draftFromBid(bid, rfp) {
  if (bid) {
    return {
      submittedByName: bid.submittedByName || "",
      lineItems: normalizeLineItems(bid.lineItems).map((l) => ({ ...l, id: rowKey("l"), qty: str(l.qty), unitPrice: str(l.unitPrice) })),
      taxesFees: str(bid.taxesFees || ""),
      capacity: str(bid.capacity),
      concessionsText: normalizeConcessions(bid.concessions).join("\n"),
      depositPct: str(bid.depositPct),
      attritionPct: str(bid.attritionPct),
      cancellationPolicy: bid.cancellationPolicy || "",
      availabilityNotes: bid.availabilityNotes || "",
      validUntil: bid.validUntil ? String(bid.validUntil).slice(0, 10) : "",
      message: bid.message || "",
    };
  }
  return {
    submittedByName: "",
    lineItems: suggestedLineItems(rfp).map((l) => ({ ...l, qty: str(l.qty), unitPrice: "" })),
    taxesFees: "",
    capacity: "",
    concessionsText: "",
    depositPct: "",
    attritionPct: "",
    cancellationPolicy: "",
    availabilityNotes: "",
    validUntil: "",
    message: "",
  };
}

const toSubmit = (draft) => ({
  ...draft,
  concessions: String(draft.concessionsText || "").split("\n"),
});

function LineItemRow({ item, currency, onChange, onRemove, canRemove }) {
  const qty = toNumber(item.qty) ?? 0;
  const price = toNumber(item.unitPrice) ?? 0;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-card p-3 sm:grid-cols-[150px_minmax(0,1fr)_84px_120px_120px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
      <div className="order-1 sm:order-none">
        <Select value={item.category} onValueChange={(v) => onChange({ category: v })}>
          <SelectTrigger className="w-full bg-surface-card" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
        <Input
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={`${lineCategoryLabel(item.category)} — what's included`}
          aria-label="Description"
          className="bg-surface-card"
        />
      </div>
      <div className="order-4 sm:order-none">
        <Input
          type="number"
          min="0"
          inputMode="decimal"
          value={item.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          placeholder="Qty"
          aria-label="Quantity"
          className="bg-surface-card tabular-nums"
        />
      </div>
      <div className="order-5 sm:order-none">
        <Input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={item.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value })}
          placeholder="Unit price"
          aria-label="Unit price"
          className="bg-surface-card tabular-nums"
        />
      </div>
      <div className="order-2 flex items-center justify-end gap-1 sm:order-none">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatMoney(Math.round(qty * price * 100) / 100, currency, { cents: true })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-text-tertiary hover:text-foreground"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label="Remove line"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// The venue's structured proposal: priced line items with live totals, concessions, terms and validity.
export function BidForm({ rfp, initialDraft, submitting, onSubmit, onCancel, onDecline, error }) {
  const [draft, setDraft] = useState(initialDraft);
  const [localError, setLocalError] = useState("");
  const currency = rfp?.currency || "USD";
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (id, patch) =>
    setDraft((d) => ({ ...d, lineItems: d.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addItem = (category = "other") =>
    setDraft((d) => ({
      ...d,
      lineItems: [...d.lineItems, { id: rowKey("l"), category, label: "", qty: "1", unitPrice: "" }],
    }));
  const removeItem = (id) => setDraft((d) => ({ ...d, lineItems: d.lineItems.filter((l) => l.id !== id) }));
  const prefill = () =>
    setDraft((d) => ({
      ...d,
      lineItems: [
        ...d.lineItems.filter((l) => String(l.label).trim() || toNumber(l.unitPrice)),
        ...suggestedLineItems(rfp).map((l) => ({ ...l, qty: str(l.qty), unitPrice: "" })),
      ],
    }));

  const totals = useMemo(
    () =>
      bidTotals(
        draft.lineItems.map((l) => ({ qty: toNumber(l.qty) ?? 0, unitPrice: toNumber(l.unitPrice) ?? 0 })),
        toNumber(draft.taxesFees) ?? 0,
      ),
    [draft.lineItems, draft.taxesFees],
  );
  const pax = Number(rfp?.attendees) || 0;

  const submit = (e) => {
    e.preventDefault();
    const payload = toSubmit(draft);
    const problem = validateBidDraft(payload);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError("");
    onSubmit(payload);
  };

  const shownError = localError || error;

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection
        title="Pricing"
        description={`Price each line in ${currency}. Totals update as you type; the organiser sees exactly these lines.`}
      >
        <div className="hidden grid-cols-[150px_minmax(0,1fr)_84px_120px_120px] gap-2 px-0.5 text-xs font-medium text-text-secondary sm:grid">
          <span>Category</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="pr-10 text-right">Line total</span>
        </div>
        <div className="space-y-2">
          {draft.lineItems.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              currency={currency}
              canRemove={draft.lineItems.length > 1}
              onChange={(patch) => setItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addItem()}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-text-secondary" onClick={prefill}>
            <Sparkles className="h-4 w-4" /> Add lines from the brief
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px]">
          <Field label="Taxes, service & fees" hint="Anything charged on top of the lines above.">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.taxesFees}
              onChange={(e) => set({ taxesFees: e.target.value })}
              placeholder="0"
              className="bg-surface-card tabular-nums"
            />
          </Field>
          <div className="space-y-1.5 rounded-lg border border-border bg-surface-card p-4 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotal, currency, { cents: true })}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Taxes &amp; fees</span>
              <span className="tabular-nums">{formatMoney(totals.taxesFees, currency, { cents: true })}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.total, currency, { cents: true })}</span>
            </div>
            {pax > 0 && totals.total > 0 ? (
              <p className="text-right text-xs text-text-tertiary">
                {formatMoney(totals.total / pax, currency, { cents: true })} per attendee
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="Space & concessions" description="What you can hold and what you'll include at no charge.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Largest group the offered space holds" hint={pax ? `The brief asks for ${pax.toLocaleString("en-US")}.` : undefined}>
            <Input
              type="number"
              min="0"
              inputMode="numeric"
              value={draft.capacity}
              onChange={(e) => set({ capacity: e.target.value })}
              placeholder="e.g. 350"
              className="bg-surface-card tabular-nums"
            />
          </Field>
          <Field label="Offer valid until" hint={rfp?.decisionDate ? `They decide by ${formatDay(rfp.decisionDate)}.` : undefined}>
            <Input
              type="date"
              value={draft.validUntil}
              onChange={(e) => set({ validUntil: e.target.value })}
              className="bg-surface-card"
            />
          </Field>
        </div>
        <Field label="Concessions" hint="One per line — e.g. complimentary Wi-Fi, 1 comp room per 40 booked, free parking.">
          <Textarea
            rows={4}
            value={draft.concessionsText}
            onChange={(e) => set({ concessionsText: e.target.value })}
            placeholder={"Complimentary Wi-Fi\nWelcome drinks for the organising team"}
            className="bg-surface-card"
          />
        </Field>
      </FormSection>

      <FormSection title="Terms" description="The commercial terms behind the price.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deposit (%)" hint="Share of the total due on signing.">
            <Input
              type="number"
              min="0"
              max="100"
              inputMode="decimal"
              value={draft.depositPct}
              onChange={(e) => set({ depositPct: e.target.value })}
              placeholder="e.g. 25"
              className="bg-surface-card tabular-nums"
            />
          </Field>
          <Field label="Attrition allowance (%)" hint="Share of the room block that can be released without penalty.">
            <Input
              type="number"
              min="0"
              max="100"
              inputMode="decimal"
              value={draft.attritionPct}
              onChange={(e) => set({ attritionPct: e.target.value })}
              placeholder="e.g. 20"
              className="bg-surface-card tabular-nums"
            />
          </Field>
        </div>
        <Field label="Cancellation policy">
          <Textarea
            rows={3}
            value={draft.cancellationPolicy}
            onChange={(e) => set({ cancellationPolicy: e.target.value })}
            placeholder="e.g. Free cancellation until 90 days out, 50% within 90 days, 100% within 30 days."
            className="bg-surface-card"
          />
        </Field>
      </FormSection>

      <FormSection title="Availability & notes">
        <Field label="Availability" hint="Confirm the dates, or offer alternatives if they're taken.">
          <Textarea
            rows={3}
            value={draft.availabilityNotes}
            onChange={(e) => set({ availabilityNotes: e.target.value })}
            placeholder="e.g. Both dates are available and on a first-option hold until the deadline."
            className="bg-surface-card"
          />
        </Field>
        <Field label="Message to the organiser">
          <Textarea
            rows={3}
            value={draft.message}
            onChange={(e) => set({ message: e.target.value })}
            className="bg-surface-card"
          />
        </Field>
        <Field label="Your name">
          <Input
            value={draft.submittedByName}
            onChange={(e) => set({ submittedByName: e.target.value })}
            placeholder="Who should the organiser follow up with?"
            className="bg-surface-card"
          />
        </Field>
      </FormSection>

      {shownError ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {shownError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" className="text-text-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
          {onDecline ? (
            <Button type="button" variant="ghost" className="text-text-secondary" onClick={onDecline} disabled={submitting}>
              Decline to bid
            </Button>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className={cn("bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit proposal · {formatMoney(totals.total, currency)}
        </Button>
      </div>
    </form>
  );
}

// Read-only view of a submitted bid.
export function BidSummary({ bid, currency: currencyProp, attendees }) {
  if (!bid) return null;
  const currency = bid.currency || currencyProp || "USD";
  const items = normalizeLineItems(bid.lineItems);
  const concessions = normalizeConcessions(bid.concessions);
  const terms = [
    bid.depositPct != null ? `${bid.depositPct}% deposit` : "",
    bid.attritionPct != null ? `${bid.attritionPct}% attrition allowance` : "",
    bid.capacity ? `Holds ${Number(bid.capacity).toLocaleString("en-US")}` : "",
    bid.validUntil ? `Valid until ${formatDay(bid.validUntil)}` : "",
  ].filter(Boolean);
  const pax = Number(attendees) || 0;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-card text-left text-xs text-text-secondary">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <span className="text-foreground">{l.label || lineCategoryLabel(l.category)}</span>
                  <span className="block text-xs text-text-tertiary">{lineCategoryLabel(l.category)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{l.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                  {formatMoney(l.unitPrice, currency, { cents: true })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatMoney(l.total, currency, { cents: true })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr className="border-t border-border">
              <td colSpan={3} className="px-3 py-1.5 text-right text-text-secondary">Subtotal</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(bid.subtotal, currency, { cents: true })}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-right text-text-secondary">Taxes &amp; fees</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(bid.taxesFees, currency, { cents: true })}</td>
            </tr>
            <tr className="font-semibold text-foreground">
              <td colSpan={3} className="px-3 py-1.5 text-right">
                Total{pax > 0 && bid.total ? ` · ${formatMoney(bid.total / pax, currency, { cents: true })} per attendee` : ""}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(bid.total, currency, { cents: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {terms.length ? (
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <span key={t} className="rounded-md border border-border bg-surface-card px-2.5 py-1 text-xs text-text-secondary">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {concessions.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Concessions</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
            {concessions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {[
        ["Cancellation", bid.cancellationPolicy],
        ["Availability", bid.availabilityNotes],
        ["Message", bid.message],
      ]
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <div key={label}>
            <p className="mb-1 text-xs font-medium text-text-secondary">{label}</p>
            <p className="whitespace-pre-line text-sm text-foreground">{v}</p>
          </div>
        ))}
    </div>
  );
}
