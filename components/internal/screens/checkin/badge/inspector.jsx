"use client";

import React, { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_PRESETS, STOCK_PRESETS, sheetGrid, stockSize } from "@/lib/passes/stock";
import { qrErrorCorrection } from "@/lib/passes/qr";
import {
  ALIGN_OPTIONS,
  BORDER_STYLES,
  FIELD_CATALOG,
  FONT_OPTIONS,
  IMAGE_FITS,
  defaultAdjust,
  defaultCardBorder,
  elementLabel,
} from "@/lib/passes/layout";

import { PanelSection, PanelRow, PanelDivider } from "./panel";
import { ImageField } from "./image_field";
import { ColorField, NumberField, SelectField, SliderField, TextField } from "./controls";

// Border controls, shared by the card and by a section.
function BorderControls({ border, onChange }) {
  const b = border || defaultCardBorder();
  return (
    <>
      <SelectField
        label="Style"
        value={b.style || "none"}
        onChange={(style) => onChange({ ...b, style })}
        options={BORDER_STYLES}
      />
      {b.style !== "none" ? (
        <>
          <NumberField
            label="Width"
            value={b.width ?? 0.5}
            onChange={(v) => onChange({ ...b, width: Number(v) })}
            min={0.1}
            max={5}
            step={0.1}
            suffix="mm"
          />
          <ColorField
            label="Border colour"
            value={b.color}
            fallback="#111111"
            onChange={(color) => onChange({ ...b, color })}
          />
        </>
      ) : null}
    </>
  );
}

// Figma-style artwork adjustments. Applied as real SVG filter primitives, so a
// tweaked photo exports to PNG exactly as previewed.
function AdjustControls({ el, patch }) {
  const a = { ...defaultAdjust(), ...(el.adjust || {}) };
  const set = (sub) => patch({ adjust: { ...a, ...sub } });
  return (
    <>
      <SliderField
        label="Brightness"
        value={a.brightness}
        onChange={(v) => set({ brightness: v })}
        min={0}
        max={200}
        suffix="%"
      />
      <SliderField
        label="Contrast"
        value={a.contrast}
        onChange={(v) => set({ contrast: v })}
        min={0}
        max={200}
        suffix="%"
      />
      <SliderField
        label="Saturation"
        value={a.saturation}
        onChange={(v) => set({ saturation: v })}
        min={0}
        max={200}
        suffix="%"
      />
      <SliderField
        label="Black & white"
        value={a.grayscale}
        onChange={(v) => set({ grayscale: v })}
        min={0}
        max={100}
        suffix="%"
      />
      <SliderField
        label="Blur"
        value={a.blur}
        onChange={(v) => set({ blur: v })}
        min={0}
        max={5}
        step={0.1}
        suffix="mm"
      />
      <ColorField
        label="Shade"
        hint="A flat colour laid over the artwork."
        value={a.tint}
        fallback="#000000"
        onChange={(tint) => set({ tint })}
      />
      <SliderField
        label="Shade strength"
        value={a.tintStrength}
        onChange={(v) => set({ tintStrength: v })}
        min={0}
        max={100}
        suffix="%"
      />
      <Button
        variant="outline"
        className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={() => patch({ adjust: defaultAdjust() })}
      >
        Reset adjustments
      </Button>
    </>
  );
}

// --- per-kind property forms --------------------------------------------------

