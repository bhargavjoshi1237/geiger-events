"use client";

import { useEffect, useId, useRef } from "react";
import {
  Code2,
  ListChecks,
  Table,
  Share2,
  Box,
  Megaphone,
  PanelBottom,
  Check,
  Star,
  Heart,
  Zap,
  Clock,
  MapPin,
  Users,
  Gift,
  Coffee,
  Music,
  Mic,
  Wifi,
  Car,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { useExternalResources } from "@/lib/events/custom_code";

export const ICON_CHOICES = {
  check: Check,
  star: Star,
  heart: Heart,
  zap: Zap,
  clock: Clock,
  pin: MapPin,
  users: Users,
  gift: Gift,
  coffee: Coffee,
  music: Music,
  mic: Mic,
  wifi: Wifi,
  car: Car,
};

const ICON_OPTIONS = Object.keys(ICON_CHOICES).map((key) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
}));

function activateScripts(root) {
  root.querySelectorAll("script").forEach((old) => {
    const script = document.createElement("script");
    for (const attr of old.attributes) script.setAttribute(attr.name, attr.value);
    script.textContent = old.textContent;
    old.replaceWith(script);
  });
}

function RawHtml({ props, ctx }) {
  const ref = useRef(null);
  const html = props.html || "";
  const runScripts = !!ctx?.runScripts;
  const clone = props.clone || {};
  const scope = useId();

  useExternalResources(ref, clone.enabled ? clone.assets : [], {
    runScripts,
    scope: `raw-html-${scope}`,
  });

  useEffect(() => {
    if (!runScripts || !ref.current || !html) return;
    activateScripts(ref.current);
  }, [html, runScripts]);

  if (!html.trim()) {
    return (
      <div className="flex min-h-[100px] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card p-5 text-sm text-text-tertiary">
        <Code2 className="h-4 w-4" /> Paste HTML to render it here.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("ev-raw-html", props.className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function IconList({ props, accent }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter((i) => i?.title);
  if (!items.length) return null;
  const columns = props.columns === "2" ? "sm:grid-cols-2" : "";

  return (
    <ul className={cn("grid grid-cols-1 gap-4", columns)}>
      {items.map((item, i) => {
        const Icon = ICON_CHOICES[item.icon] || Check;
        return (
          <li key={i} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle"
              style={{ color: accent.color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="font-medium text-foreground">{item.title}</span>
              {item.detail ? (
                <span className="block text-text-secondary">{item.detail}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function splitCells(value) {
  return String(value || "")
    .split(",")
    .map((c) => c.trim());
}

function DataTable({ props }) {
  const head = splitCells(props.head).filter(Boolean);
  const rows = (Array.isArray(props.rows) ? props.rows : []).filter((r) => r?.cells);
  if (!head.length && !rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
        Add column headings and rows.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        {head.length ? (
          <thead>
            <tr className="bg-surface-card">
              {head.map((cell, i) => (
                <th
                  key={i}
                  className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="bg-surface-subtle">
              {splitCells(row.cells).map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-border px-4 py-3 text-muted-foreground last:border-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SocialLinks({ props, accent }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter((i) => i?.url);
  if (!items.length) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        props.align === "center" && "justify-center",
      )}
    >
      {items.map((item, i) => (
        <a
          key={i}
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Share2 className="h-4 w-4" style={{ color: accent.color }} />
          {item.label || item.url}
        </a>
      ))}
    </div>
  );
}

function Container({ props, children }) {
  const padded = props.padding !== "none";
  return (
    <div
      className={cn(
        "flex",
        props.direction === "row" ? "flex-row flex-wrap" : "flex-col",
        padded && "p-5",
        props.card && "rounded-2xl border border-border bg-surface-subtle",
      )}
      style={{ gap: props.gap || "1rem" }}
    >
      {children}
    </div>
  );
}

const MARQUEE_SIZES = {
  md: "text-4xl sm:text-6xl",
  lg: "text-5xl sm:text-8xl",
  xl: "text-6xl sm:text-[10rem]",
};

// Two identical tracks slide left by exactly one track width, so the seam never
// shows however long the phrase is. Duplicated rather than looped in JS so it
// keeps running with scripts off in the editor canvas.
function Marquee({ props, accent }) {
  const scope = useId().replace(/[^a-zA-Z0-9]/g, "");
  const name = `evmq${scope}`;
  const text = props.text || "";
  if (!text.trim()) {
    return (
      <div className="flex min-h-[6rem] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-text-tertiary">
        <Megaphone className="h-4 w-4" /> Add a phrase to scroll.
      </div>
    );
  }

  const repeat = Math.min(8, Math.max(2, Number(props.repeat) || 4));
  const seconds = Math.min(120, Math.max(6, Number(props.speed) || 24));
  const separator = props.separator ?? "✦";
  const track = Array.from({ length: repeat }).map((_, i) => (
    <span key={i} className="flex shrink-0 items-center gap-8 pr-8">
      <span>{text}</span>
      {separator ? (
        <span aria-hidden style={{ color: accent.color }}>
          {separator}
        </span>
      ) : null}
    </span>
  ));

  return (
    <div
      className={cn(
        "relative flex w-full select-none overflow-hidden py-2",
        props.border !== false && "border-y border-border",
      )}
    >
      <style>{`
        @keyframes ${name}{from{transform:translateX(0)}to{transform:translateX(-100%)}}
        .${name}{animation:${name} ${seconds}s linear infinite}
        @media (prefers-reduced-motion: reduce){.${name}{animation:none}}
      `}</style>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={cn(
            name,
            "flex shrink-0 items-center whitespace-nowrap font-bold uppercase leading-none tracking-tight",
            MARQUEE_SIZES[props.size] || MARQUEE_SIZES.lg,
          )}
          style={
            props.outline
              ? {
                  color: "transparent",
                  WebkitTextStroke: `1.5px ${accent.color}`,
                }
              : undefined
          }
        >
          {track}
        </div>
      ))}
    </div>
  );
}

// The thumb-reach buy bar. Fixed to the viewport on the live page; inside the
// editor it pins to the bottom of the canvas, which is the same reading.
function StickyCta({ props, accent }) {
  const top = props.position === "top";
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-border bg-surface-subtle/95 backdrop-blur",
        top ? "top-0 border-b" : "bottom-0 border-t",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {props.title}
          </p>
          {props.note ? (
            <p className="truncate text-xs text-text-secondary">{props.note}</p>
          ) : null}
        </div>
        {props.label ? (
          <Button
            asChild
            size="lg"
            style={{ backgroundColor: accent.color, color: accent.text }}
            className="hover:opacity-90"
          >
            <a href={props.url || "#tickets"}>{props.label}</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export const STRUCTURE_COMPONENTS = [
  {
    type: "marquee",
    label: "Marquee band",
    icon: Megaphone,
    category: "custom",
    defaultProps: {
      text: "{{event.name}}",
      size: "lg",
      speed: 24,
      repeat: 4,
      separator: "✦",
      outline: false,
      border: true,
    },
    fields: [
      { key: "text", label: "Phrase", type: "text", bindable: true },
      {
        key: "size",
        label: "Size",
        type: "select",
        options: [
          { key: "md", label: "Large" },
          { key: "lg", label: "Huge" },
          { key: "xl", label: "Enormous" },
        ],
      },
      {
        key: "speed",
        label: "Seconds per loop",
        type: "range",
        min: 6,
        max: 120,
        step: 2,
        default: 24,
        suffix: "s",
        hint: "Longer is slower. The animation stops for visitors who ask for reduced motion.",
      },
      { key: "separator", label: "Separator", type: "text" },
      { key: "outline", label: "Outlined type", type: "switch" },
      { key: "border", label: "Rules above and below", type: "switch" },
    ],
    render: Marquee,
  },
  {
    type: "sticky-cta",
    label: "Sticky buy bar",
    icon: PanelBottom,
    category: "custom",
    singleton: true,
    defaultProps: {
      title: "{{event.name}}",
      note: "{{event.startsAt | date:medium}}",
      label: "Get tickets",
      url: "#tickets",
      position: "bottom",
    },
    fields: [
      { key: "title", label: "Title", type: "text", bindable: true },
      { key: "note", label: "Note", type: "text", bindable: true },
      { key: "label", label: "Button label", type: "text", bindable: true },
      { key: "url", label: "Button link", type: "text" },
      {
        key: "position",
        label: "Sticks to",
        type: "select",
        options: [
          { key: "bottom", label: "Bottom of the screen" },
          { key: "top", label: "Top of the screen" },
        ],
      },
    ],
    render: StickyCta,
  },
  {
    type: "raw-html",
    label: "Raw HTML",
    icon: Code2,
    category: "custom",
    requiresCustomCode: true,
    defaultProps: {
      html: "",
      className: "",
      clone: { url: "", enabled: false, assets: [] },
    },
    fields: [
      {
        key: "html",
        label: "HTML",
        type: "code",
        language: "html",
        hint: "Rendered exactly as written on your public page. Scripts run there, never in this editor.",
      },
      {
        key: "className",
        label: "Wrapper class",
        type: "text",
        hint: "A class of your own to target from custom CSS.",
      },
      {
        key: "clone",
        label: "Source styles & scripts",
        type: "clone-assets",
        hint: "Paste the page this HTML was cloned from, fetch its CSS and JS, then switch it on for the block to render clean.",
      },
    ],
    render: RawHtml,
  },
  {
    type: "icon-list",
    label: "Icon list",
    icon: ListChecks,
    category: "custom",
    defaultProps: {
      columns: "2",
      items: [
        { icon: "check", title: "Something included", detail: "" },
      ],
    },
    fields: [
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { key: "1", label: "1" },
          { key: "2", label: "2" },
        ],
      },
      {
        key: "items",
        label: "Items",
        type: "items",
        addLabel: "Add Item",
        itemFields: [
          { key: "icon", label: "Icon", type: "select", options: ICON_OPTIONS },
          { key: "title", label: "Title", type: "text", bindable: true },
          { key: "detail", label: "Detail", type: "text", bindable: true },
        ],
      },
    ],
    render: IconList,
  },
  {
    type: "table",
    label: "Table",
    icon: Table,
    category: "custom",
    defaultProps: { head: "", rows: [] },
    fields: [
      {
        key: "head",
        label: "Column headings",
        type: "text",
        hint: "Comma separated, e.g. Time, Session, Room.",
      },
      {
        key: "rows",
        label: "Rows",
        type: "items",
        addLabel: "Add row",
        itemFields: [
          { key: "cells", label: "Cells", type: "text", bindable: true, hint: "Comma separated." },
        ],
      },
    ],
    render: DataTable,
  },
  {
    type: "social",
    label: "Social links",
    icon: Share2,
    category: "custom",
    defaultProps: { align: "start", items: [] },
    fields: [
      {
        key: "align",
        label: "Alignment",
        type: "select",
        options: [
          { key: "start", label: "Left" },
          { key: "center", label: "Center" },
        ],
      },
      {
        key: "items",
        label: "Links",
        type: "items",
        addLabel: "Add link",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          { key: "url", label: "URL", type: "text" },
        ],
      },
    ],
    render: SocialLinks,
  },
  {
    type: "container",
    label: "Container",
    icon: Box,
    category: "custom",
    container: true,
    defaultProps: { direction: "column", gap: "1rem", padding: "md", card: false },
    fields: [
      {
        key: "direction",
        label: "Direction",
        type: "select",
        options: [
          { key: "column", label: "Stacked" },
          { key: "row", label: "Side by side" },
        ],
      },
      { key: "gap", label: "Gap", type: "text", hint: "Any CSS length, e.g. 1rem." },
      {
        key: "padding",
        label: "Padding",
        type: "select",
        options: [
          { key: "none", label: "None" },
          { key: "md", label: "Padded" },
        ],
      },
      { key: "card", label: "Card surface", type: "switch" },
    ],
    render: Container,
  },
];
