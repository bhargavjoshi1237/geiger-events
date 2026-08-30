"use client";

import React from "react";
import { Blend, Image as ImageIcon, Palette, Pipette } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { CLIP_BACKGROUNDS, CLIP_FITS, CLIP_THEMES } from "@/lib/clip/model";

const THEME_ICONS = { source: Palette, page: Blend };

// The universal "no background" swatch.
const CHECKERBOARD = {
  backgroundImage:
    "linear-gradient(45deg,#8888 25%,transparent 25%),linear-gradient(-45deg,#8888 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#8888 75%),linear-gradient(-45deg,transparent 75%,#8888 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
};

// Width and Colours are two answers to the same question — how the clip sits on
// the page — so their tiles share one height and one internal rhythm.
const TILE_H = "h-[3.75rem]";

function Tile({ active, onClick, title, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-md border px-1.5 py-1.5 text-[11px] font-medium leading-tight transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface-card text-muted-foreground hover:border-border-strong hover:bg-surface-active hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Each option is drawn as "your page column" (the dashed frame) plus the clip
// inside it, so the only thing that differs between the four is how the clip
// meets that column. The frame carries the meaning, so it stays the strongest
// mark — the clip itself is deliberately washed out behind it.
function FitArt({ kind }) {
  const frame =
    "relative h-6 w-full rounded-[3px] border border-dashed border-current/70 bg-current/5";
  const block = "absolute inset-y-[3px] rounded-[1px] bg-current/45";

  if (kind === "stretch") {
    return (
      <div className={frame}>
        <span className={cn(block, "left-[2px] right-[2px]")} />
      </div>
    );
  }
  if (kind === "full") {
    return (
      <div className={cn(frame, "overflow-visible")}>
        <span className={cn(block, "-left-1.5 -right-1.5")} />
      </div>
    );
  }
  if (kind === "scroll") {
    return (
      <div className={cn(frame, "overflow-hidden")}>
        <span className={cn(block, "bottom-[7px] left-[2px] -right-4 top-[3px]")} />
        <span className="absolute inset-x-[2px] bottom-[2px] h-[3px] rounded-full bg-current/20" />
        <span className="absolute bottom-[2px] left-[2px] h-[3px] w-1/2 rounded-full bg-current/70" />
      </div>
    );
  }
  return (
    <div className={frame}>
      <span className={cn(block, "left-3 right-3")} />
    </div>
  );
}

// Swatches are sized to read as siblings of the tiles above them rather than as
// an afterthought — big enough to judge a colour, small enough to stay a row.
const SWATCH = "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-[box-shadow,border-color]";

function Swatch({ active, onClick, title, style, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={title}
      title={title}
      className={cn(
        SWATCH,
        active
          ? "border-primary ring-2 ring-primary/35"
          : "border-border hover:border-border-strong",
      )}
      style={style}
    >
      {children}
    </button>
  );
}

function BackgroundChoices({ value, onChange }) {
  const custom = !!value && !CLIP_BACKGROUNDS.some((b) => b.key === value);
  const activeLabel = custom
    ? value.toUpperCase()
    : CLIP_BACKGROUNDS.find((b) => b.key === value)?.label || "Original";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CLIP_BACKGROUNDS.map((option) => {
        const transparent = option.key === "transparent";
        return (
          <Swatch
            key={option.key || "auto"}
            active={!custom && value === option.key}
            onClick={() => onChange(option.key)}
            title={
              option.key === ""
                ? "Original — whatever the page had behind it"
                : transparent
                  ? "None — let the event page show through"
                  : option.label
            }
            style={
              transparent
                ? CHECKERBOARD
                : option.swatch
                  ? { backgroundColor: option.swatch }
                  : undefined
            }
          >
            {option.key === "" ? (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </Swatch>
        );
      })}

      <label
        className={cn(
          SWATCH,
          "cursor-pointer",
          custom
            ? "border-primary ring-2 ring-primary/35"
            : "border-border hover:border-border-strong",
        )}
        title="Pick a colour"
      >
        <span
          className="absolute inset-0"
          style={{
            backgroundColor: custom ? value : undefined,
            backgroundImage: custom
              ? undefined
              : "conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)",
          }}
        />
        {!custom ? (
          <Pipette className="relative h-4 w-4 text-white drop-shadow" />
        ) : null}
        <input
          type="color"
          aria-label="Custom clip background"
          value={custom ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {activeLabel}
      </span>
    </div>
  );
}

function CompactGroup({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <div>
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground mb-1">
          {hint}
        </span>
      </div>
      {children}
    </div>
  );
}

export function ClipAppearance({ clip, onChange, compact = false }) {
  const theme = clip?.theme === "page" ? "page" : "source";
  const fit = clip?.fit || "scale";
  const background = clip?.background || "";

  const set = (patch) => onChange({ ...clip, ...patch });

  const fitChoices = (
    <div className="grid grid-cols-2 gap-1.5">
      {CLIP_FITS.map((option) => (
        <Tile
          key={option.key}
          active={fit === option.key}
          onClick={() => set({ fit: option.key })}
          title={option.hint}
          className={TILE_H}
        >
          <FitArt kind={option.key} />
          {option.label}
        </Tile>
      ))}
    </div>
  );

  const themeChoices = (
    <div className="flex gap-1.5">
      {CLIP_THEMES.map((option) => {
        const Icon = THEME_ICONS[option.key] || Palette;
        return (
          <Tile
            key={option.key}
            active={theme === option.key}
            onClick={() => set({ theme: option.key })}
            title={option.hint}
            className={cn(TILE_H, "min-w-0 flex-1")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-center">{option.label}</span>
          </Tile>
        );
      })}
    </div>
  );

  const backgroundChoices = (
    <BackgroundChoices value={background} onChange={(v) => set({ background: v })} />
  );

  if (compact) {
    return (
      <div className="space-y-4">
        <CompactGroup label="Width" hint="How the clip meets your column">
          {fitChoices}
        </CompactGroup>
        <CompactGroup label="Colours" hint="Whose palette the clip follows">
          {themeChoices}
        </CompactGroup>
        <CompactGroup label="Background" hint="What sits behind it">
          {backgroundChoices}
        </CompactGroup>
      </div>
    );
  }

  return (
    <>
      <Field
        label="Width"
        hint="How the clip's own width meets your column. “Contain” keeps the original proportions; “Fill” lets it reflow."
      >
        {fitChoices}
      </Field>
      <Field
        label="Colours"
        hint="“Match Page Theme” lets your event page drive plain text and fills, keeping the source's brand accents."
      >
        {themeChoices}
      </Field>
      <Field
        label="Background"
        hint="What sits behind the clip. Use “None” for cut-out images that should float on your page."
      >
        {backgroundChoices}
      </Field>
    </>
  );
}

export default ClipAppearance;