function TextElementForm({ el, patch }) {
  return (
    <>
      <SelectField
        label="Field"
        value={el.field || "custom"}
        onChange={(field) => patch({ field })}
        options={FIELD_CATALOG.map((f) => ({ value: f.key, label: f.label }))}
      />
      {el.field === "custom" ? (
        <TextField
          label="Text"
          value={el.text}
          onChange={(text) => patch({ text })}
          placeholder="Text to print"
        />
      ) : null}
      <SelectField
        label="Font"
        value={el.font || "sans"}
        onChange={(font) => patch({ font })}
        options={FONT_OPTIONS}
      />
      <NumberField
        label="Size"
        value={el.size ?? 4}
        onChange={(v) => patch({ size: Number(v) })}
        min={1}
        max={40}
        step={0.5}
        suffix="mm"
      />
      <SelectField
        label="Align"
        value={el.align || "left"}
        onChange={(align) => patch({ align })}
        options={ALIGN_OPTIONS}
      />
      <NumberField
        label="Letter spacing"
        value={el.spacing ?? 0}
        onChange={(v) => patch({ spacing: Number(v) })}
        min={-1}
        max={4}
        step={0.05}
        suffix="mm"
      />
      <ColorField
        label="Colour"
        value={el.color}
        fallback="#111111"
        onChange={(color) => patch({ color })}
      />
      <PanelRow
        title="Bold"
        control={
          <Switch
            checked={el.weight === "bold"}
            onCheckedChange={(v) => patch({ weight: v ? "bold" : "regular" })}
          />
        }
      />
      <PanelRow
        title="Italic"
        control={<Switch checked={!!el.italic} onCheckedChange={(v) => patch({ italic: v })} />}
      />
      <PanelRow
        title="Uppercase"
        control={
          <Switch checked={!!el.uppercase} onCheckedChange={(v) => patch({ uppercase: v })} />
        }
      />
      <PanelRow
        title="Pill background"
        description="A rounded plate behind the text"
        control={<Switch checked={!!el.pill} onCheckedChange={(v) => patch({ pill: v })} />}
      />
      {el.pill ? (
        <ColorField
          label="Pill colour"
          value={el.pillFill}
          fallback="#6366f1"
          onChange={(pillFill) => patch({ pillFill })}
        />
      ) : null}
    </>
  );
}

function QrElementForm({ el, patch, qrSettings, onUpload, maxSize }) {
  const ec = qrErrorCorrection(qrSettings);
  const centreLogoAllowed = ec === "Q" || ec === "H";
  return (
    <>
      <SliderField
        label="Size"
        value={el.size ?? 18}
        onChange={(size) => patch({ size })}
        min={8}
        max={Math.max(9, Math.floor(maxSize))}
        suffix=" mm"
      />
      <ColorField
        label="Code colour"
        value={el.fg}
        fallback="#111111"
        onChange={(fg) => patch({ fg })}
      />
      <PanelRow
        title="Transparent background"
        description="Let the card show through the code"
        control={
          <Switch
            checked={!!el.bgTransparent}
            onCheckedChange={(bgTransparent) => patch({ bgTransparent })}
          />
        }
      />
      {el.bgTransparent ? (
        <p className="text-xs text-amber-400">
          Scanners need contrast — keep the code dark on a light background behind it, or
          invert the code colour on dark artwork.
        </p>
      ) : (
        <ColorField
          label="Code background"
          value={el.bg}
          fallback="#ffffff"
          onChange={(bg) => patch({ bg })}
        />
      )}
      <ImageField
        label="Centre mark"
        value={el.logoUrl}
        onChange={(logoUrl) => patch({ logoUrl })}
        onUpload={onUpload}
      />
      {!centreLogoAllowed && el.logoUrl ? (
        <p className="text-xs text-amber-400">
          Error correction {ec} is too low to print a centre mark safely — raise it to Q or H
          under Check-in → QR Tickets.
        </p>
      ) : (
        <p className="text-xs text-text-tertiary">
          Error correction ({ec}) comes from Check-in → QR Tickets.
        </p>
      )}
    </>
  );
}

function ImageElementForm({ el, patch, onUpload }) {
  return (
    <>
      <ImageField value={el.url} onChange={(url) => patch({ url })} onUpload={onUpload} />
      <SelectField
        label="Fit"
        value={el.fit || "contain"}
        onChange={(fit) => patch({ fit })}
        options={IMAGE_FITS}
      />
      <NumberField
        label="Corner radius"
        value={el.radius ?? 0}
        onChange={(v) => patch({ radius: Number(v) })}
        min={0}
        max={20}
        step={0.5}
        suffix="mm"
      />
    </>
  );
}

function BoxElementForm({ el, patch, onUpload }) {
  return (
    <>
      <TextField
        label="Section name"
        value={el.name}
        onChange={(name) => patch({ name })}
        placeholder="Section"
      />
      <ColorField
        label="Fill"
        value={el.fill}
        fallback="#6366f1"
        onChange={(fill) => patch({ fill })}
      />
      <NumberField
        label="Corner radius"
        value={el.radius ?? 0}
        onChange={(v) => patch({ radius: Number(v) })}
        min={0}
        max={20}
        step={0.5}
        suffix="mm"
      />
      <ImageField
        label="Section image"
        value={el.image}
        onChange={(image) => patch({ image })}
        onUpload={onUpload}
      />
      {el.image ? (
        <SelectField
          label="Image fit"
          value={el.fit || "cover"}
          onChange={(fit) => patch({ fit })}
          options={IMAGE_FITS}
        />
      ) : null}
      <PanelDivider />
      <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
        Section border
      </p>
      <BorderControls border={el.border} onChange={(border) => patch({ border })} />
    </>
  );
}

