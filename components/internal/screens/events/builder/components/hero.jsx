"use client";

import React from "react";
import { LayoutTemplate, Image as ImageIcon, AlignCenter, PanelTop } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isVideoFileUrl } from "@/lib/events/gallery";

const BUTTON_ITEM_FIELDS = [
  { key: "label", label: "Label", type: "text" },
  { key: "url", label: "Link", type: "text" },
  {
    key: "style",
    label: "Style",
    type: "select",
    options: [
      { key: "solid", label: "Solid" },
      { key: "outline", label: "Outline" },
    ],
  },
];

const IMAGE_POSITIONS = [
  { key: "left", label: "Image left" },
  { key: "right", label: "Image right" },
];

const HERO_HEIGHTS = [
  { key: "sm", label: "Short" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Tall" },
  { key: "full", label: "Full screen" },
];

const HEIGHT_CLASS = {
  sm: "min-h-[18rem]",
  md: "min-h-[26rem]",
  lg: "min-h-[36rem]",
  full: "min-h-[100svh]",
};

const ALIGN_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
];

function HeroButtons({ items, accent, className }) {
  const buttons = (Array.isArray(items) ? items : []).filter((b) => b?.label);
  if (!buttons.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {buttons.map((button, i) => {
        const outline = button.style === "outline";
        return (
          <Button
            key={i}
            asChild
            size="lg"
            variant={outline ? "outline" : "default"}
            style={
              outline
                ? { borderColor: accent.color, color: accent.color }
                : { backgroundColor: accent.color, color: accent.text }
            }
            className={cn("hover:opacity-90", outline && "bg-transparent")}
          >
            <a href={button.url || "#"}>{button.label}</a>
          </Button>
        );
      })}
    </div>
  );
}

function HeroCopy({ props, accent, centered }) {
  return (
    <div className={cn("space-y-5", centered && "text-center")}>
      <div className="space-y-3">
        {props.eyebrow ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: accent.color }}
          >
            {props.eyebrow}
          </p>
        ) : null}
        {props.title ? (
          <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            {props.title}
          </h1>
        ) : null}
        {props.subtitle ? (
          <p
            className={cn(
              "text-pretty text-base leading-relaxed text-text-secondary sm:text-lg",
              centered ? "mx-auto max-w-2xl" : "max-w-xl",
            )}
          >
            {props.subtitle}
          </p>
        ) : null}
      </div>
      <HeroButtons
        items={props.buttons}
        accent={accent}
        className={centered ? "justify-center" : undefined}
      />
    </div>
  );
}

function HeroImage({ url, alt }) {
  if (!url) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-border bg-surface-card text-text-tertiary">
        <ImageIcon className="h-10 w-10" />
      </div>
    );
  }
  if (isVideoFileUrl(url)) {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className="aspect-[4/3] w-full rounded-2xl border border-border bg-black object-cover"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || ""}
      className="aspect-[4/3] w-full rounded-2xl border border-border object-cover"
    />
  );
}

const COMMON_COPY_FIELDS = [
  { key: "eyebrow", label: "Eyebrow", type: "text", bindable: true },
  { key: "title", label: "Headline", type: "text", bindable: true },
  { key: "subtitle", label: "Subheading", type: "textarea", bindable: true },
  {
    key: "buttons",
    label: "Buttons",
    type: "items",
    addLabel: "Add button",
    itemFields: BUTTON_ITEM_FIELDS,
  },
];

