// The page-design catalog: block types, their editable field schemas, the
// option lists those fields offer, and the factories that build a default page.
//
// This is data, not UI. It lives apart from page_design.jsx so both the legacy
// section editor and the page builder can read it without importing each other
// — page_design.jsx renders the builder, and the builder needs this catalog.
// page_design.jsx re-exports everything here, so existing imports still resolve.

import {
  Image as ImageIcon,
  FileText,
  Sparkles,
  Clock,
  MapPin,
  Users,
  HelpCircle,
  Heading,
  Type,
  Video,
  Code,
  MousePointerClick,
  Minus,
  AlignLeft,
  Columns2,
  ListCollapse,
  MoveVertical,
  Ticket,
  Info,
  ClipboardList,
  Accessibility,
} from "lucide-react";

export const PAGE_MODES = [
  { key: "standard", label: "Standard", desc: "Geiger's optimized, ready-to-go layout. No setup needed." },
  { key: "themed", label: "Themed", desc: "Your brand — colors, fonts, cover, header, footer, and sections." },
  { key: "imported", label: "Import", desc: "Match a website — we pull its logo, colors, and fonts for you." },
  { key: "custom", label: "Custom", desc: "Everything in Themed, plus the full drag-and-drop page builder." },
];

export const ACCENTS = [
  { key: "white", label: "Classic", color: "var(--foreground)", text: "#161616" },
  { key: "violet", label: "Violet", color: "#8b5cf6", text: "#ffffff" },
  { key: "emerald", label: "Emerald", color: "#10b981", text: "#06281d" },
  { key: "sky", label: "Sky", color: "#0ea5e9", text: "#06212e" },
  { key: "amber", label: "Amber", color: "#f59e0b", text: "#161616" },
  { key: "rose", label: "Rose", color: "#f43f5e", text: "#ffffff" },
];

export const COVER_STYLES = [
  { key: "gradient", label: "Gradient" },
  { key: "solid", label: "Solid" },
  { key: "accent", label: "Accent tint" },
];

export const FONTS = [
  { key: "sans", label: "Sans", className: "font-sans" },
  { key: "serif", label: "Serif", className: "font-serif" },
  { key: "mono", label: "Mono", className: "font-mono" },
];

// --- Block field option catalogs ---------------------------------------------

export const COLUMN_RATIO_OPTIONS = [
  { key: "1:1", label: "Even" },
  { key: "1:2", label: "Narrow / wide" },
  { key: "2:1", label: "Wide / narrow" },
];

export const COLUMN_ALIGN_OPTIONS = [
  { key: "start", label: "Top" },
  { key: "center", label: "Middle" },
];

export const COLUMN_KIND_OPTIONS = [
  { key: "text", label: "Text" },
  { key: "image", label: "Image" },
];

export const BUTTON_ITEM_STYLES = [
  { key: "solid", label: "Solid" },
  { key: "outline", label: "Outline" },
];

export const SPACER_SIZE_OPTIONS = [
  { key: "sm", label: "Small" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Large" },
];

// Gallery display settings moved to lib/events/gallery.js — they're edited
// beside the images in Content & media, not here, and they live in the event's
// own metadata bag rather than in the page design.

// --- Per-block layout --------------------------------------------------------
// Applied by BlockShell in page_blocks.jsx. Every default is the "no wrapper"
// value, so a block without layout renders exactly as it always has.

export const BLOCK_WIDTH_OPTIONS = [
  { key: "full", label: "Full" },
  { key: "wide", label: "Wide" },
  { key: "narrow", label: "Narrow" },
];

export const BLOCK_ALIGN_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
  { key: "right", label: "Right" },
];

export const BLOCK_BACKGROUND_OPTIONS = [
  { key: "none", label: "None" },
  { key: "surface", label: "Card" },
  { key: "brand", label: "Brand tint" },
];

export const DEFAULT_BLOCK_LAYOUT = {
  width: "full",
  align: "left",
  background: "none",
};

