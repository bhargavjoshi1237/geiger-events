"use client";

import { Field, SectionCard, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { Segmented, ColorField } from "../theme_controls";
import { FooterEditor, DEFAULT_FOOTER } from "../page_footer";
import {
  WALL_COLUMNS,
  CARD_STYLES,
  FEATURED_STYLES,
  HEADER_ALIGNS,
  DEFAULT_LAYOUT,
} from "./wall_layout";
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
  BUTTON_STYLES,
  ELEVATIONS,
  DENSITIES,
  BG_TYPES,
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
  const [layout, setLayout, saveLayout] = useWallConfig(
    wall,
    "layout",
    DEFAULT_LAYOUT,
  );
  const [footer, setFooter, saveFooter] = useWallConfig(
    wall,
    "footer",
    DEFAULT_FOOTER,
  );
  const resolved = resolveTheme({ theme });
  const patch = (next) => setTheme({ ...resolved, ...next });
  const setColors = (next) => patch({ colors: { ...resolved.colors, ...next } });
  const setFont = (next) => patch({ font: { ...resolved.font, ...next } });
  const onBase = (base) =>
    patch({ base, colors: { ...resolved.colors, ...BASE_PALETTES[base] } });
  const applyPreset = (preset) => setTheme(preset.theme);

  // Layout config is a flat bag; helpers mirror the theme setters.
  const setLayoutKey = (next) => setLayout({ ...layout, ...next });
  const setCardMeta = (key, v) =>
    setLayoutKey({ cardMeta: { ...(layout.cardMeta || {}), [key]: v } });
  const setHeader = (next) =>
    setLayoutKey({ header: { ...(layout.header || {}), ...next } });

  // One Save persists all three config sections (theme + layout + footer). Each
  // merges into a different metadata key, so they never clobber one another.
  const onSave = async () => {
    await saveLayout(layout);
    await saveFooter(footer);
    await saveTheme(theme, { successMsg: "Design saved." });
  };

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
          <Field label="Button style">
            <Segmented
              value={resolved.button}
              onChange={(v) => patch({ button: v })}
              options={BUTTON_STYLES}
            />
          </Field>
          <Field label="Card shadow">
            <Segmented
              value={resolved.elevation}
              onChange={(v) => patch({ elevation: v })}
              options={ELEVATIONS}
            />
          </Field>
          <Field label="Spacing">
            <Segmented
              value={resolved.density}
              onChange={(v) => patch({ density: v })}
              options={DENSITIES}
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

      <SectionCard
        title="Grid & cards"
        description="How your events are laid out and what each card shows."
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Columns">
              <Segmented
                value={layout.columns || "auto"}
                onChange={(v) => setLayoutKey({ columns: v })}
                options={WALL_COLUMNS}
              />
            </Field>
            <Field label="Card style">
              <Segmented
                value={layout.cardStyle || "classic"}
                onChange={(v) => setLayoutKey({ cardStyle: v })}
                options={CARD_STYLES}
              />
            </Field>
          </div>
          <SettingsList>
            <SettingRow
              title="Type badge"
              description="Show the event type on each card."
              checked={layout.cardMeta?.type !== false}
              onCheckedChange={(v) => setCardMeta("type", v)}
            />
            <SettingRow
              title="Date"
              description="Show the date and time."
              checked={layout.cardMeta?.date !== false}
              onCheckedChange={(v) => setCardMeta("date", v)}
            />
            <SettingRow
              title="Venue"
              description="Show the venue and city."
              checked={layout.cardMeta?.venue !== false}
              onCheckedChange={(v) => setCardMeta("venue", v)}
            />
            <SettingRow
              title="Price"
              description="Show the lead ticket price, when set."
              checked={!!layout.cardMeta?.price}
              onCheckedChange={(v) => setCardMeta("price", v)}
            />
          </SettingsList>
        </div>
      </SectionCard>

      <SectionCard
        title="Header & background"
        description="The banner and background behind your events page header."
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Header alignment">
              <Segmented
                value={layout.header?.align || "center"}
                onChange={(v) => setHeader({ align: v })}
                options={HEADER_ALIGNS}
              />
            </Field>
            <Field label="Page background">
              <Segmented
                value={resolved.background?.type || "surface"}
                onChange={(v) =>
                  patch({ background: { ...resolved.background, type: v } })
                }
                options={BG_TYPES}
              />
            </Field>
          </div>
          <Field label="Banner image URL" hint="Sits behind the header. Optional.">
            <Input
              value={layout.header?.bannerUrl || ""}
              onChange={(e) => setHeader({ bannerUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          {resolved.background?.type === "image" ? (
            <Field label="Background image URL">
              <Input
                value={resolved.background?.value || ""}
                onChange={(e) =>
                  patch({
                    background: { ...resolved.background, value: e.target.value },
                  })
                }
                placeholder="https://…"
              />
            </Field>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Featured events"
        description="How pinned events (set in the Events section) are displayed."
      >
        <Field label="Featured style">
          <Segmented
            value={layout.featuredStyle || "badge"}
            onChange={(v) => setLayoutKey({ featuredStyle: v })}
            options={FEATURED_STYLES}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Footer"
        description="Links, socials, and a closing line at the bottom of the wall."
      >
        <FooterEditor value={footer} onChange={setFooter} />
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={onSave}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default WallDesignSection;
