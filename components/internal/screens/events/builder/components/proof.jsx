"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Images,
  Quote,
  BarChart3,
  PanelsTopLeft,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { entryUrl } from "@/lib/events/gallery";
import { cn } from "@/lib/utils";
import { RichText } from "../../page_blocks";
import { initials } from "../../sample_data";

const SOURCE_OPTIONS = [
  { key: "event", label: "From the event" },
  { key: "custom", label: "Custom list" },
];

const COLUMN_OPTIONS = [
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
];

const COLS_CLASS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

function gridCols(value) {
  return COLS_CLASS[String(value)] || COLS_CLASS[3];
}

function Heading({ children }) {
  if (!children) return null;
  return <h2 className="text-xl font-semibold text-foreground">{children}</h2>;
}

function Speakers({ props, event }) {
  const source =
    props.source === "custom"
      ? Array.isArray(props.items)
        ? props.items
        : []
      : Array.isArray(event?.guests)
        ? event.guests
        : [];
  const people = source.filter((p) => p?.name);
  if (!people.length) return null;

  return (
    <section className="space-y-4">
      <Heading>{props.title}</Heading>
      <div className={cn("grid grid-cols-1 gap-4", gridCols(props.columns))}>
        {people.map((person, i) => (
          <div
            key={person.id || i}
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-subtle p-5 text-center"
          >
            {person.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.image}
                alt=""
                className="h-20 w-20 rounded-full border border-border object-cover"
              />
            ) : (
              <Avatar className="h-20 w-20 border border-border">
                <AvatarFallback className="bg-surface-card text-base text-muted-foreground">
                  {initials(person.name)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">{person.name}</p>
              {person.role ? (
                <p className="text-xs font-medium text-text-secondary">{person.role}</p>
              ) : null}
              {props.showBio !== false && person.bio ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{person.bio}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogoWall({ props }) {
  const logos = (Array.isArray(props.items) ? props.items : []).filter((l) => l?.url);
  if (!logos.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
        Add sponsor logos to fill this row.
      </p>
    );
  }
  return (
    <section className="space-y-4">
      <Heading>{props.title}</Heading>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-10 gap-y-6",
          props.align === "center" ? "justify-center" : "justify-start",
        )}
      >
        {logos.map((logo, i) => {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo.url}
              alt={logo.alt || ""}
              className={cn(
                "h-10 w-auto max-w-[10rem] object-contain",
                props.muted !== false && "opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0",
              )}
            />
          );
          return logo.link ? (
            <a key={i} href={logo.link} target="_blank" rel="noreferrer noopener">
              {image}
            </a>
          ) : (
            <React.Fragment key={i}>{image}</React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function Testimonials({ props }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter((t) => t?.quote);
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <Heading>{props.title}</Heading>
      <div className={cn("grid grid-cols-1 gap-4", gridCols(props.columns))}>
        {items.map((item, i) => (
          <figure
            key={i}
            className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-5"
          >
            <Quote className="h-5 w-5 shrink-0 text-text-tertiary" />
            <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.quote}
            </blockquote>
            <figcaption className="flex items-center gap-3">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full border border-border object-cover"
                />
              ) : (
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-surface-card text-xs text-muted-foreground">
                    {initials(item.name || "?")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                {item.role ? (
                  <p className="truncate text-xs text-text-secondary">{item.role}</p>
                ) : null}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Lightbox({ images, index, onClose, onStep }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    const doc = typeof document !== "undefined" ? document : null;
    doc?.addEventListener("keydown", onKey);
    return () => doc?.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <img
        src={images[index]}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              onStep(-1);
            }}
            className="absolute left-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              onStep(1);
            }}
            className="absolute right-5 top-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function Gallery({ props, event }) {
  const [open, setOpen] = useState(null);
  const images =
    props.source === "custom"
      ? (Array.isArray(props.items) ? props.items : []).map((i) => i?.url).filter(Boolean)
      : Array.isArray(event?.gallery)
        ? event.gallery.map(entryUrl).filter(Boolean)
        : [];

  if (!images.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
        Add images to the event gallery and they will appear here.
      </p>
    );
  }

  const step = (dir) =>
    setOpen((i) => (i == null ? i : (i + dir + images.length) % images.length));

  return (
    <section className="space-y-4">
      <Heading>{props.title}</Heading>
      <div className={cn("grid grid-cols-2 gap-3", gridCols(props.columns))}>
        {images.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => props.lightbox !== false && setOpen(i)}
            className="group overflow-hidden rounded-xl border border-border"
            aria-label={`Open image ${i + 1}`}
          >
            <img
              src={url}
              alt=""
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      {open != null ? (
        <Lightbox images={images} index={open} onClose={() => setOpen(null)} onStep={step} />
      ) : null}
    </section>
  );
}

function Stats({ props, accent }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter(
    (s) => s?.value || s?.label,
  );
  if (!items.length) return null;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border",
        items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {items.map((stat, i) => (
        <div key={i} className="flex flex-col items-center gap-1 bg-surface-subtle px-4 py-6">
          <span
            className="text-3xl font-bold tabular-nums leading-none"
            style={{ color: accent.color }}
          >
            {stat.value}
          </span>
          <span className="text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Tabs({ props, accent }) {
  const items = (Array.isArray(props.items) ? props.items : []).filter((t) => t?.label);
  const [active, setActive] = useState(0);
  if (!items.length) return null;
  const current = items[Math.min(active, items.length - 1)];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {items.map((tab, i) => {
          const selected = i === Math.min(active, items.length - 1);
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "text-foreground"
                  : "border-transparent text-text-secondary hover:text-foreground",
              )}
              style={selected ? { borderColor: accent.color } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        <RichText source={current.content} />
      </div>
    </div>
  );
}

const PERSON_FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "bio", label: "Bio", type: "textarea" },
  { key: "image", label: "Photo URL", type: "text" },
];

export const PROOF_COMPONENTS = [
  {
    type: "speakers",
    label: "Speaker grid",
    icon: Users,
    category: "proof",
    defaultProps: {
      title: "Speakers",
      source: "event",
      columns: "3",
      showBio: true,
      items: [],
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "source", label: "People", type: "select", options: SOURCE_OPTIONS },
      { key: "columns", label: "Columns", type: "select", options: COLUMN_OPTIONS },
      { key: "showBio", label: "Show bios", type: "switch" },
      {
        key: "items",
        label: "People",
        type: "items",
        addLabel: "Add person",
        itemFields: PERSON_FIELDS,
        showWhen: { source: "custom" },
      },
    ],
    render: Speakers,
  },
  {
    type: "logo-wall",
    label: "Logo wall",
    icon: Building2,
    category: "proof",
    defaultProps: {
      title: "Backed by",
      align: "center",
      muted: true,
      items: [],
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      {
        key: "align",
        label: "Alignment",
        type: "select",
        options: [
          { key: "start", label: "Left" },
          { key: "center", label: "Center" },
        ],
      },
      { key: "muted", label: "Grey out until hover", type: "switch" },
      {
        key: "items",
        label: "Logos",
        type: "items",
        addLabel: "Add logo",
        itemFields: [
          { key: "url", label: "Logo URL", type: "text" },
          { key: "alt", label: "Name", type: "text" },
          { key: "link", label: "Links to", type: "text" },
        ],
      },
    ],
    render: LogoWall,
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: Quote,
    category: "proof",
    defaultProps: { title: "What people said", columns: "3", items: [] },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "columns", label: "Columns", type: "select", options: COLUMN_OPTIONS },
      {
        key: "items",
        label: "Quotes",
        type: "items",
        addLabel: "Add quote",
        itemFields: [
          { key: "quote", label: "Quote", type: "textarea" },
          { key: "name", label: "Name", type: "text" },
          { key: "role", label: "Role", type: "text" },
          { key: "avatarUrl", label: "Photo URL", type: "text" },
        ],
      },
    ],
    render: Testimonials,
  },
  {
    type: "gallery",
    label: "Gallery",
    icon: Images,
    category: "proof",
    defaultProps: {
      title: "",
      source: "event",
      columns: "3",
      lightbox: true,
      items: [],
    },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "source", label: "Images", type: "select", options: SOURCE_OPTIONS },
      { key: "columns", label: "Columns", type: "select", options: COLUMN_OPTIONS },
      { key: "lightbox", label: "Open full size on click", type: "switch" },
      {
        key: "items",
        label: "Images",
        type: "items",
        addLabel: "Add image",
        itemFields: [{ key: "url", label: "Image URL", type: "text" }],
        showWhen: { source: "custom" },
      },
    ],
    render: Gallery,
  },
  {
    type: "stats",
    label: "Stats row",
    icon: BarChart3,
    category: "proof",
    defaultProps: {
      items: [
        { value: "{{counts.going | number}}", label: "Going" },
        { value: "{{counts.sessions}}", label: "Sessions" },
        { value: "{{counts.guests}}", label: "Speakers" },
      ],
    },
    fields: [
      {
        key: "items",
        label: "Stats",
        type: "items",
        addLabel: "Add stat",
        itemFields: [
          { key: "value", label: "Value", type: "text", bindable: true },
          { key: "label", label: "Label", type: "text" },
        ],
      },
    ],
    render: Stats,
  },
  {
    type: "tabs",
    label: "Tabs",
    icon: PanelsTopLeft,
    category: "proof",
    defaultProps: { items: [] },
    fields: [
      {
        key: "items",
        label: "Tabs",
        type: "items",
        addLabel: "Add tab",
        itemFields: [
          { key: "label", label: "Tab label", type: "text" },
          { key: "content", label: "Content", type: "richtext" },
        ],
      },
    ],
    render: Tabs,
  },
];
