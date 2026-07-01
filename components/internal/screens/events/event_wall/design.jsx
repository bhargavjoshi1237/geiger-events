"use client";

import { Field, SectionCard, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { Segmented, ColorField } from "../theme_controls";
import {
  resolveTheme,
  DEFAULT_THEME,
  THEME_PRESETS,
  FONT_OPTIONS,
  FONT_SCALES,
  HEADING_WEIGHTS,
  RADIUS_OPTIONS,
  WIDTHS,
  COVER_OPTIONS,
  BASES,
  BASE_PALETTES,
} from "@/lib/events/theme";

// The wall's brand theme — the same model individual event pages use
// (lib/events/theme.js), stored under metadata.theme. Unlike per-event Page
// Design there's no mode/blocks picker: the wall always renders the same
// themed grid layout, so only the brand controls apply here.
export function WallDesignSection({ wall }) {
  const [theme, setTheme, saveTheme, saving] = useWallConfig(
    wall,
    "theme",
    DEFAULT_THEME,
  );
  const resolved = resolveTheme({ theme });
  const patch = (next) => setTheme({ ...resolved, ...next });
  const setColors = (next) => patch({ colors: { ...resolved.colors, ...next } });
  const setFont = (next) => patch({ font: { ...resolved.font, ...next } });
  const onBase = (base) =>
    patch({ base, colors: { ...resolved.colors, ...BASE_PALETTES[base] } });
  const applyPreset = (preset) => setTheme(preset.theme);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Brand presets"
        description="Start from a look, then fine-tune everything below."
      >
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-active hover:text-foreground"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: p.theme.colors.brand }}
              />
              {p.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Brand colors"
        description="Your palette. Surfaces, borders, and buttons adapt automatically."
      >
        <div className="space-y-5">
          <Field label="Base">
            <Segmented value={resolved.base} onChange={onBase} options={BASES} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Brand / accent"
              value={resolved.colors.brand}
              onChange={(v) => setColors({ brand: v })}
            />
            <ColorField
              label="Brand text"
              value={resolved.colors.brandText}
              onChange={(v) => setColors({ brandText: v })}
            />
            <ColorField
              label="Page background"
              value={resolved.colors.bg}
              onChange={(v) => setColors({ bg: v })}
            />
            <ColorField
              label="Surface / cards"
              value={resolved.colors.surface}
              onChange={(v) => setColors({ surface: v })}
            />
            <ColorField
              label="Text"
              value={resolved.colors.text}
              onChange={(v) => setColors({ text: v })}
            />
            <ColorField
              label="Muted text"
              value={resolved.colors.muted}
              onChange={(v) => setColors({ muted: v })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Typography">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Heading font">
              <Segmented
                value={resolved.font.heading}
                onChange={(v) => setFont({ heading: v })}
                options={FONT_OPTIONS}
              />
            </Field>
            <Field label="Body font">
              <Segmented
                value={resolved.font.body}
                onChange={(v) => setFont({ body: v })}
                options={FONT_OPTIONS}
              />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Text size">
              <Segmented
                value={resolved.font.scale}
                onChange={(v) => setFont({ scale: v })}
                options={FONT_SCALES}
              />
            </Field>
            <Field label="Heading weight">
              <Segmented
                value={resolved.headingWeight}
                onChange={(v) => patch({ headingWeight: v })}
                options={HEADING_WEIGHTS}
              />
            </Field>
          </div>
          <SettingsList>
            <SettingRow
              title="Uppercase headings"
              description="Render section headings in all caps."
              checked={resolved.headingUpper}
              onCheckedChange={(v) => patch({ headingUpper: v })}
            />
          </SettingsList>
        </div>
      </SectionCard>

      <SectionCard title="Shape & style">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Corner radius">
            <Segmented
              value={resolved.radius}
              onChange={(v) => patch({ radius: v })}
              options={RADIUS_OPTIONS}
            />
          </Field>
          <Field label="Cover style">
            <Segmented
              value={resolved.cover}
              onChange={(v) => patch({ cover: v })}
              options={COVER_OPTIONS}
            />
          </Field>
          <Field label="Content width">
            <Segmented
              value={resolved.width}
              onChange={(v) => patch({ width: v })}
              options={WIDTHS}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => saveTheme(theme, { successMsg: "Design saved." })}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default WallDesignSection;