// Every block type the page understands. `singleton` blocks (the smart event
// sections) can appear only once; content blocks can be added repeatedly and
// carry editable `fields`.
export const BLOCK_LIBRARY = [
  { type: "about", label: "About", icon: FileText, category: "event", singleton: true },
  { type: "expect", label: "What to expect", icon: Sparkles, category: "event", singleton: true },
  { type: "schedule", label: "Schedule", icon: Clock, category: "event", singleton: true },
  { type: "location", label: "Location & directions", icon: MapPin, category: "event", singleton: true },
  { type: "whosgoing", label: "Who's going", icon: Users, category: "event", singleton: true },
  { type: "guests", label: "Guests", icon: Users, category: "event", singleton: true },
  { type: "faq", label: "FAQ", icon: HelpCircle, category: "event", singleton: true },
  {
    type: "heading",
    label: "Heading",
    icon: Heading,
    category: "content",
    defaultProps: { text: "Section heading" },
    fields: [{ key: "text", label: "Heading text", type: "text", bindable: true }],
  },
  {
    type: "text",
    label: "Text",
    icon: Type,
    category: "content",
    defaultProps: { text: "Add your text here. Tell attendees what makes this event special." },
    fields: [{ key: "text", label: "Text", type: "textarea", bindable: true }],
  },
  {
    type: "richtext",
    label: "Rich text",
    icon: AlignLeft,
    category: "content",
    defaultProps: {
      text: "## What to expect\n\n- **Morning sessions:** timely, practical topics.\n- **Afternoons at your pace:** relax, explore, or connect.",
    },
    fields: [{ key: "text", label: "Content", type: "richtext", bindable: true }],
  },
  {
    type: "columns",
    label: "Two columns",
    icon: Columns2,
    category: "content",
    defaultProps: {
      ratio: "1:1",
      align: "start",
      leftKind: "image",
      leftUrl: "",
      leftCaption: "",
      leftText: "",
      rightKind: "text",
      rightText: "**What to expect:**\n\n- First highlight\n- Second highlight",
      rightUrl: "",
      rightCaption: "",
    },
    fields: [
      { key: "ratio", label: "Column widths", type: "select", options: COLUMN_RATIO_OPTIONS },
      { key: "align", label: "Vertical alignment", type: "select", options: COLUMN_ALIGN_OPTIONS },
      { key: "leftKind", label: "Left column", type: "select", options: COLUMN_KIND_OPTIONS, group: "Left column" },
      { key: "leftText", label: "Left content", type: "richtext", bindable: true, showWhen: { leftKind: "text" } },
      { key: "leftUrl", label: "Left image URL", type: "text", bindable: true, showWhen: { leftKind: "image" } },
      { key: "leftCaption", label: "Left caption", type: "text", bindable: true, showWhen: { leftKind: "image" } },
      { key: "rightKind", label: "Right column", type: "select", options: COLUMN_KIND_OPTIONS, group: "Right column" },
      { key: "rightText", label: "Right content", type: "richtext", bindable: true, showWhen: { rightKind: "text" } },
      { key: "rightUrl", label: "Right image URL", type: "text", bindable: true, showWhen: { rightKind: "image" } },
      { key: "rightCaption", label: "Right caption", type: "text", bindable: true, showWhen: { rightKind: "image" } },
    ],
  },
  {
    type: "accordion",
    label: "Accordion",
    icon: ListCollapse,
    category: "content",
    // Starts with no rows — a seeded example would publish verbatim.
    defaultProps: { title: "Pricing & policies", items: [] },
    fields: [
      { key: "title", label: "Section title", type: "text", bindable: true, hint: "Leave empty for no heading." },
      {
        key: "items",
        label: "Rows",
        type: "items",
        addLabel: "Add row",
        itemFields: [
          { key: "q", label: "Label", type: "text", bindable: true },
          { key: "a", label: "Content", type: "richtext", bindable: true },
        ],
      },
    ],
  },
  {
    type: "buttons",
    label: "Button group",
    icon: MousePointerClick,
    category: "content",
    defaultProps: {
      items: [{ label: "Register now", url: "#", style: "solid" }],
    },
    fields: [
      {
        key: "items",
        label: "Buttons",
        type: "items",
        addLabel: "Add button",
        itemFields: [
          { key: "label", label: "Label", type: "text", bindable: true },
          { key: "url", label: "Link", type: "text", bindable: true },
          { key: "style", label: "Style", type: "select", options: BUTTON_ITEM_STYLES },
        ],
      },
    ],
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: MoveVertical,
    category: "content",
    defaultProps: { size: "md" },
    fields: [{ key: "size", label: "Height", type: "select", options: SPACER_SIZE_OPTIONS }],
  },
  {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    category: "content",
    defaultProps: { url: "", caption: "" },
    fields: [
      { key: "url", label: "Image URL", type: "text", bindable: true },
      { key: "caption", label: "Caption", type: "text", bindable: true },
    ],
  },
  {
    type: "video",
    label: "Video",
    icon: Video,
    category: "content",
    defaultProps: { url: "" },
    fields: [{ key: "url", label: "Video URL (YouTube, Vimeo…)", type: "text", bindable: true }],
  },
  {
    type: "embed",
    label: "Embed",
    icon: Code,
    category: "content",
    defaultProps: { code: "" },
    fields: [{ key: "code", label: "Embed HTML", type: "textarea" }],
  },
  {
    type: "cta",
    label: "Call to action",
    icon: MousePointerClick,
    category: "content",
    defaultProps: { title: "Ready to join us?", label: "Get Tickets", url: "#" },
    fields: [
      { key: "title", label: "Heading", type: "text", bindable: true },
      { key: "label", label: "Button label", type: "text", bindable: true },
      { key: "url", label: "Button link", type: "text", bindable: true },
    ],
  },
  { type: "divider", label: "Divider", icon: Minus, category: "content", defaultProps: {} },
];

