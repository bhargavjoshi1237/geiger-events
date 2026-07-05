// Lookups, feature-config defaults, and formatters for the Check-in area.
// Config only — never row data. The data layer (lib/supabase/checkin.js) returns
// raw config bags; screens merge these defaults so every field is present.

// --- Formatters --------------------------------------------------------------

export const formatDate = (iso) => {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

// --- Check-in method lookup --------------------------------------------------

export const METHOD_MAP = {
  qr: { label: "QR scan", dotClass: "bg-emerald-400" },
  manual: { label: "Manual", dotClass: "bg-sky-400" },
  self: { label: "Self check-in", dotClass: "bg-violet-400" },
  kiosk: { label: "Kiosk", dotClass: "bg-amber-400" },
  rfid: { label: "RFID / NFC", dotClass: "bg-pink-400" },
  door: { label: "Door sale", dotClass: "bg-orange-400" },
};

// --- Per-feature config defaults ---------------------------------------------
// Each feature slice of events.checkin_settings.config. Returned by functions so
// nested objects aren't shared across reads.

export const defaultQrTickets = () => ({
  // No `enabled` — QR is turned on per event ("include QR on ticket"); this is
  // the shared appearance/encoding config those tickets use.
  size: "medium", // small | medium | large
  errorCorrection: "M", // L | M | Q | H
  encode: "ticketCode", // ticketCode | orderId | url
  dynamic: false, // rotating vs static code
  showLogo: true,
  brandColor: "",
});

export const defaultWalletPasses = () => ({
  enabled: false,
  apple: true,
  google: true,
  orgName: "",
  logoUrl: "",
  bgColor: "",
  fields: { name: true, ticketType: true, seat: false, qr: true },
});

export const defaultCheckinApp = () => ({
  enabled: true,
  methods: { qr: true, manual: true },
  reentry: "once", // once | multi | none
  offlineCache: false,
});

export const defaultDoorSales = () => ({
  enabled: false,
  methods: { cash: true, card: true, comp: true },
  autoCheckin: true,
  requireEmail: false,
});

export const defaultKiosk = () => ({
  enabled: false,
  mode: "kiosk", // kiosk | tablet
  actions: { checkin: true, register: true, buy: false },
  idleMessage: "",
});

export const defaultSession = () => ({ enabled: false });

export const defaultRfid = () => ({
  enabled: false,
  medium: "wristband", // wristband | card | badge
  checksum: true,
});

export const defaultSelfCheckin = () => ({
  enabled: false,
  requireQr: true,
  confirmScreen: true,
});

export const defaultMultiGate = () => ({
  enabled: false,
  gates: [], // [{ id, name }]
  zones: [], // [{ id, name }]
});

export const defaultBadge = () => ({ defaultTemplate: "classic" });

// Merge a stored slice over its defaults. `feature` is a config key.
export const withDefaults = (config, feature) => ({
  ...(FEATURE_DEFAULTS[feature]?.() || {}),
  ...(config?.[feature] || {}),
});

export const FEATURE_DEFAULTS = {
  qrTickets: defaultQrTickets,
  walletPasses: defaultWalletPasses,
  checkinApp: defaultCheckinApp,
  doorSales: defaultDoorSales,
  kiosk: defaultKiosk,
  session: defaultSession,
  rfid: defaultRfid,
  selfCheckin: defaultSelfCheckin,
  multiGate: defaultMultiGate,
  badge: defaultBadge,
};

// --- Select option lists -----------------------------------------------------

export const QR_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const QR_EC_OPTIONS = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
];

export const QR_ENCODE_OPTIONS = [
  { value: "ticketCode", label: "Ticket code" },
  { value: "orderId", label: "Order ID" },
  { value: "url", label: "Check-in URL" },
];

export const REENTRY_OPTIONS = [
  { value: "once", label: "Single entry" },
  { value: "multi", label: "Multiple re-entry" },
  { value: "none", label: "No re-entry tracking" },
];

export const RFID_MEDIUM_OPTIONS = [
  { value: "wristband", label: "Wristbands" },
  { value: "card", label: "Cards" },
  { value: "badge", label: "NFC badges" },
];

export const KIOSK_MODE_OPTIONS = [
  { value: "kiosk", label: "Kiosk (scanner)" },
  { value: "tablet", label: "Tablet (self-service)" },
];

// --- Badge templates ---------------------------------------------------------

export const BADGE_TEMPLATES = [
  { value: "classic", label: "Classic", desc: "Name, role, and event — centered." },
  { value: "compact", label: "Compact", desc: "Tight layout for small badges." },
  { value: "qr", label: "QR-forward", desc: "Large QR for fast scanning." },
  { value: "vip", label: "VIP", desc: "Bold accent band with tier." },
];

export const BADGE_EXPORT_FORMATS = [
  { value: "pdf", label: "PDF (print sheet)" },
  { value: "png", label: "PNG (per badge)" },
  { value: "zip", label: "ZIP (all PNGs)" },
];

// --- Per-event check-in config default (events.metadata.checkin) --------------

export const defaultEventCheckin = () => ({
  qrOnTicket: true,
  walletPass: false,
  doorSales: false,
  kiosk: false,
  session: false,
  selfCheckin: false,
  multiGate: false,
  rfid: false,
  gates: [],
  zones: [],
  sessions: [], // [{ id, name, startsAt }]
});
