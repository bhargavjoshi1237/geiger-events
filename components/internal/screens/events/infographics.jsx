"use client";
/* eslint-disable @next/next/no-img-element -- previews render remote organizer image URLs; next/image adds no value here */

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  PanelBottom,
  Pencil,
  Plus,
  Quote,
  Trash2,
} from "lucide-react";

import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { FieldList } from "./builder/field_editor";
import { ScrollArea } from "@geiger/ui/scroll-area";
import { useEventConfig } from "@/lib/events/use-event-config";
import { cn } from "@/lib/utils";

const TITLE_ALIGN_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
  { key: "right", label: "Right" },
];

const IMAGE_SIDE_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

const TEXT_SIDE_OPTIONS = [
  { key: "bottom", label: "Bottom" },
  { key: "top", label: "Top" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

const LAYOUT_MODE_OPTIONS = [
  { key: "grid", label: "Grid" },
  { key: "flex", label: "Flex" },
];

const COLUMNS_OPTIONS = [
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
];

const QUOTE_COLUMNS_OPTIONS = [
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
];

const CAROUSEL_MODE_OPTIONS = [
  { key: "row", label: "Row" },
  { key: "single", label: "One at a time" },
];

const QUOTE_LAYOUT_OPTIONS = [
  { key: "grid", label: "Grid" },
  { key: "single", label: "One at a time" },
];

const CAROUSEL_ITEM_FIELDS = [
  { key: "title", label: "Title", type: "text" },
  { key: "text", label: "Text", type: "textarea" },
  { key: "image", label: "Image URL", type: "text", hint: "Used as the card's background — content sits on top of it." },
  {
    key: "textColor",
    label: "Text colour",
    type: "color",
    hint: "Leave unset to inherit the page colours.",
  },
  {
    key: "textSide",
    label: "Text side",
    type: "select",
    options: TEXT_SIDE_OPTIONS,
    hint: "Runs the text along the bottom, or takes the left/right half of the image.",
  },
  { key: "ctaLabel", label: "Button label", type: "text" },
  { key: "ctaUrl", label: "Button link", type: "text" },
  {
    key: "ctaColor",
    label: "Button colour",
    type: "color",
    hint: "Paints the button; leave unset for the default text link.",
  },
];

const QUOTE_ITEM_FIELDS = [
  { key: "quote", label: "Quote", type: "textarea" },
  { key: "name", label: "Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "avatarUrl", label: "Photo URL", type: "text" },
];

const SHOWCASE_ITEM_FIELDS = [
  { key: "title", label: "Title", type: "text" },
  { key: "text", label: "Text", type: "textarea" },
  { key: "image", label: "Image URL", type: "text", hint: "Used as the card's background — content sits on top of it." },
  { key: "link", label: "Link", type: "text", hint: "Where the whole card points." },
  { key: "ctaLabel", label: "Button label", type: "text" },
  { key: "ctaUrl", label: "Button link", type: "text" },
  {
    key: "textSide",
    label: "Text side",
    type: "select",
    options: TEXT_SIDE_OPTIONS,
    hint: "Runs the text along the bottom, or takes the left/right half of the image.",
  },
  {
    key: "details",
    label: "Extra details",
    type: "textarea",
    hint: "Only shown when the card opens in its full showcase.",
  },
];

const FOOTER_ITEM_FIELDS = [
  { key: "title", label: "Label", type: "text" },
  { key: "link", label: "Link", type: "text" },
  { key: "image", label: "Image URL", type: "text", hint: "Optional logo." },
  { key: "ctaLabel", label: "Button label", type: "text" },
  { key: "ctaUrl", label: "Button link", type: "text" },
];

const SECTION_TITLE_FIELD = {
  key: "title",
  label: "Section title",
  type: "text",
  hint: "Leave empty for no heading.",
};

export const INFOGRAPHIC_TYPES = [
  {
    type: "carousel",
    label: "Info carousel",
    icon: Images,
    description:
      "A scrolling row of slides — each with an image, heading, text, and optional button.",
    defaultProps: { title: "", titleAlign: "left", autoplay: true, mode: "row", items: [] },
    fields: [
      SECTION_TITLE_FIELD,
      { key: "titleAlign", label: "Title alignment", type: "select", options: TITLE_ALIGN_OPTIONS },
      { key: "autoplay", label: "Auto-advance slides", type: "switch", hint: "Slides move on their own once the section is in view." },
      { key: "mode", label: "Display", type: "select", options: CAROUSEL_MODE_OPTIONS, hint: "Row shows several slides side by side; one at a time rotates a single slide." },
      { key: "items", label: "Slides", type: "items", addLabel: "Add slide", itemFields: CAROUSEL_ITEM_FIELDS },
    ],
  },
  {
    type: "split",
    label: "Split CTA",
    icon: Columns2,
    description:
      "Heading, text, and button on one side with an image on the other — flip the image side to taste.",
    defaultProps: {
      title: "",
      titleAlign: "left",
      text: "",
      image: "",
      imageSide: "right",
      ctaLabel: "",
      ctaUrl: "",
    },
    fields: [
      SECTION_TITLE_FIELD,
      { key: "titleAlign", label: "Title alignment", type: "select", options: TITLE_ALIGN_OPTIONS },
      { key: "text", label: "Text", type: "textarea" },
      { key: "imageSide", label: "Image side", type: "select", options: IMAGE_SIDE_OPTIONS },
      { key: "image", label: "Image URL", type: "text" },
      { key: "ctaLabel", label: "Button label", type: "text" },
      { key: "ctaUrl", label: "Button link", type: "text" },
    ],
  },
  {
    type: "quotes",
    label: "Quotes showcase",
    icon: Quote,
    description:
      "A grid of testimonials — quote, name, role, and photo per card.",
    defaultProps: { title: "", titleAlign: "left", columns: "3", layout: "grid", items: [] },
    fields: [
      SECTION_TITLE_FIELD,
      { key: "titleAlign", label: "Title alignment", type: "select", options: TITLE_ALIGN_OPTIONS },
      { key: "layout", label: "Quote layout", type: "select", options: QUOTE_LAYOUT_OPTIONS, hint: "Grid shows several quotes at once; one at a time rotates them." },
      { key: "columns", label: "Columns", type: "select", options: QUOTE_COLUMNS_OPTIONS, showWhen: { layout: "grid" } },
      { key: "items", label: "Quotes", type: "items", addLabel: "Add quote", itemFields: QUOTE_ITEM_FIELDS },
    ],
  },
  {
    type: "footer",
    label: "Footer band",
    icon: PanelBottom,
    description:
      "A closing section — title, links, optional logos, and a note that wrap up the page.",
    defaultProps: { title: "", titleAlign: "left", note: "", items: [] },
    fields: [
      SECTION_TITLE_FIELD,
      { key: "titleAlign", label: "Title alignment", type: "select", options: TITLE_ALIGN_OPTIONS },
      { key: "note", label: "Note", type: "textarea", hint: "Bottom line — contact details, copyright, small print." },
      { key: "items", label: "Links", type: "items", addLabel: "Add link", itemFields: FOOTER_ITEM_FIELDS },
    ],
  },
  {
    type: "showcase",
    label: "Info showcase",
    icon: LayoutGrid,
    description:
      "A title with adjustable cards below — grid or flex, 1–6 columns, each card with title, text, image, link, and button.",
    defaultProps: { title: "", titleAlign: "left", layoutMode: "grid", columns: "3", showOne: false, clickOpen: false, items: [] },
    fields: [
      SECTION_TITLE_FIELD,
      { key: "titleAlign", label: "Title alignment", type: "select", options: TITLE_ALIGN_OPTIONS },
      { key: "layoutMode", label: "Layout", type: "select", options: LAYOUT_MODE_OPTIONS, showWhen: { showOne: false } },
      { key: "columns", label: "Columns per row", type: "select", options: COLUMNS_OPTIONS, showWhen: { showOne: false } },
      { key: "showOne", label: "Show one card at a time", type: "switch", hint: "Rotates a single card instead of laying them all out." },
      { key: "clickOpen", label: "Open full showcase on click", type: "switch", hint: "Cards open a full-screen preview of the image and details instead of (or in addition to) linking out." },
      { key: "items", label: "Cards", type: "items", addLabel: "Add card", itemFields: SHOWCASE_ITEM_FIELDS },
    ],
  },
];

export function getInfographicMeta(type) {
  return INFOGRAPHIC_TYPES.find((t) => t.type === type) || INFOGRAPHIC_TYPES[0];
}

let infCounter = 0;
function createInfographic(type) {
  const meta = getInfographicMeta(type);
  infCounter += 1;
  return {
    id: `inf_${Date.now()}_${infCounter}`,
    type,
    props: JSON.parse(JSON.stringify(meta.defaultProps)),
  };
}

const TITLE_ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const GRID_COLS_CLASS = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

const FLEX_WIDTH_CLASS = {
  1: "sm:w-full",
  2: "sm:w-[48%]",
  3: "sm:w-[31%]",
  4: "sm:w-[23%]",
  5: "sm:w-[18%]",
  6: "sm:w-[15%]",
};

function PreviewTitle({ title, align }) {
  if (!title) return null;
  return (
    <h3
      className={cn(
        "px-1 text-lg font-semibold text-foreground",
        TITLE_ALIGN_CLASS[align] || TITLE_ALIGN_CLASS.left,
      )}
    >
      {title}
    </h3>
  );
}

function PreviewEmpty({ label }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-tertiary">
      {label}
    </p>
  );
}

function SingleRotatorPreview({ items, render }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const idx = Math.min(i, items.length - 1);
  const prev = () => {
    setDir(-1);
    setI((idx - 1 + items.length) % items.length);
  };
  const next = () => {
    setDir(1);
    setI((idx + 1) % items.length);
  };
  return (
    <div className="space-y-2">
      <div
        key={idx}
        className={cn(
          "w-full",
          dir > 0
            ? "animate-in slide-in-from-right-4 duration-300"
            : "animate-in slide-in-from-left-4 duration-300",
        )}
      >
        {render(items[idx])}
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-text-tertiary">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous item"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-secondary transition-colors hover:bg-surface-active hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="tabular-nums">
          {idx + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={next}
          aria-label="Next item"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-secondary transition-colors hover:bg-surface-active hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PreviewImage({ src, className, children }) {
  if (src) {
    return <img src={src} alt="" loading="lazy" className={className} />;
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-surface-subtle text-text-tertiary",
        className,
      )}
    >
      <ImageIcon className="h-6 w-6" />
    </div>
  );
}

function CarouselPreview({ props }) {
  const items = Array.isArray(props.items) ? props.items : [];
  const card = (it) => {
    const info = (
      <div
        className="space-y-1.5"
        style={it.textColor ? { color: it.textColor } : undefined}
      >
        {it.title ? (
          <p className="truncate text-sm font-semibold">{it.title}</p>
        ) : null}
        {it.text ? (
          <p className="line-clamp-2 text-xs leading-relaxed opacity-90">{it.text}</p>
        ) : null}
        {it.ctaLabel ? (
          it.ctaColor ? (
            <span
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: it.ctaColor, color: "#ffffff" }}
            >
              {it.ctaLabel} <ArrowRight className="h-3 w-3" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2">
              {it.ctaLabel} <ArrowRight className="h-3 w-3" />
            </span>
          )
        ) : null}
      </div>
    );
    return it.image ? (
      <div className="relative flex min-h-[12rem] overflow-hidden">
        <img
          src={it.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {it.textSide === "left" || it.textSide === "right" ? (
          <>
            <div
              className={cn(
                "absolute inset-y-0 w-1/2",
                it.textSide === "left"
                  ? "left-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
                  : "right-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent",
              )}
            />
            <div
              className={cn(
                "relative flex w-1/2 flex-col justify-end p-3 text-white",
                it.textSide === "left" ? "items-start" : "ml-auto items-end text-right",
              )}
            >
              {info}
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="relative flex w-full flex-col justify-end p-3 text-white">
              {info}
            </div>
          </>
        )}
      </div>
    ) : (
      <div className="p-3 text-foreground">{info}</div>
    );
  };
  return (
    <div className="space-y-2">
      <PreviewTitle title={props.title} align={props.titleAlign} />
      {!items.length ? (
        <PreviewEmpty label="No slides yet — add them below." />
      ) : props.mode === "single" ? (
        <SingleRotatorPreview
          items={items}
          render={(it) => (
            <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
              {card(it)}
            </div>
          )}
        />
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="w-56 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-surface-card"
            >
              {card(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitPreview({ props }) {
  const imageFirst = props.imageSide === "left";
  const info = (
    <div className="flex flex-col items-start justify-center gap-2 p-3">
      {props.title ? (
        <p className="text-base font-semibold text-foreground">{props.title}</p>
      ) : null}
      {props.text ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-text-secondary">{props.text}</p>
      ) : null}
      {props.ctaLabel ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          {props.ctaLabel} <ArrowRight className="h-3 w-3" />
        </span>
      ) : null}
    </div>
  );
  const image = (
    <PreviewImage
      src={props.image}
      className="aspect-[4/3] w-full object-cover sm:aspect-auto sm:h-full"
    >
      <span className="text-[0.65rem] uppercase tracking-wider">Image</span>
    </PreviewImage>
  );
  return (
    <div className="space-y-2">
      <PreviewTitle title={props.title} align={props.titleAlign} />
      <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-surface-card sm:grid-cols-2">
        {imageFirst ? image : info}
        {imageFirst ? info : image}
      </div>
    </div>
  );
}

function QuotesPreview({ props }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter((t) => t?.quote);
  const figure = (it) => (
    <figure className="flex h-full flex-col gap-2.5 rounded-xl border border-border bg-surface-card p-3.5">
      <Quote className="h-4 w-4 shrink-0 text-text-tertiary" />
      <blockquote className="line-clamp-3 flex-1 text-xs leading-relaxed text-text-secondary">
        {it.quote}
      </blockquote>
      <figcaption className="flex items-center gap-2">
        {it.avatarUrl ? (
          <img
            src={it.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-subtle text-[0.6rem] font-medium text-text-tertiary">
            {(it.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {it.name || "Anonymous"}
          </p>
          {it.role ? (
            <p className="truncate text-[0.65rem] text-text-tertiary">{it.role}</p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
  return (
    <div className="space-y-2">
      <PreviewTitle title={props.title} align={props.titleAlign} />
      {!items.length ? (
        <PreviewEmpty label="No quotes yet — add them below." />
      ) : props.layout === "single" ? (
        <SingleRotatorPreview items={items} render={figure} />
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", GRID_COLS_CLASS[Number(props.columns) || 3])}>
          {items.map((it, i) => (
            <div key={i} className="contents">
              {figure(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FooterPreview({ props }) {
  const items = Array.isArray(props.items) ? props.items : [];
  return (
    <div className="space-y-2">
      <PreviewTitle title={props.title} align={props.titleAlign} />
      <div className="space-y-3 rounded-xl border border-border bg-surface-card p-4">
        {items.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs text-foreground"
              >
                {it.image ? (
                  <img src={it.image} alt="" className="h-4 w-4 object-contain" />
                ) : null}
                <span className="max-w-[10rem] truncate font-medium">{it.title || "Untitled"}</span>
                {it.ctaLabel ? (
                  <span className="text-primary">{it.ctaLabel}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <PreviewEmpty label="No links yet — add them below." />
        )}
        {props.note ? (
          <p className="border-t border-border pt-2.5 text-[0.65rem] leading-relaxed text-text-tertiary">
            {props.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShowcasePreview({ props }) {
  const items = Array.isArray(props.items) ? props.items : [];
  const columns = Number(props.columns) || 3;
  const flexMode = props.layoutMode === "flex";
  const card = (it) => {
    const info = (
      <div className="space-y-1.5">
        {it.title ? (
          <p className="truncate text-sm font-semibold text-foreground">{it.title}</p>
        ) : null}
        {it.text ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
            {it.text}
          </p>
        ) : null}
        {it.link || it.ctaLabel ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {it.ctaLabel || "Open link"} <ArrowRight className="h-3 w-3" />
          </span>
        ) : null}
        {it.details ? (
          <p className="line-clamp-2 text-[0.65rem] leading-relaxed text-text-tertiary">
            {it.details}
          </p>
        ) : null}
      </div>
    );
    return it.image ? (
      <div className="relative flex min-h-[11rem] overflow-hidden rounded-xl">
        <img
          src={it.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {it.textSide === "left" || it.textSide === "right" ? (
          <>
            <div
              className={cn(
                "absolute inset-y-0 w-1/2",
                it.textSide === "left"
                  ? "left-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent"
                  : "right-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent",
              )}
            />
            <div
              className={cn(
                "relative flex w-1/2 flex-col justify-end p-3 text-white",
                it.textSide === "left" ? "items-start" : "ml-auto items-end text-right",
              )}
            >
              {info}
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="relative flex w-full flex-col justify-end p-3 text-white">
              {info}
            </div>
          </>
        )}
      </div>
    ) : (
      <div className="p-3 text-foreground">{info}</div>
    );
  };
  return (
    <div className="space-y-2">
      <PreviewTitle title={props.title} align={props.titleAlign} />
      {!items.length ? (
        <PreviewEmpty label="No cards yet — add them below." />
      ) : props.showOne ? (
        <SingleRotatorPreview
          items={items}
          render={(it) => (
            <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
              {card(it)}
            </div>
          )}
        />
      ) : flexMode ? (
        <div className="flex flex-wrap gap-3">
          {items.map((it, i) => (
            <div
              key={i}
              className={cn(
                "w-full overflow-hidden rounded-xl border border-border bg-surface-card",
                FLEX_WIDTH_CLASS[columns],
              )}
            >
              {card(it)}
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", GRID_COLS_CLASS[columns])}>
          {items.map((it, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border bg-surface-card"
            >
              {card(it)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockPreview({ block }) {
  const meta = getInfographicMeta(block.type);
  switch (block.type) {
    case "carousel":
      return <CarouselPreview props={block.props} />;
    case "split":
      return <SplitPreview props={block.props} />;
    case "quotes":
      return <QuotesPreview props={block.props} />;
    case "footer":
      return <FooterPreview props={block.props} />;
    case "showcase":
      return <ShowcasePreview props={block.props} />;
    default:
      return <p className="text-sm text-text-tertiary">{meta.label}</p>;
  }
}

function CarouselMock() {
  return (
    <div className="flex h-full items-stretch gap-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-surface-subtle">
          <div className="h-8 bg-surface-strong/60" />
          <div className="space-y-1 p-1.5">
            <div className="h-1 w-3/4 rounded-full bg-surface-strong/80" />
            <div className="h-1 w-full rounded-full bg-surface-strong/50" />
            <div className="h-1 w-1/2 rounded-full bg-surface-strong/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitMock() {
  return (
    <div className="flex h-full items-stretch gap-1.5">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-md border border-border bg-surface-subtle p-2">
        <div className="h-1 w-3/4 rounded-full bg-surface-strong/80" />
        <div className="h-1 w-full rounded-full bg-surface-strong/50" />
        <div className="h-1 w-2/3 rounded-full bg-surface-strong/40" />
        <div className="mt-1.5 h-3.5 w-10 rounded-sm bg-primary/80" />
      </div>
      <div className="w-2/5 overflow-hidden rounded-md border border-border">
        <div className="h-full w-full bg-gradient-to-br from-surface-strong/80 to-surface-card" />
      </div>
    </div>
  );
}

function QuotesMock() {
  return (
    <div className="flex h-full items-stretch gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-border bg-surface-subtle p-1.5"
        >
          <Quote className="h-2.5 w-2.5 opacity-70" />
          <div className="h-1 w-full rounded-full bg-surface-strong/50" />
          <div className="h-1 w-3/4 rounded-full bg-surface-strong/40" />
          <div className="mt-auto flex items-center gap-1">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-strong/70" />
            <div className="h-1 w-1/2 rounded-full bg-surface-strong/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FooterMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 rounded-md border border-border bg-surface-subtle p-2">
      <div className="h-1 w-1/3 rounded-full bg-surface-strong/80" />
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-2.5 min-w-0 flex-1 rounded-sm bg-surface-strong/50" />
        ))}
      </div>
      <div className="mt-0.5 border-t border-border pt-1.5">
        <div className="h-1 w-2/5 rounded-full bg-surface-strong/40" />
      </div>
    </div>
  );
}

function ShowcaseMock() {
  return (
    <div className="grid h-full grid-cols-3 gap-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-subtle">
          <div className="h-6 bg-surface-strong/60" />
          <div className="space-y-1 p-1.5">
            <div className="h-1 w-3/4 rounded-full bg-surface-strong/80" />
            <div className="h-1 w-full rounded-full bg-surface-strong/50" />
            <div className="h-1 w-2/3 rounded-full bg-surface-strong/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

const TYPE_MOCKS = {
  carousel: CarouselMock,
  split: SplitMock,
  quotes: QuotesMock,
  footer: FooterMock,
  showcase: ShowcaseMock,
};

function TypePicker({ open, onOpenChange, onPick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background">
        <DialogHeader>
          <DialogTitle>Add an infographic</DialogTitle>
          <DialogDescription>
            Pick a shape — every field, item, and alignment stays adjustable
            after it&apos;s added.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INFOGRAPHIC_TYPES.map((t, ti) => {
            const Icon = t.icon;
            const Mock = TYPE_MOCKS[t.type];
            const featured = ti === INFOGRAPHIC_TYPES.length - 1;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => onPick(t.type)}
                className={cn(
                  "group flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4 text-left outline-none transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/50",
                  featured && "sm:col-span-2",
                )}
              >
                <div className="h-16">
                  {Mock ? <Mock /> : null}
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{t.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                      {t.description}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({ draft, meta, onChange, onClose, onSave }) {
  const patch = (key, value) =>
    onChange({ ...draft, props: { ...draft.props, [key]: value } });

  return (
    <Dialog open={!!draft} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background">
        <DialogHeader>
          <DialogTitle>
            {draft?.saved ? "Edit infographic" : "Add infographic"} — {meta?.label}
          </DialogTitle>
          <DialogDescription>
            The preview updates as you type. Items hold everything you&apos;d
            expect — title, link, button, image — and each one is adjustable.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-6">
              <div className="rounded-xl border border-border bg-surface-subtle p-3">
                <BlockPreview block={draft} />
              </div>
              <div className="space-y-4">
                <FieldList fields={meta.fields} values={draft.props} onChange={patch} />
              </div>
            </div>
          </ScrollArea>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onSave}
          >
            {draft?.saved ? "Save changes" : "Add infographic"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InfographicsSection({ event, headerItem }) {
  const [blocks, , saveBlocks] = useEventConfig(event, "infographics", []);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [removing, setRemoving] = useState(null);

  const rows = Array.isArray(blocks) ? blocks : [];

  const saveList = (next, successMsg) =>
    saveBlocks(next, successMsg ? { successMsg } : undefined);

  const move = (i, dir) => {
    const ni = i + dir;
    if (ni < 0 || ni >= rows.length) return;
    const copy = [...rows];
    [copy[i], copy[ni]] = [copy[ni], copy[i]];
    saveList(copy);
  };

  const removeBlock = (i) => saveList(rows.filter((_, j) => j !== i));

  const confirmRemove = () => {
    if (removing == null) return;
    removeBlock(removing);
    setRemoving(null);
  };

  const pickType = (type) => {
    setPicking(false);
    const block = createInfographic(type);
    setEditing({ id: block.id, isNew: true, saved: false });
    setDraft(block);
  };

  const openBlock = (block) => {
    setEditing({ id: block.id, isNew: false, saved: true });
    setDraft(JSON.parse(JSON.stringify(block)));
  };

  const commit = () => {
    if (!draft) return;
    if (editing.isNew) {
      saveList([...rows, draft], "Infographic added.");
    } else {
      saveList(rows.map((b) => (b.id === draft.id ? draft : b)), "Infographic updated.");
    }
    setDraft(null);
    setEditing(null);
  };

  const close = () => {
    setDraft(null);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Infographics"}
        description={headerItem?.desc}
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setPicking(true)}
          >
            <Plus className="h-4 w-4" /> Add infographic
          </Button>
        }
      />

      {rows.length ? (
        <div className="space-y-2">
          {rows.map((b, i) => {
            const meta = getInfographicMeta(b.type);
            const Icon = meta.icon;
            const count = Array.isArray(b.props?.items) ? b.props.items.length : 0;
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {b.props?.title || meta.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {meta.label}
                    {count ? ` · ${count} ${count === 1 ? "item" : "items"}` : ""}
                  </p>
                </div>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openBlock(b)}
                    aria-label="Edit"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoving(i)}
                    aria-label="Delete"
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <LayoutGrid className="h-6 w-6" />
          <p className="text-sm">Add your first infographic</p>
        </button>
      )}

      <TypePicker
        open={picking}
        onOpenChange={setPicking}
        onPick={pickType}
      />

      <BlockDialog
        draft={draft}
        meta={draft ? getInfographicMeta(draft.type) : null}
        onChange={setDraft}
        onClose={close}
        onSave={commit}
      />

      <Dialog
        open={removing != null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Delete infographic?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {removing != null
                  ? rows[removing]?.props?.title ||
                    getInfographicMeta(rows[removing]?.type)?.label
                  : ""}
              </span>
              ? It will be removed from the event page. This action can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={confirmRemove}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InfographicsSection;