export const DEFAULT_BLOCK_TYPES = [
  "about",
  "expect",
  "schedule",
  "location",
  "whosgoing",
  "guests",
  "faq",
];

// Sidebar-only singletons. These are rendered by event_public_page.jsx (they
// depend on checkout state), so they carry no renderer here — just identity for
// the show/hide/reorder list. Content blocks from BLOCK_LIBRARY can be added
// alongside them.
export const SIDEBAR_BLOCK_LIBRARY = [
  { type: "register", label: "Date & registration", icon: Ticket, category: "event", singleton: true, locked: true },
  { type: "goodtoknow", label: "Good To Know", icon: Info, category: "event", singleton: true },
  { type: "atregistration", label: "At registration", icon: ClipboardList, category: "event", singleton: true },
  { type: "guidelines", label: "Dietary & accessibility", icon: Accessibility, category: "event", singleton: true },
];

export const DEFAULT_SIDEBAR_TYPES = [
  "register",
  "goodtoknow",
  "atregistration",
  "guidelines",
];

// Content blocks that make sense in a 380px column — the rest are main-column only.
export const SIDEBAR_CONTENT_TYPES = [
  "heading",
  "text",
  "richtext",
  "image",
  "cta",
  "buttons",
  "divider",
  "spacer",
];

export function getBlockMeta(type) {
  return (
    BLOCK_LIBRARY.find((b) => b.type === type) ||
    SIDEBAR_BLOCK_LIBRARY.find((b) => b.type === type) ||
    null
  );
}

/** The blocks addable to one surface: the main column, or the sidebar. */
export function addableBlocks(surface, existingTypes) {
  const library =
    surface === "sidebar"
      ? [
          ...SIDEBAR_BLOCK_LIBRARY,
          ...BLOCK_LIBRARY.filter((b) => SIDEBAR_CONTENT_TYPES.includes(b.type)),
        ]
      : BLOCK_LIBRARY;
  return library.filter(
    (b) => b.category === "content" || !existingTypes.includes(b.type),
  );
}

let blockCounter = 0;
export function createBlock(type) {
  const meta = getBlockMeta(type);
  blockCounter += 1;
  const id = meta?.singleton ? type : `${type}-${blockCounter}`;
  return {
    id,
    type,
    visible: true,
    props: meta?.defaultProps ? { ...meta.defaultProps } : {},
    ...(meta?.category === "content" ? { layout: { ...DEFAULT_BLOCK_LAYOUT } } : {}),
  };
}

/** The sidebar's out-of-the-box block list — also the fallback for pages saved
 *  before the sidebar became block-driven. */
export function defaultSidebarBlocks() {
  return DEFAULT_SIDEBAR_TYPES.map(createBlock);
}

export function defaultPageDesign() {
  return {
    mode: "standard",
    accent: "white",
    cover: "gradient",
    font: "sans",
    showGallery: true,
    blocks: DEFAULT_BLOCK_TYPES.map(createBlock),
    sidebarBlocks: defaultSidebarBlocks(),
  };
}

export function resolveAccent(key) {
  return ACCENTS.find((a) => a.key === key) || ACCENTS[0];
}

export function resolveFont(key) {
  return FONTS.find((f) => f.key === key) || FONTS[0];
}