export const HERO_COMPONENTS = [
  {
    type: "hero-split",
    label: "Split hero",
    icon: LayoutTemplate,
    category: "hero",
    defaultProps: {
      eyebrow: "{{event.startsAt | date:long}}",
      title: "{{event.name}}",
      subtitle: "{{event.tagline | fallback:Join us for a day worth clearing the calendar for.}}",
      imageUrl: "{{event.coverUrl}}",
      imagePosition: "right",
      buttons: [{ label: "Get tickets", url: "#tickets", style: "solid" }],
    },
    fields: [
      ...COMMON_COPY_FIELDS,
      { key: "imageUrl", label: "Image URL", type: "text", bindable: true, group: "Image" },
      { key: "imagePosition", label: "Image position", type: "select", options: IMAGE_POSITIONS },
    ],
    render: ({ props, accent }) => (
      <div className="grid items-center gap-10 sm:grid-cols-2">
        <div className={cn(props.imagePosition === "left" && "sm:order-2")}>
          <HeroCopy props={props} accent={accent} />
        </div>
        <div className={cn(props.imagePosition === "left" && "sm:order-1")}>
          <HeroImage url={props.imageUrl} alt={props.title} />
        </div>
      </div>
    ),
  },
  {
    type: "hero-banner",
    label: "Banner hero",
    icon: ImageIcon,
    category: "hero",
    defaultProps: {
      eyebrow: "",
      title: "{{event.name}}",
      subtitle: "{{event.startsAt | date:long}} · {{venue.name | fallback:Venue to be announced}}",
      imageUrl: "{{event.coverUrl}}",
      overlay: 55,
      height: "lg",
      align: "center",
      buttons: [{ label: "Get tickets", url: "#tickets", style: "solid" }],
    },
    fields: [
      ...COMMON_COPY_FIELDS,
      { key: "imageUrl", label: "Background image", type: "text", bindable: true, group: "Background" },
      { key: "overlay", label: "Overlay darkness", type: "range", min: 0, max: 90, step: 5, suffix: "%" },
      { key: "height", label: "Height", type: "select", options: HERO_HEIGHTS },
      { key: "align", label: "Content alignment", type: "select", options: ALIGN_OPTIONS },
    ],
    render: ({ props, accent }) => {
      const centered = props.align !== "left";
      const bannerVideo = isVideoFileUrl(props.imageUrl);
      return (
        <div
          className={cn(
            "relative isolate flex overflow-hidden rounded-2xl",
            HEIGHT_CLASS[props.height] || HEIGHT_CLASS.lg,
            centered ? "items-center justify-center" : "items-end",
          )}
          style={
            props.imageUrl && !bannerVideo
              ? {
                  backgroundImage: `url(${props.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { backgroundColor: "var(--surface-card)" }
          }
        >
          {bannerVideo ? (
            <video
              aria-hidden
              src={props.imageUrl}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          ) : null}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-black"
            style={{ opacity: (Number(props.overlay) || 0) / 100 }}
          />
          <div className={cn("w-full max-w-3xl p-8 sm:p-12", centered && "mx-auto")}>
            <HeroCopy props={props} accent={accent} centered={centered} />
          </div>
        </div>
      );
    },
  },
  {
    type: "hero-centered",
    label: "Centered hero",
    icon: AlignCenter,
    category: "hero",
    defaultProps: {
      eyebrow: "{{event.type}}",
      title: "{{event.name}}",
      subtitle: "{{event.startsAt | date:long}} · {{venue.full | fallback:Location to be announced}}",
      buttons: [
        { label: "Get tickets", url: "#tickets", style: "solid" },
        { label: "See the schedule", url: "#schedule", style: "outline" },
      ],
    },
    fields: COMMON_COPY_FIELDS,
    render: ({ props, accent }) => (
      <div className="py-6">
        <HeroCopy props={props} accent={accent} centered />
      </div>
    ),
  },
  {
    type: "titlebar",
    label: "Sticky title bar",
    icon: PanelTop,
    category: "hero",
    defaultProps: {
      title: "{{event.name}}",
      meta: "{{event.startsAt | date:medium}}",
      label: "Get tickets",
      url: "#tickets",
      sticky: true,
    },
    fields: [
      { key: "title", label: "Title", type: "text", bindable: true },
      { key: "meta", label: "Meta line", type: "text", bindable: true },
      { key: "label", label: "Button label", type: "text", bindable: true },
      { key: "url", label: "Button link", type: "text" },
      { key: "sticky", label: "Stick to the top when scrolling", type: "switch" },
    ],
    render: ({ props, accent }) => (
      <div
        className={cn(
          "z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle/95 px-4 py-3 backdrop-blur",
          props.sticky && "sticky top-4",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{props.title}</p>
          {props.meta ? (
            <p className="truncate text-xs text-text-secondary">{props.meta}</p>
          ) : null}
        </div>
        {props.label ? (
          <Button
            asChild
            size="sm"
            style={{ backgroundColor: accent.color, color: accent.text }}
            className="hover:opacity-90"
          >
            <a href={props.url || "#"}>{props.label}</a>
          </Button>
        ) : null}
      </div>
    ),
  },
];
