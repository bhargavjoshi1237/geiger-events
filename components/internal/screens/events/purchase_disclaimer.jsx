"use client";

import React from "react";
import { ChevronRight, Loader2, Zap } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useEventConfig } from "@/lib/events/use-event-config";
import { PURCHASE_DISCLAIMER_DEFAULTS } from "@/lib/events/purchase_disclaimer";
import { EXPRESS_NAME, expressConfig } from "@/lib/events/express_checkout";
import { PurchaseGateInline } from "./public_page/checkout/purchase_gate";

const APPLIES_OPTIONS = [
  { value: "all", label: "Every order — paid, free and approval requests" },
  { value: "paid", label: "Paid orders only" },
];

// Static replica of the Review step's right column: the terms above the pay button.
function GatePreview({ cfg }) {
  const [checked, setChecked] = React.useState(false);
  const ready = !cfg.requireCheck || checked;
  return (
    <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
      {String(cfg.text || "").trim() ? (
        <PurchaseGateInline cfg={cfg} checked={checked} onCheckedChange={setChecked} />
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-tertiary">
          Your disclaimer text will appear here.
        </p>
      )}
      <Button
        disabled={!ready}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {cfg.requireCheck ? (
          <>
            Continue To Payment <ChevronRight className="h-4 w-4" />
          </>
        ) : (
          cfg.confirmLabel || "Agree & continue"
        )}
      </Button>
    </div>
  );
}

export function PurchaseDisclaimerSection({ event, headerItem, onPatch }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(
    event,
    "purchaseDisclaimer",
    PURCHASE_DISCLAIMER_DEFAULTS,
    onPatch,
  );
  const view = { ...PURCHASE_DISCLAIMER_DEFAULTS, ...cfg };
  const set = (key) => (value) => setCfg({ ...view, [key]: value });
  const expressOn = expressConfig(event).enabled;

  const save = () => saveCfg(view, { successMsg: "Purchase disclaimer saved." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Purchase Disclaimer"}
        description={
          headerItem?.desc ||
          "The last thing buyers see before they pay — they acknowledge it to continue."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Disclaimer"}
          </Button>
        }
      />

      <SectionCard
        title="Gate"
        description="Shown on a final Review step beside the order summary; the pay button stays off until it's accepted."
      >
        <SettingsList>
          <SettingRow
            title="Ask buyers to acknowledge before buying"
            description="Checkout won't continue to payment until they accept."
            checked={!!view.enabled}
            onCheckedChange={(v) => set("enabled")(v)}
          />
          <SettingRow
            title="Require a tick-box"
            description="Buyers must tick to agree. Off makes the pay button itself the acceptance."
            checked={!!view.requireCheck}
            onCheckedChange={(v) => set("requireCheck")(v)}
          />
        </SettingsList>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Applies to">
            <Select value={view.appliesTo} onValueChange={(v) => set("appliesTo")(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLIES_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {view.enabled && !String(view.text || "").trim() ? (
          <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
            Add some text below — an empty disclaimer never shows.
          </p>
        ) : null}
        {expressOn ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-text-secondary">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {view.requireCheck
              ? `${EXPRESS_NAME} shows this inline above Pay — the tick-box makes it 3 clicks instead of 2.`
              : `${EXPRESS_NAME} shows this inline above Pay — paying counts as acceptance, so it stays at 2 clicks.`}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Wording"
        description="Every line of the disclaimer becomes its own paragraph."
      >
        <div className="grid gap-4">
          <Field label="Heading">
            <Input
              value={view.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Before you buy"
            />
          </Field>
          <Field label="Disclaimer">
            <Textarea
              rows={6}
              value={view.text}
              onChange={(e) => set("text")(e.target.value)}
              placeholder="All sales are final. Tickets are non-refundable except where the event is cancelled. Under-16s must be accompanied by an adult."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {view.requireCheck ? (
              <Field label="Tick-box label">
                <Input
                  value={view.checkLabel}
                  onChange={(e) => set("checkLabel")(e.target.value)}
                  placeholder="I have read and agree to the above"
                />
              </Field>
            ) : null}
            {view.requireCheck ? null : (
              <Field label="Pay button">
                <Input
                  value={view.confirmLabel}
                  onChange={(e) => set("confirmLabel")(e.target.value)}
                  placeholder="Agree & continue"
                />
              </Field>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard bare title="Preview" description="What buyers see beside their order summary before they pay.">
        <div className="rounded-xl border border-border bg-surface-subtle p-6">
          <GatePreview cfg={view} />
        </div>
      </SectionCard>
    </div>
  );
}

export default PurchaseDisclaimerSection;
