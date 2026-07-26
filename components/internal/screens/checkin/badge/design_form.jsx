"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PAGE_PRESETS,
  QR_POSITION_OPTIONS,
  STOCK_PRESETS,
  sheetGrid,
  stockSize,
} from "@/lib/passes/stock";
import { qrErrorCorrection } from "@/lib/passes/qr";

const FIELD_LABELS = {
  eventName: ["Event name", "Small accent line above the attendee."],
  name: ["Attendee name", "The largest line on the pass."],
  company: ["Company / role", "Only prints when the answer was collected."],
  tier: ["Ticket tier", "A coloured pill — handy when one design serves several tiers."],
  seat: ["Assigned seat", "Section, row and seat. Only prints for events with a seat map."],
  ticketCode: ["Ticket code", "Short code staff can type if a scan fails."],
  date: ["Event date", "Printed beside the code."],
  qr: ["QR code", "The scannable credential. Turning this off makes the pass visual only."],
};

// Hex swatch + text entry. The native picker keeps colour choice quick without
// pulling in a colour-picker component.
function ColorField({ label, hint, value, onChange, fallback }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-surface-card p-1"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
        />
      </div>
    </Field>
  );
}

function NumberField({ label, hint, value, onChange, min, max, step = 1, suffix }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pr-10" : ""}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

// The editor for the selected template. `onChange` shallow-merges a patch, so
// nested groups are passed back whole.
export function DesignForm({ template, availableTiers, qrSettings, onChange }) {
  const [tierDraft, setTierDraft] = useState("");
  const patch = (p) => onChange(p);
  const patchIn = (key, sub) => onChange({ [key]: { ...(template[key] || {}), ...sub } });

  const stock = template.stock || {};
  const sheet = template.sheet || {};
  const fields = template.fields || {};
  const qr = template.qr || {};
  const tiers = Array.isArray(template.tiers) ? template.tiers : [];
  const grid = sheetGrid(sheet, stock);
  const { wMm, hMm } = stockSize(stock);
  const ec = qrErrorCorrection(qrSettings);
  // Only Q and H tolerate the modules a centre logo knocks out.
  const centreLogoAllowed = ec === "Q" || ec === "H";

  const toggleTier = (tier) => {
    const has = tiers.some((t) => t.toLowerCase() === tier.toLowerCase());
    patch({ tiers: has ? tiers.filter((t) => t.toLowerCase() !== tier.toLowerCase()) : [...tiers, tier] });
  };

  const addTier = () => {
    const value = tierDraft.trim();
    if (!value) return;
    if (!tiers.some((t) => t.toLowerCase() === value.toLowerCase())) {
      patch({ tiers: [...tiers, value] });
    }
    setTierDraft("");
  };

  const unlisted = availableTiers.filter(
    (t) => !tiers.some((x) => x.toLowerCase() === t.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <SectionCard title="Identity" description="What this design is called and who it prints for.">
        <div className="space-y-4">
          <Field label="Template name">
            <Input
              value={template.name || ""}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. VIP lanyard"
            />
          </Field>

          <Field
            label="Ticket tiers"
            hint="Bound by tier name, so one design follows a tier across events. Unmatched attendees fall back to the default template."
          >
            <div className="space-y-2">
              {tiers.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {tiers.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => toggleTier(tier)}
                      className="flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs text-foreground"
                    >
                      {tier}
                      <X className="h-3 w-3 text-text-tertiary" />
                    </button>
                  ))}
                </div>
              ) : null}

              {unlisted.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {unlisted.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => toggleTier(tier)}
                      className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-foreground"
                    >
                      + {tier}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Input
                  value={tierDraft}
                  onChange={(e) => setTierDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTier();
                    }
                  }}
                  placeholder="Add a tier name…"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={addTier}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Stock" description="The physical size each pass is cut to.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preset" className="sm:col-span-2">
            <Select
              value={stock.preset || "name-badge"}
              onValueChange={(preset) => {
                const found = STOCK_PRESETS.find((p) => p.value === preset);
                patchIn("stock", {
                  preset,
                  ...(found && preset !== "custom" ? { wMm: found.wMm, hMm: found.hMm } : {}),
                });
              }}
            >
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — {p.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {stock.preset === "custom" ? (
            <>
              <NumberField
                label="Width"
                value={stock.wMm ?? 90}
                onChange={(v) => patchIn("stock", { wMm: Number(v) })}
                min={20}
                max={500}
                suffix="mm"
              />
              <NumberField
                label="Height"
                value={stock.hMm ?? 60}
                onChange={(v) => patchIn("stock", { hMm: Number(v) })}
                min={20}
                max={500}
                suffix="mm"
              />
            </>
          ) : (
            <p className="text-sm text-text-secondary sm:col-span-2">
              {wMm} × {hMm} mm
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Sheet layout" description="How passes are laid out on the printed page.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Page">
            <Select value={sheet.page || "a4"} onValueChange={(page) => patchIn("sheet", { page })}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <NumberField
            label="Margin"
            value={sheet.marginMm ?? 10}
            onChange={(v) => patchIn("sheet", { marginMm: Number(v) })}
            min={0}
            max={40}
            suffix="mm"
          />
          <NumberField
            label="Gutter"
            value={sheet.gutterMm ?? 4}
            onChange={(v) => patchIn("sheet", { gutterMm: Number(v) })}
            min={0}
            max={30}
            suffix="mm"
          />
        </div>
        <div className="mt-4">
          <SettingsList>
            <SettingRow
              title="Crop marks"
              description="Corner guides to cut against."
              checked={!!sheet.cropMarks}
              onCheckedChange={(v) => patchIn("sheet", { cropMarks: v })}
            />
          </SettingsList>
        </div>
        <p className="mt-3 text-xs text-text-tertiary">
          {grid.cols} across × {grid.rows} down — {grid.perPage} per page.
        </p>
      </SectionCard>

      <SectionCard title="Style" description="Colours and branding.">
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            label="Accent"
            hint="Top band, event name, tier pill."
            value={template.accent}
            fallback="#6366f1"
            onChange={(v) => patch({ accent: v })}
          />
          <ColorField
            label="Background"
            value={template.bg}
            fallback="#ffffff"
            onChange={(v) => patch({ bg: v })}
          />
          <ColorField
            label="Text"
            value={template.textColor}
            fallback="#111111"
            onChange={(v) => patch({ textColor: v })}
          />
        </div>
        <div className="mt-4">
          <SettingsList>
            <SettingRow
              title="Show logo"
              description="Printed in the top-right corner."
              checked={!!template.showLogo}
              onCheckedChange={(v) => patch({ showLogo: v })}
            />
          </SettingsList>
        </div>
        {template.showLogo ? (
          <div className="mt-4">
            <Field
              label="Logo URL"
              hint="Must allow cross-origin reads, otherwise PNG export can't include it."
            >
              <Input
                value={template.logoUrl || ""}
                onChange={(e) => patch({ logoUrl: e.target.value })}
                placeholder="https://…/logo.png"
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Fields" description="What prints on each pass.">
        <SettingsList>
          {Object.entries(FIELD_LABELS).map(([key, [title, description]]) => (
            <SettingRow
              key={key}
              title={title}
              description={description}
              checked={fields[key] !== false}
              onCheckedChange={(v) => patchIn("fields", { [key]: v })}
            />
          ))}
        </SettingsList>
      </SectionCard>

      <SectionCard title="QR code" description="Size and placement of the scannable code.">
        <div className={cn("grid gap-4 sm:grid-cols-2", fields.qr === false && "opacity-50")}>
          <NumberField
            label="Size"
            hint="Below ~15 mm, phone scanners struggle at arm's length."
            value={qr.sizeMm ?? 18}
            onChange={(v) => patchIn("qr", { sizeMm: Number(v) })}
            min={8}
            max={Math.floor(Math.min(wMm, hMm))}
            suffix="mm"
          />
          <Field label="Position">
            <Select
              value={qr.position || "bottom-right"}
              onValueChange={(position) => patchIn("qr", { position })}
            >
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QR_POSITION_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {fields.qr === false ? (
          <p className="mt-3 text-xs text-amber-400">
            QR is off — these passes cannot be scanned at the door.
          </p>
        ) : (
          <div className="mt-3 space-y-1 text-xs text-text-tertiary">
            <p>
              Colour and error correction ({ec}) come from Check-in → QR Tickets.
            </p>
            {qrSettings?.showLogo && !centreLogoAllowed ? (
              <p className="text-amber-400">
                QR Tickets asks for a centre logo, but error correction {ec} is too low to
                print one without risking the scan — raise it to Q or H there.
              </p>
            ) : null}
            {qrSettings?.showLogo && centreLogoAllowed && !template.logoUrl ? (
              <p>Set a logo URL under Style to place your mark in the centre of the code.</p>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default DesignForm;
