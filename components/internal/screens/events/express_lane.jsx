"use client";

import React, { useState } from "react";
import { CircleCheck, CircleX, Loader2, MousePointerClick, Zap } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { earlybirdReduction } from "@/lib/events/earlybird";
import { activePurchaseDisclaimer } from "@/lib/events/purchase_disclaimer";
import {
  EXPRESS_DEFAULTS,
  EXPRESS_NAME,
  EXPRESS_PLACEMENTS,
  expressBlockers,
  expressClicks,
  expressTickets,
} from "@/lib/events/express_checkout";
import { ExpressSheet } from "./public_page/checkout/express_step";

const PREVIEW_ACCENT = { color: "var(--primary)", text: "var(--primary-foreground)" };

function publicTickets(event) {
  return (Array.isArray(event?.tickets) ? event.tickets : [])
    .filter((t) => (t.rules?.visibility || "public") !== "hidden")
    .map((t) => ({ ...t, price: Number(t.price) || 0 }));
}

function ClickBudget({ clicks, ready, onNavigate }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-card">
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{clicks}</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          clicks
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {ready ? `Page → Stripe in ${clicks} clicks` : "Not live on your page yet"}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {clicks > 2
            ? "Your purchase disclaimer's tick-box adds one. Turn the tick-box off there to get back to 2."
            : "One to open Express Lane, one to pay — name, email and card are taken by Stripe."}
          {clicks > 2 && onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("purchasedisclaimer")}
              className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open Purchase Disclaimer
            </button>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function ReadinessRow({ ok, label, hint, onFix }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-text-tertiary">{hint}</span> : null}
      </span>
      {onFix ? (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={onFix}
        >
          Fix
        </Button>
      ) : null}
    </li>
  );
}

