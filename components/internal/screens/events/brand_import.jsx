"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Globe,
  ImageOff,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Field, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { buildThemePatch } from "@/lib/brand/to-theme";
import { LOGO_HEIGHTS } from "@/lib/events/theme";
import { uploadEventFont, uploadEventImage } from "@/lib/supabase/storage";
import { Segmented } from "./theme_controls";

const CATEGORIES = [
  { key: "logo", label: "Logo", hint: "Brand mark for the header and footer" },
  { key: "colors", label: "Colors", hint: "Brand, background, text, and borders" },
  { key: "fonts", label: "Fonts", hint: "Typefaces and their files, weight, case, and tracking" },
  { key: "shape", label: "Shape", hint: "Corners, borders, shadows, and buttons" },
  { key: "layout", label: "Layout", hint: "Content width and section spacing" },
  { key: "header", label: "Site header", hint: "Their nav links and main button" },
  { key: "footer", label: "Footer", hint: "Their footer links and social profiles" },
  { key: "content", label: "Imagery & text", hint: "Hero image, tagline, and favicon" },
];

async function dataUrlToFile(dataUrl, mime, name = "logo") {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = (mime || blob.type || "image/png").split("/")[1]?.split("+")[0] || "png";
  return new File([blob], `${name}.${ext}`, { type: blob.type || mime });
}

function faceSlug(face) {
  const family = String(face?.family || "font")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const weight = String(face?.weight || "").replace(/[^\d]/g, "").slice(0, 3);
  return weight ? `${family || "font"}-${weight}` : family || "font";
}

async function hostFontFaces(faces, uploadFont) {
  const list = Array.isArray(faces) ? faces : [];
  if (!list.length) return { faces: [], hosted: 0 };

  const uploads = await Promise.all(
    list.map(async (face) => {
      if (!face?.dataUrl) return null;
      try {
        const file = await dataUrlToFile(face.dataUrl, face.mime, faceSlug(face));
        const stored = await uploadFont(file);
        return stored?.url || null;
      } catch {
        return null;
      }
    }),
  );

  return {
    hosted: uploads.filter(Boolean).length,
    faces: list.map((face, i) => ({
      family: face.family,
      src: uploads[i] || face.src,
      weight: face.weight,
      style: face.style,
    })),
  };
}

function LogoTile({ logo, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex h-20 items-center justify-center rounded-xl border p-3 transition-colors",
        active
          ? "border-border-strong bg-surface-active"
          : "border-border bg-surface-card hover:bg-surface-active",
      )}
    >
      <img
        src={logo.dataUrl}
        alt={`${logo.kind} candidate`}
        className="max-h-full max-w-full object-contain"
      />
      {active ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
          <Check className="h-3 w-3 text-[#161616]" />
        </span>
      ) : null}
    </button>
  );
}

function Swatch({ label, hex }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span
        className="h-9 rounded-lg border border-border"
        style={{ backgroundColor: hex }}
      />
      <span className="truncate text-[11px] text-text-tertiary">{label}</span>
    </div>
  );
}

