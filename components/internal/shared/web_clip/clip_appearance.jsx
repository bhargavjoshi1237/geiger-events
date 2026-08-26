"use client";

import React from "react";

import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { CLIP_BACKGROUNDS, CLIP_FITS, CLIP_THEMES } from "@/lib/clip/model";

function Choice({ active, onClick, title, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium leading-tight transition-colors",
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

function FitArt({ kind }) {
  const frame = "relative h-7 w-full rounded-[3px] border border-dashed border-current/40";
  const block = "absolute rounded-[2px] bg-current";
  if (kind === "stretch") {
    return (
      <div className={cn(frame, "opacity-80")}>
        <span className={cn(block, "inset-x-px inset-y-1")} />
      </div>
    );
  }
  if (kind === "full") {
    return (
      <div className={cn(frame, "opacity-80")}>
        <span className={cn(block, "inset-y-1 -left-1.5 -right-1.5")} />
      </div>
    );
  }
  if (kind === "scroll") {
    return (
      <div className={cn(frame, "overflow-hidden opacity-80")}>
        <span className={cn(block, "inset-y-1 left-1 -right-3")} />
        <span className="absolute inset-x-1 bottom-px h-[2px] rounded-full bg-current/50" />
      </div>
    );
  }
  return (
    <div className={cn(frame, "opacity-80")}>
      <span className={cn(block, "inset-y-1.5 left-2 right-2")} />
    </div>
  );
}

function BackgroundChoices({ value, onChange }) {
  const custom = value && !CLIP_BACKGROUNDS.some((b) => b.key === value);

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {CLIP_BACKGROUNDS.map((option) => (
        <Choice
          key={option.key || "auto"}
          active={!custom && value === option.key}
          onClick={() => onChange(option.key)}
          title={
            option.key === ""
              ? "Whatever the original page had behind it"
              : option.key === "transparent"
                ? "Let the event page show through"
                : option.label
          }
        >
          {option.swatch ? (
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: option.swatch }}
            />
          ) : null}
          {option.label}
        </Choice>
      ))}

      <label
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors",
          custom ? "border-primary" : "border-border hover:border-border-strong",
        )}
        title="Pick a colour"
      >
        <span
          className="block h-full w-full"
          style={{
            backgroundColor: custom ? value : undefined,
            backgroundImage: custom
              ? undefined
              : "linear-gradient(135deg,#f87171,#facc15,#4ade80,#60a5fa)",
          }}
        />
        <input
          type="color"
          aria-label="Custom clip background"
          value={custom ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function ClipAppearance({ clip, onChange, compact = false }) {
  const theme = clip?.theme === "page" ? "page" : "source";
  const fit = clip?.fit || "scale";
  const background = clip?.background || "";

  const set = (patch) => onChange({ ...clip, ...patch });

  const themeChoices = (
    <div className="grid grid-cols-2 gap-1.5">
      {CLIP_THEMES.map((option) => (
        <Choice
          key={option.key}
          active={theme === option.key}
          onClick={() => set({ theme: option.key })}
          title={option.hint}
        >
          {option.label}
        </Choice>
      ))}
    </div>
  );

  const fitChoices = (
    <div className="grid grid-cols-4 gap-1.5">
      {CLIP_FITS.map((option) => (
        <Choice
          key={option.key}
          active={fit === option.key}
          onClick={() => set({ fit: option.key })}
          title={option.hint}
          className="flex-col gap-1.5"
        >
          <FitArt kind={option.key} />
          <span className="text-[11px] leading-none">{option.label}</span>
        </Choice>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <span className="text-[11px] text-text-tertiary">Width</span>
          {fitChoices}
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-text-tertiary">Colours</span>
          {themeChoices}
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-text-tertiary">Background</span>
          <BackgroundChoices
            value={background}
            onChange={(v) => set({ background: v })}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Field
        label="Width"
        hint="How the clip's own width meets your column. “Scale to fit” keeps the original proportions; “Fill width” lets it reflow."
      >
        {fitChoices}
      </Field>
      <Field
        label="Colours"
        hint="“Match my theme” lets your event page drive plain text and fills, keeping the source's brand accents."
      >
        {themeChoices}
      </Field>
      <Field
        label="Background"
        hint="What sits behind the clip. Use “None” for cut-out images that should float on your page."
      >
        <BackgroundChoices
          value={background}
          onChange={(v) => set({ background: v })}
        />
      </Field>
    </>
  );
}

export default ClipAppearance;
