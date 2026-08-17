// Featured-guest display settings: how the Guests block arranges its people on
// the public event page. The guests themselves live in the event's metadata bag
// under `guests`; these options sit beside them under `guestsDisplay`, so both
// grow without a migration. Pure data + a resolver — the editor (guests.jsx)
// and the renderer (page_blocks.jsx) read the same defaults.

export const GUEST_LAYOUTS = [
  { key: "grid", label: "Grid" },
  { key: "list", label: "List" },
];

export const GUEST_COLUMN_OPTIONS = [
  { key: 2, label: "2" },
  { key: 3, label: "3" },
  { key: 4, label: "4" },
];

// How the photo is framed. Square is the default card look; circle is the
// avatar treatment the list has always used.
export const GUEST_IMAGE_SHAPES = [
  { key: "square", label: "Square" },
  { key: "portrait", label: "Portrait" },
  { key: "circle", label: "Circle" },
];

// Cover crops to fill the frame; contain letterboxes so nothing is cut off —
// the right pick for logos or headshots that shouldn't lose their edges.
export const GUEST_IMAGE_FITS = [
  { key: "cover", label: "Fill frame" },
  { key: "contain", label: "Fit inside" },
];

export const GUEST_CARD_STYLES = [
  { key: "plain", label: "Plain" },
  { key: "card", label: "Card" },
];

export const GUEST_ALIGNS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
];

export const DEFAULT_GUEST_DISPLAY = {
  layout: "grid",
  columns: 3,
  imageShape: "square",
  imageFit: "cover",
  cardStyle: "plain",
  align: "left",
  showBio: true,
};

function oneOf(list, value, fallback) {
  return list.some((o) => o.key === value) ? value : fallback;
}

// Every field defaulted individually: events created before these settings
// existed have no `guestsDisplay` at all, and a partially-written bag must not
// leave the renderer with undefined class names.
export function resolveGuestDisplay(value) {
  const v = value && typeof value === "object" ? value : {};
  const columns = Number(v.columns);
  return {
    layout: oneOf(GUEST_LAYOUTS, v.layout, DEFAULT_GUEST_DISPLAY.layout),
    columns: oneOf(GUEST_COLUMN_OPTIONS, columns, DEFAULT_GUEST_DISPLAY.columns),
    imageShape: oneOf(GUEST_IMAGE_SHAPES, v.imageShape, DEFAULT_GUEST_DISPLAY.imageShape),
    imageFit: oneOf(GUEST_IMAGE_FITS, v.imageFit, DEFAULT_GUEST_DISPLAY.imageFit),
    cardStyle: oneOf(GUEST_CARD_STYLES, v.cardStyle, DEFAULT_GUEST_DISPLAY.cardStyle),
    align: oneOf(GUEST_ALIGNS, v.align, DEFAULT_GUEST_DISPLAY.align),
    showBio: v.showBio !== false,
  };
}

// --- Class-name helpers, shared by the public block and the editor preview ---

export const GUEST_GRID_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

// Aspect ratio + corner rounding for the photo frame.
export const GUEST_SHAPE_CLASS = {
  square: "aspect-square rounded-lg",
  portrait: "aspect-[4/5] rounded-lg",
  circle: "aspect-square rounded-full",
};

export const GUEST_FIT_CLASS = {
  cover: "object-cover",
  contain: "object-contain",
};