export function ImportBrandDialog({
  open,
  onOpenChange,
  eventId,
  uploader,
  categories,
  theme,
  footer,
  onApply,
}) {
  const offered = categories
    ? CATEGORIES.filter((c) => categories.includes(c.key))
    : CATEGORIES;
  const uploadImage =
    uploader?.image ||
    ((file, options) => (eventId ? uploadEventImage(eventId, file, options) : null));
  const uploadFont =
    uploader?.font || ((file) => (eventId ? uploadEventFont(eventId, file) : null));

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [logoIndex, setLogoIndex] = useState(0);
  const [apply, setApply] = useState(
    Object.fromEntries(offered.map((c) => [c.key, true])),
  );
  const [useBackground, setUseBackground] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setStatus("idle");
    setError("");
    setData(null);
    setLogoIndex(0);
    setUseBackground(false);
  };

  const run = async () => {
    if (!url.trim()) {
      toast.error("Enter a website address first.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/brand/extract?url=${encodeURIComponent(url.trim())}`,
      );
      const json = await res.json().catch(() => null);
      if (!json) {
        setError(
          res.status === 504
            ? "Reading that site took too long. Try again, or a simpler page."
            : "The brand reader didn't respond. Refresh the page and try again.",
        );
        setStatus("idle");
        return;
      }
      if (json.error) {
        setError(json.error.message);
        setStatus("idle");
        return;
      }
      setData(json);
      setLogoIndex(0);
      setApply(
        Object.fromEntries(offered.map((c) => [c.key, !!json.found[c.key]])),
      );
      setStatus("done");
    } catch {
      setError("Something went wrong reading that site. Try again.");
      setStatus("idle");
    }
  };

  const commit = async () => {
    if (!data) return;
    setApplying(true);

    let logoUrl = "";
    let importedLogos = [];
    if (apply.logo && data.logos.length) {
      const chosen = data.logos[logoIndex] || data.logos[0];
      const picks = [
        chosen,
        ...data.logos.filter((l) => l !== chosen),
      ].filter(
        (l, i, arr) => arr.findIndex((x) => x.url === l.url) === i,
      );
      const results = await Promise.all(
        picks.map(async (logo) => {
          try {
            const file = await dataUrlToFile(logo.dataUrl, logo.mime);
            const uploaded = await uploadImage(file, { compress: false });
            return { url: uploaded?.url || logo.url, kind: logo.kind };
          } catch {
            return { url: logo.url, kind: logo.kind };
          }
        }),
      );
      importedLogos = results.filter((r) => r.url);
      logoUrl = importedLogos[0]?.url || "";
    }

    let source = data;
    let hostedFonts = 0;
    if (apply.fonts && data.fonts?.faces?.length) {
      const { faces, hosted } = await hostFontFaces(data.fonts.faces, uploadFont);
      hostedFonts = hosted;
      source = { ...data, fonts: { ...data.fonts, faces } };
    }

    const { patch, footer: nextFooter, notes } = buildThemePatch(source, {
      apply,
      current: theme,
      currentFooter: footer,
      logoUrl,
      background: useBackground,
    });

    onApply(
      importedLogos.length ? { ...patch, importedLogos } : patch,
      nextFooter,
    );
    setApplying(false);
    onOpenChange(false);
    const allNotes = hostedFonts
      ? [...notes, `${hostedFonts} font file${hostedFonts === 1 ? "" : "s"} hosted`]
      : notes;
    toast.success(
      allNotes.length
        ? `Brand imported — ${allNotes.join(", ")}`
        : `Brand imported from ${data.site.host}`,
    );
    reset();
    setUrl("");
  };

  const logos = data?.logos || [];
  const colors = data?.colors;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import a brand from a website</DialogTitle>
          <DialogDescription>
            We&apos;ll read the page and pull its logo, colors, fonts, and shape.
            Everything stays editable afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Website address">
            <div className="flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
                placeholder="acme.com"
                autoFocus
              />
              <Button
                onClick={run}
                disabled={status === "loading"}
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {status === "done" ? "Read again" : "Read site"}
              </Button>
            </div>
          </Field>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : null}

          {status === "loading" ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-card py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading {url.replace(/^https?:\/\//, "")}…
            </div>
          ) : null}

          {status === "done" && data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  <span className="text-foreground">{data.site.name}</span> ·{" "}
                  {data.site.host}
                </span>
              </div>

              {logos.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">
                    Logo — pick the right one
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {logos.map((l, i) => (
                      <LogoTile
                        key={l.url}
                        logo={l}
                        active={i === logoIndex}
                        onSelect={() => setLogoIndex(i)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-text-secondary">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  No logo found on that page — you can add one by hand after
                  importing.
                </div>
              )}

              {colors ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">
                    Colors — {data.base} theme
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    <Swatch label="Brand" hex={colors.brand} />
                    <Swatch label="Background" hex={colors.bg} />
                    <Swatch label="Surface" hex={colors.surface} />
                    <Swatch label="Text" hex={colors.text} />
                    <Swatch label="Muted" hex={colors.muted} />
                    <Swatch label="Border" hex={colors.border} />
                    <Swatch label="On brand" hex={colors.brandText} />
                  </div>
                </div>
              ) : null}

              {data.found.fonts || data.found.shape ? (
                <div className="flex flex-wrap gap-2">
                  {data.fonts.heading ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-muted-foreground">
                      Headings: {data.fonts.heading}
                    </span>
                  ) : null}
                  {data.fonts.body ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-muted-foreground">
                      Body: {data.fonts.body}
                    </span>
                  ) : null}
                  {Number.isFinite(data.radiusPx) ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-muted-foreground">
                      Corners: {data.radiusPx}px
                    </span>
                  ) : data.radius ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs capitalize text-muted-foreground">
                      Corners: {data.radius}
                    </span>
                  ) : null}
                  {data.button ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs capitalize text-muted-foreground">
                      Buttons: {data.button}
                      {data.buttonGradient ? " gradient" : ""}
                    </span>
                  ) : null}
                  {data.elevation ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs capitalize text-muted-foreground">
                      Shadow: {data.elevation}
                    </span>
                  ) : null}
                  {data.width ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs capitalize text-muted-foreground">
                      Width: {data.width}
                    </span>
                  ) : null}
                  {data.fonts?.faces?.length ? (
                    <span className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-muted-foreground">
                      {(() => {
                        const all = data.fonts.faces;
                        const got = all.filter((f) => f.dataUrl).length;
                        return got
                          ? `Self-hosted font — ${got}/${all.length} weights copied`
                          : `Self-hosted font (${all.length} weights)`;
                      })()}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {offered.some((c) => c.key === "header") &&
              (data.nav?.length || data.cta) ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">
                    Site header — their nav
                  </p>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2.5">
                    {(data.nav || []).map((l) => (
                      <span key={l.url} className="text-xs text-muted-foreground">
                        {l.label}
                      </span>
                    ))}
                    {data.cta ? (
                      <span
                        className="ml-auto rounded-md px-2 py-1 text-xs"
                        style={{
                          backgroundColor: colors?.brand || "transparent",
                          color: colors?.brandText || "inherit",
                        }}
                      >
                        {data.cta.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {data.found.footer ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Footer</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-surface-card px-3 py-2.5">
                    {(data.footer.links || []).map((l) => (
                      <span key={l.url} className="text-xs text-muted-foreground">
                        {l.label}
                      </span>
                    ))}
                    {(data.footer.socials || []).map((s) => (
                      <span
                        key={s.platform}
                        className="text-xs capitalize text-text-tertiary"
                      >
                        {s.platform}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.tagline ? (
                <p className="rounded-xl border border-border bg-surface-card px-3 py-2.5 text-xs italic text-text-secondary">
                  &ldquo;{data.tagline}&rdquo;
                </p>
              ) : null}

              <div className="space-y-2 rounded-xl border border-border bg-surface-card p-3">
                <p className="text-xs font-medium text-text-secondary">
                  What to apply
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {offered.map((c) => {
                    const available = data.found[c.key];
                    return (
                      <label
                        key={c.key}
                        className={cn(
                          "flex items-start gap-2.5",
                          !available && "opacity-40",
                        )}
                      >
                        <Checkbox
                          checked={!!apply[c.key]}
                          disabled={!available}
                          onCheckedChange={(v) =>
                            setApply((a) => ({ ...a, [c.key]: !!v }))
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-foreground">
                            {c.label}
                          </span>
                          <span className="block text-xs text-text-tertiary">
                            {available ? c.hint : "Not found on that page"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {data.found.background ? (
                    <label className="flex items-start gap-2.5">
                      <Checkbox
                        checked={useBackground}
                        disabled={!apply.shape}
                        onCheckedChange={(v) => setUseBackground(!!v)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground">
                          Page background
                        </span>
                        <span className="block text-xs text-text-tertiary">
                          Use their share image behind the page
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-text-tertiary">
                Make sure you have the right to use this brand&apos;s logo and
                assets on your event page.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={status !== "done" || applying}
            onClick={commit}
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply to page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BrandLogoSection({ theme, eventId, onChange, onReimport }) {
  const [uploading, setUploading] = useState(null);
  const logo = theme.logo || {};
  const footerLogo = theme.footerLogo || {};
  const source = theme.source || {};
  const setLogo = (patch) => onChange({ logo: { ...logo, ...patch } });
  const setFooterLogo = (patch) =>
    onChange({ footerLogo: { ...footerLogo, ...patch } });

  const pickFile = async (file, surface) => {
    if (!file) return;
    setUploading(surface);
    const uploaded = eventId
      ? await uploadEventImage(eventId, file, { compress: false })
      : null;
    setUploading(false);
    if (!uploaded?.url) {
      toast.error("Couldn't upload that image.");
      return;
    }
    if (surface === "footer") {
      setFooterLogo({ url: uploaded.url });
      toast.success("Footer logo updated");
    } else {
      setLogo({ url: uploaded.url });
      toast.success("Logo updated");
    }
  };

  const designs = (theme.importedLogos || []).length
    ? theme.importedLogos
    : logo.url
      ? [{ url: logo.url, kind: "" }]
      : [];

  return (
    <div className="space-y-5">
      {source.url ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            Imported from{" "}
            <span className="text-foreground">
              {source.siteName || source.url}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onReimport}
            className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Re-import
          </Button>
        </div>
      ) : null}

      <Field label="Header logo" hint="Shown in the brand bar above the event.">
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card p-1.5">
            {logo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.url}
                alt="Brand logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageOff className="h-4 w-4 text-text-tertiary" />
            )}
          </div>
          <Input
            value={logo.url || ""}
            onChange={(e) => setLogo({ url: e.target.value })}
            placeholder="Paste an image URL"
            className="h-8 flex-1 font-mono text-xs"
          />
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="icon-xs"
              variant="outline"
              asChild
              aria-label={logo.url ? "Replace header logo" : "Upload header logo"}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <label className="cursor-pointer">
                {uploading === "header" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0], "header")}
                />
              </label>
            </Button>
            {logo.url ? (
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Remove header logo"
                onClick={() => setLogo({ url: "" })}
                className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        </div>
      </Field>

      <Field
        label="Footer logo"
        hint="A different mark for the footer. Empty reuses the header logo."
      >
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card p-1.5">
            {footerLogo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={footerLogo.url}
                alt="Footer logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : logo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.url}
                alt="Header logo"
                className="max-h-full max-w-full object-contain opacity-50"
              />
            ) : (
              <ImageOff className="h-4 w-4 text-text-tertiary" />
            )}
          </div>
          <Input
            value={footerLogo.url || ""}
            onChange={(e) => setFooterLogo({ url: e.target.value })}
            placeholder="Paste an image URL"
            className="h-8 flex-1 font-mono text-xs"
          />
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="icon-xs"
              variant="outline"
              asChild
              aria-label={footerLogo.url ? "Replace footer logo" : "Upload footer logo"}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <label className="cursor-pointer">
                {uploading === "footer" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0], "footer")}
                />
              </label>
            </Button>
            {footerLogo.url ? (
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Remove footer logo"
                onClick={() => setFooterLogo({ url: "" })}
                className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Logo size">
          <Segmented
            value={Number(logo.height) || 32}
            onChange={(v) => setLogo({ height: v })}
            options={LOGO_HEIGHTS}
          />
        </Field>
        <Field label="Footer logo size">
          <Segmented
            value={Number(footerLogo.height) || Number(logo.height) || 32}
            onChange={(v) => setFooterLogo({ height: v })}
            options={LOGO_HEIGHTS}
          />
        </Field>
      </div>

      <Field label="Logo links to" hint="Leave blank for no link.">
        <Input
          value={logo.link || ""}
          onChange={(e) => setLogo({ link: e.target.value })}
          placeholder="https://…"
        />
      </Field>

      {designs.length ? (
        <div>
          <p className="text-sm font-medium text-foreground">Imported designs</p>
          <p className="mb-1 text-xs text-text-tertiary">
            Marks pulled from an imported site — assign or swap either slot.
          </p>
          <SettingsList>
            {designs.map((d, i) => {
              const inHeader = d.url === logo.url && !!logo.url;
              const inFooter = d.url === footerLogo.url && !!footerLogo.url;
              return (
                <div
                  key={`${d.url}-${i}`}
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-subtle p-1.5">
                      <img
                        src={d.url}
                        alt={d.kind ? `${d.kind} design` : "Imported logo"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {d.kind ? `${d.kind} mark` : `Design ${i + 1}`}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Assign to a slot below.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setLogo({ url: d.url })}
                      className={cn(
                        "border-border bg-transparent",
                        inHeader
                          ? "text-primary hover:text-primary"
                          : "text-muted-foreground hover:bg-surface-active hover:text-foreground",
                      )}
                    >
                      <Check className="h-3 w-3" /> Header
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setFooterLogo({ url: d.url })}
                      className={cn(
                        "border-border bg-transparent",
                        inFooter
                          ? "text-primary hover:text-primary"
                          : "text-muted-foreground hover:bg-surface-active hover:text-foreground",
                      )}
                    >
                      <Check className="h-3 w-3" /> Footer
                    </Button>
                  </div>
                </div>
              );
            })}
          </SettingsList>
        </div>
      ) : null}

      <SettingsList>
        <SettingRow
          title="Show in page header"
          description="A slim brand bar above the event hero."
          checked={logo.showBar !== false}
          onCheckedChange={(v) => setLogo({ showBar: v })}
        />
        <SettingRow
          title="Fall back to this logo in the footer"
          description="Shown above the footer links when no separate footer logo is set."
          checked={logo.showInFooter !== false}
          onCheckedChange={(v) => setLogo({ showInFooter: v })}
        />
      </SettingsList>
    </div>
  );
}

export default ImportBrandDialog;