export function ExpressLaneSection({ event, headerItem, onPatch, onNavigate }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(event, "express", EXPRESS_DEFAULTS, onPatch);
  const view = { ...EXPRESS_DEFAULTS, ...cfg };
  const set = (key) => (value) => setCfg({ ...view, [key]: value });
  const save = () => saveCfg(view, { successMsg: `${EXPRESS_NAME} saved.` });

  const tickets = publicTickets(event);
  const eligible = expressTickets(event, tickets);
  const blockers = expressBlockers(event);
  const clicks = expressClicks(event);
  const ready = view.enabled && !blockers.length && eligible.length > 0;
  const gate = activePurchaseDisclaimer(event, { isFree: false });

  const [previewTicket, setPreviewTicket] = useState(null);
  const [previewQty, setPreviewQty] = useState(1);
  const [gateChecked, setGateChecked] = useState(false);
  const defaultTicket =
    eligible.find((t) => String(t.id) === String(view.defaultTicket)) || eligible[0] || null;
  const shown =
    eligible.find((t) => String(t.id) === String(previewTicket)) || defaultTicket;
  const maxQty = view.allowQuantity ? Math.max(1, Number(view.maxQty) || 1) : 1;
  const qty = Math.min(previewQty, maxQty);
  const unit = shown?.price || 0;
  const effUnit = Math.max(0, unit - (shown ? earlybirdReduction(event, unit) : 0));

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || EXPRESS_NAME}
        description={
          headerItem?.desc ||
          "A 2-click checkout: buyers pick a ticket and pay, and they're on Stripe."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <SectionCard
        title={EXPRESS_NAME}
        description="Skips the details form entirely. Stripe collects the buyer's name, email and card on its hosted page."
      >
        <SettingsList>
          <SettingRow
            icon={Zap}
            title={`Enable ${EXPRESS_NAME}`}
            description="Adds the express route to your tickets card."
            checked={!!view.enabled}
            onCheckedChange={(v) => set("enabled")(v)}
          />
        </SettingsList>
        <div className="mt-4">
          <ClickBudget clicks={clicks} ready={ready} onNavigate={onNavigate} />
        </div>
      </SectionCard>

      <SectionCard
        title="Readiness"
        description={`${EXPRESS_NAME} only runs when nothing needs typing in. Anything listed in amber sends buyers to the full checkout instead.`}
      >
        <ul className="divide-y divide-border">
          <ReadinessRow
            ok={eligible.length > 0}
            label={
              eligible.length
                ? `${eligible.length} of ${tickets.length} ticket${tickets.length === 1 ? "" : "s"} can go express`
                : "No paid, in-stock tickets"
            }
            hint="Free and sold-out tickets always use the full checkout."
          />
          {blockers.length ? (
            blockers.map((b) => (
              <ReadinessRow
                key={b.id}
                ok={false}
                label={b.label}
                hint={`Change it in ${b.section}.`}
                onFix={onNavigate ? () => onNavigate(b.key) : undefined}
              />
            ))
          ) : (
            <ReadinessRow ok label="No required fields, seat picks or approvals in the way" />
          )}
          <ReadinessRow
            ok
            label="Required per-ticket questions"
            hint="Checked when a buyer pays — a ticket that has them hops to the full checkout."
          />
        </ul>
      </SectionCard>

      <SectionCard title="Entry point" description="How buyers get into Express Lane from your page.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Placement">
            <Select value={view.placement} onValueChange={(v) => set("placement")(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPRESS_PLACEMENTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {view.placement === "alongside" ? (
            <Field label="Button label">
              <Input
                value={view.buttonLabel}
                onChange={(e) => set("buttonLabel")(e.target.value)}
                placeholder="Express checkout"
              />
            </Field>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          {view.placement === "replace"
            ? "Every Get Tickets button — sidebar, sticky bar, hero — opens Express Lane first, with a link to the full checkout."
            : "A second button sits under Get Tickets on the tickets card. Get Tickets keeps the full checkout."}
        </p>
      </SectionCard>

      <SectionCard
        title="Express screen"
        description="What buyers can adjust before paying. Each adjustment is optional — the 2-click path never needs them."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tagline">
            <Input
              value={view.tagline}
              onChange={(e) => set("tagline")(e.target.value)}
              placeholder="Two clicks to your tickets"
            />
          </Field>
          <Field label="Pre-selected ticket">
            <Select
              value={String(view.defaultTicket)}
              onValueChange={(v) => set("defaultTicket")(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">Whichever is selected on the page</SelectItem>
                {eligible.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} — ${t.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SettingsList className="mt-4">
          <SettingRow
            title="Let buyers switch ticket"
            description="Lists every express-eligible ticket to pick from."
            checked={!!view.allowTicketSwitch}
            onCheckedChange={(v) => set("allowTicketSwitch")(v)}
          />
          <SettingRow
            title="Let buyers change quantity"
            description="Off sells exactly one ticket per express order."
            checked={!!view.allowQuantity}
            onCheckedChange={(v) => set("allowQuantity")(v)}
          />
          <SettingRow
            title="Ask for the buyer's name on Stripe"
            description="Stripe's checkout requires a full name alongside the email."
            checked={!!view.collectName}
            onCheckedChange={(v) => set("collectName")(v)}
          />
          <SettingRow
            title="Pre-fill signed-in buyers"
            description="Members already signed in skip typing their email on Stripe."
            checked={!!view.prefillSignedIn}
            onCheckedChange={(v) => set("prefillSignedIn")(v)}
          />
          <SettingRow
            title="Offer the full checkout"
            description="A link for buyers who want add-ons, a promo code or a time slot."
            checked={!!view.showFullCheckout}
            onCheckedChange={(v) => set("showFullCheckout")(v)}
          />
        </SettingsList>

        {view.allowQuantity ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Most tickets per order"
              hint="Capped below your group-order minimum, if group orders are on."
              stepper
              value={view.maxQty}
              onValueChange={(v) => set("maxQty")(Number(v))}
              min={1}
              max={20}
            >
              <Input
                type="number"
                min={1}
                max={20}
                value={view.maxQty}
                onChange={(e) => set("maxQty")(Number(e.target.value) || 1)}
                className="tabular-nums"
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard bare title="Preview" description="The express screen exactly as buyers get it — click 2 is the Pay button.">
        <div className="rounded-xl border border-border bg-surface-subtle p-6">
          <div
            className="ev-glow-pulse mx-auto w-full max-w-md rounded-2xl border border-border bg-surface-card p-5"
            style={{ "--ev-glow-color": PREVIEW_ACCENT.color }}
          >
            <p className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <MousePointerClick className="h-4 w-4 text-text-tertiary" />
              {EXPRESS_NAME}
            </p>
            {shown ? (
              <ExpressSheet
                cfg={view}
                tickets={eligible}
                ticketId={shown.id}
                onTicket={(id) => {
                  setPreviewTicket(id);
                  setPreviewQty(1);
                }}
                qty={qty}
                setQty={setPreviewQty}
                maxQty={maxQty}
                unitPrice={unit}
                effUnit={effUnit}
                total={effUnit * qty}
                gate={gate}
                gateChecked={gateChecked}
                setGateChecked={setGateChecked}
                clicks={clicks}
                onPay={() => {}}
                onFullCheckout={() => {}}
                accent={PREVIEW_ACCENT}
                accentStyle={{ backgroundColor: PREVIEW_ACCENT.color, color: PREVIEW_ACCENT.text }}
              />
            ) : (
              <p className="py-8 text-center text-xs text-text-tertiary">
                Add a paid ticket to preview {EXPRESS_NAME}.
              </p>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export default ExpressLaneSection;