// --- the rail -----------------------------------------------------------------

export function Inspector({
  template,
  element,
  availableTiers,
  qrSettings,
  onChange,
  onLayoutChange,
  onElementChange,
  onElementDelete,
  onUpload,
}) {
  const [tierDraft, setTierDraft] = useState("");
  const patch = (p) => onChange(p);
  const patchIn = (key, sub) => onChange({ [key]: { ...(template[key] || {}), ...sub } });

  const stock = template.stock || {};
  const sheet = template.sheet || {};
  const layout = template.layout || {};
  const tiers = Array.isArray(template.tiers) ? template.tiers : [];
  const grid = sheetGrid(sheet, stock);
  const { wMm, hMm } = stockSize(stock);
  const artwork = element && (element.kind === "image" || element.kind === "box");

  const toggleTier = (tier) => {
    const has = tiers.some((t) => t.toLowerCase() === tier.toLowerCase());
    patch({
      tiers: has ? tiers.filter((t) => t.toLowerCase() !== tier.toLowerCase()) : [...tiers, tier],
    });
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

  // Applying a font to every text element at once — a per-element override still
  // wins afterwards, this is just the quick way to restyle a whole design.
  const applyFontToAll = (font) =>
    onLayoutChange({
      elements: (layout.elements || []).map((el) => (el.kind === "text" ? { ...el, font } : el)),
    });

  return (
    <Tabs defaultValue="design" className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 border-b border-border p-2">
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="binding">Binding</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="design" className="mt-0">
          {element ? (
            <>
              <PanelSection label={`Selected · ${elementLabel(element)}`}>
                {element.kind === "text" ? (
                  <TextElementForm el={element} patch={onElementChange} />
                ) : null}
                {element.kind === "qr" ? (
                  <QrElementForm
                    el={element}
                    patch={onElementChange}
                    qrSettings={qrSettings}
                    onUpload={onUpload}
                    maxSize={Math.min(wMm, hMm)}
                  />
                ) : null}
                {element.kind === "image" ? (
                  <ImageElementForm el={element} patch={onElementChange} onUpload={onUpload} />
                ) : null}
                {element.kind === "box" ? (
                  <BoxElementForm el={element} patch={onElementChange} onUpload={onUpload} />
                ) : null}
              </PanelSection>

              <PanelDivider />

              <PanelSection label="Position & size">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="X"
                    value={Number(element.x ?? 0)}
                    onChange={(v) => onElementChange({ x: Number(v) })}
                    step={0.5}
                    suffix="mm"
                  />
                  <NumberField
                    label="Y"
                    value={Number(element.y ?? 0)}
                    onChange={(v) => onElementChange({ y: Number(v) })}
                    step={0.5}
                    suffix="mm"
                  />
                  {element.kind !== "qr" ? (
                    <NumberField
                      label="Width"
                      value={Number(element.w ?? 0)}
                      onChange={(v) => onElementChange({ w: Number(v) })}
                      step={0.5}
                      suffix="mm"
                    />
                  ) : null}
                  {element.kind === "image" || element.kind === "box" ? (
                    <NumberField
                      label="Height"
                      value={Number(element.h ?? 0)}
                      onChange={(v) => onElementChange({ h: Number(v) })}
                      step={0.5}
                      suffix="mm"
                    />
                  ) : null}
                </div>
                <SliderField
                  label="Rotation"
                  value={element.rotation ?? 0}
                  onChange={(rotation) => onElementChange({ rotation })}
                  min={-180}
                  max={180}
                  suffix="°"
                />
                <SliderField
                  label="Opacity"
                  value={Math.round((element.opacity ?? 1) * 100)}
                  onChange={(v) => onElementChange({ opacity: v / 100 })}
                  min={0}
                  max={100}
                  suffix="%"
                />
              </PanelSection>

              {artwork ? (
                <>
                  <PanelDivider />
                  <PanelSection label="Adjustments">
                    <AdjustControls el={element} patch={onElementChange} />
                  </PanelSection>
                </>
              ) : null}

              <PanelDivider />

              <PanelSection>
                <Button
                  variant="outline"
                  className="w-full border-border bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => onElementDelete(element.id)}
                >
                  <Trash2 className="h-4 w-4" /> Remove from card
                </Button>
              </PanelSection>

              <PanelDivider />
            </>
          ) : null}

          <PanelSection label="Card">
            <ColorField
              label="Background"
              value={template.bg}
              fallback="#ffffff"
              onChange={(bg) => patch({ bg })}
            />
            <SelectField
              label="Font for all text"
              placeholder="Choose…"
              value=""
              onChange={applyFontToAll}
              options={FONT_OPTIONS}
            />
          </PanelSection>

          <PanelDivider />

          <PanelSection label="Background image">
            <ImageField
              value={layout.bgImage?.url}
              onChange={(url) => onLayoutChange({ bgImage: { ...(layout.bgImage || {}), url } })}
              onUpload={onUpload}
            />
            {layout.bgImage?.url ? (
              <>
                <SelectField
                  label="Fit"
                  value={layout.bgImage?.fit || "cover"}
                  onChange={(fit) => onLayoutChange({ bgImage: { ...(layout.bgImage || {}), fit } })}
                  options={IMAGE_FITS}
                />
                <SliderField
                  label="Opacity"
                  value={Math.round((layout.bgImage?.opacity ?? 1) * 100)}
                  onChange={(v) =>
                    onLayoutChange({ bgImage: { ...(layout.bgImage || {}), opacity: v / 100 } })
                  }
                  min={10}
                  max={100}
                  step={5}
                  suffix="%"
                />
              </>
            ) : null}
          </PanelSection>

          <PanelDivider />

          <PanelSection label="Card border">
            <BorderControls border={layout.border} onChange={(border) => onLayoutChange({ border })} />
            <NumberField
              label="Corner radius"
              value={layout.border?.radius ?? 0}
              onChange={(v) =>
                onLayoutChange({
                  border: { ...(layout.border || defaultCardBorder()), radius: Number(v) },
                })
              }
              min={0}
              max={20}
              step={0.5}
              suffix="mm"
            />
          </PanelSection>
        </TabsContent>

        <TabsContent value="binding" className="mt-0">
          <PanelSection label="Template">
            <TextField
              label="Name"
              value={template.name}
              onChange={(name) => patch({ name })}
              placeholder="e.g. VIP lanyard"
            />
          </PanelSection>

          <PanelDivider />

          <PanelSection label="Ticket tiers">
            <p className="text-xs leading-snug text-text-tertiary">
              Bound by tier name, so one design follows a tier across events. Unmatched attendees
              fall back to the default template.
            </p>

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
                className="bg-surface-card"
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
          </PanelSection>
        </TabsContent>

        <TabsContent value="output" className="mt-0">
          <PanelSection label="Stock">
            <SelectField
              label="Preset"
              value={stock.preset || "name-badge"}
              onChange={(preset) => {
                const found = STOCK_PRESETS.find((p) => p.value === preset);
                patchIn("stock", {
                  preset,
                  ...(found && preset !== "custom" ? { wMm: found.wMm, hMm: found.hMm } : {}),
                });
              }}
              options={STOCK_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
            {stock.preset === "custom" ? (
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                {wMm} × {hMm} mm
              </p>
            )}
          </PanelSection>

          <PanelDivider />

          <PanelSection label="Sheet layout">
            <SelectField
              label="Page"
              value={sheet.page || "a4"}
              onChange={(page) => patchIn("sheet", { page })}
              options={PAGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
            <div className="grid grid-cols-2 gap-3">
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
            <PanelRow
              title="Crop marks"
              description="Corner guides to cut against"
              control={
                <Switch
                  checked={!!sheet.cropMarks}
                  onCheckedChange={(v) => patchIn("sheet", { cropMarks: v })}
                />
              }
            />
            <p className="text-xs text-text-tertiary">
              {grid.cols} across × {grid.rows} down — {grid.perPage} per page.
            </p>
          </PanelSection>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default Inspector;
