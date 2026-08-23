"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Globe,
  ImageOff,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Field, SectionCard, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { useWallConfig } from "@/lib/events/use-wall-config";
import { updateWall } from "@/lib/supabase/event_wall";
import { uploadWallFont, uploadWallImage } from "@/lib/supabase/storage";
import { Segmented, ColorField } from "../theme_controls";
import { FooterEditor, DEFAULT_FOOTER } from "../page_footer";
import { ImportBrandDialog } from "../brand_import";
import { WALL_VIEWS, DEFAULT_LAYOUT } from "./wall_layout";
import {
  resolveTheme,
  DEFAULT_THEME,
  THEME_PRESETS,
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
  themeFontOptions,
} from "@/lib/events/theme";

// Which of the importer's categories this surface can honour. The wall has no
// site-header bar of its own — its chrome is the organiser identity block — so
// offering to import someone's nav would produce settings nothing renders.
const WALL_IMPORT_CATEGORIES = [
  "logo",
  "colors",
  "fonts",
  "shape",
  "layout",
  "footer",
  "content",
];

// The wall's brand theme — the same model individual event pages use
// (lib/events/theme.js), stored under metadata.theme. Unlike per-event Page
// Design there's no mode/blocks picker: the wall always renders the same
// themed grid layout, so only the brand controls apply here.
//
// `onWallChange` lifts the wall's own columns (logo, tagline) back to the
// screen after a save, so General — seeded from the same row — doesn't come
// back holding the values this section just replaced.
export function WallDesignSection({ wall, onWallChange }) {
  const { projectId } = useProject();
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
  // The wall's identity columns, not its metadata bag — an import writes them
  // too, so they're held here and committed alongside the theme.
  const [logoUrl, setLogoUrl] = useState(wall?.logoUrl || "");
  const [tagline, setTagline] = useState(wall?.tagline || "");
  const [importOpen, setImportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  // An imported brand is a theme patch, merged over what's there so a partial
  // import (colors only, say) leaves the rest alone. The footer rides alongside
  // the theme, and the mark and tagline are columns on the wall itself — the
  // theme's own logo/tagline fields belong to the event page's chrome, which
  // the wall doesn't render.
  const applyImport = (themePatch, nextFooter) => {
    setTheme({ ...resolved, ...themePatch });
    if (nextFooter) setFooter(nextFooter);
    if (themePatch.logo?.url) setLogoUrl(themePatch.logo.url);
    if (themePatch.tagline) setTagline(themePatch.tagline);
  };

  const pickLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    // Compression off: canvas re-encoding destroys SVGs and flattens
    // transparency, which is exactly what a logo needs to keep.
    const uploaded = await uploadWallImage(projectId, file, { compress: false });
    setUploading(false);
    if (!uploaded?.url) {
      toast.error("Couldn't upload that image.");
      return;
    }
    setLogoUrl(uploaded.url);
  };

  const onSave = async () => {
    await saveLayout(layout);
    await saveFooter(footer);
    if ((await saveTheme(theme)) === false) return;
    // The identity columns commit last so the row handed back up carries the
    // metadata the three merges above just wrote — lifting an earlier read
    // would hand the other sections a pre-import theme.
    const row = await updateWall(projectId, { logoUrl, tagline });
    if (!row) {
      toast.error("Couldn't save the logo and tagline.");
      return;
    }
    onWallChange?.(row);
    toast.success("Design saved.");
  };

  // An imported typeface isn't one of the built-ins, so the picker grows an
  // entry for it — without this the font Segmented shows nothing selected.
  const fontOptions = themeFontOptions(resolved);
  const source = resolved.source || {};
  // Every mark the last import pulled off the site — shown only when there's an
  // actual choice to make between them.
  const designs = resolved.importedLogos || [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Brand & logo"
        description="Read an existing website and re-skin this page with its colors, type, and shape — or set the mark by hand."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
            {source.url ? "Re-import" : "Import from a site"}
          </Button>
        }
      >
        <div className="space-y-5">
          {source.url ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-muted-foreground">
              <Globe className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                Imported from{" "}
                <span className="text-foreground">
                  {source.siteName || source.url}
                </span>
              </span>
            </div>
          ) : null}

          <Field label="Logo" hint="Shown beside your page name.">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card p-1.5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Wall logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageOff className="h-4 w-4 text-text-tertiary" />
                )}
              </div>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Paste an image URL"
                className="h-8 flex-1 font-mono text-xs"
              />
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="icon-xs"
                  variant="outline"
                  asChild
                  aria-label={logoUrl ? "Replace logo" : "Upload logo"}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <label className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                    />
                  </label>
                </Button>
                {logoUrl ? (
                  <Button
                    size="icon-xs"
                    variant="outline"
                    aria-label="Remove logo"
                    onClick={() => setLogoUrl("")}
                    className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </div>
          </Field>

          <Field label="Tagline" hint="A short line under your page name.">
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Discover what's happening."
            />
          </Field>

          {designs.length > 1 ? (
            <div>
              <p className="text-sm font-medium text-foreground">
                Imported designs
              </p>
              <p className="mb-2 text-xs text-text-tertiary">
                Every mark the import found — pick the one to use.
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {designs.map((d, i) => {
                  const active = d.url === logoUrl;
                  return (
                    <button
                      key={`${d.url}-${i}`}
                      type="button"
                      onClick={() => setLogoUrl(d.url)}
                      aria-label={d.kind ? `Use ${d.kind} mark` : `Use design ${i + 1}`}
                      className={cn(
                        "relative flex h-16 items-center justify-center rounded-xl border p-2.5 transition-colors",
                        active
                          ? "border-border-strong bg-surface-active"
                          : "border-border bg-surface-card hover:bg-surface-active",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.url}
                        alt={d.kind ? `${d.kind} mark` : "Imported logo"}
                        className="max-h-full max-w-full object-contain"
                      />
                      {active ? (
                        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                          <Check className="h-3 w-3 text-[#161616]" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

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
                options={fontOptions}
              />
            </Field>
            <Field label="Body font">
              <Segmented
                value={resolved.font.body}
                onChange={(v) => setFont({ body: v })}
                options={fontOptions}
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
        title="Agenda"
        description="Which view your events page opens in, and what each row shows. Visitors can switch views themselves."
      >
        <div className="space-y-5">
          <Field label="Default view" hint="Cards give each event its cover; List fits more on screen.">
            <Segmented
              value={layout.defaultView || "cards"}
              onChange={(v) => setLayoutKey({ defaultView: v })}
              options={WALL_VIEWS}
            />
          </Field>
          <SettingsList>
            <SettingRow
              title="Type badge"
              description="Show the event type beside the time."
              checked={layout.cardMeta?.type !== false}
              onCheckedChange={(v) => setCardMeta("type", v)}
            />
            <SettingRow
              title="Host"
              description="Show who is running the event."
              checked={layout.cardMeta?.host !== false}
              onCheckedChange={(v) => setCardMeta("host", v)}
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
              checked={layout.cardMeta?.price !== false}
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
          <Field label="Page background">
            <Segmented
              value={resolved.background?.type || "surface"}
              onChange={(v) =>
                patch({ background: { ...resolved.background, type: v } })
              }
              options={BG_TYPES}
            />
          </Field>
          <Field
            label="Banner image URL"
            hint="The wide image above your name. Falls back to your organiser profile banner."
          >
            <Input
              value={layout.header?.bannerUrl || ""}
              onChange={(e) => setHeader({ bannerUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          {resolved.background?.type === "image" ||
          resolved.background?.type === "video" ? (
            <Field
              label={
                resolved.background?.type === "video"
                  ? "Background video URL"
                  : "Background image URL"
              }
              hint={
                resolved.background?.type === "video"
                  ? "A muted, looping clip behind the header."
                  : "Sits behind the header. Optional."
              }
            >
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
          Save Changes
        </Button>
      </div>

      <ImportBrandDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        uploader={{
          image: (file, options) => uploadWallImage(projectId, file, options),
          font: (file) => uploadWallFont(projectId, file),
        }}
        categories={WALL_IMPORT_CATEGORIES}
        theme={resolved}
        footer={footer}
        onApply={applyImport}
      />
    </div>
  );
}

export default WallDesignSection;
