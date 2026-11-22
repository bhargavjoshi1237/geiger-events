import { c } from "./builders.js";

// Check-in feature settings for Control (slices of events.checkin_settings), ported from the screens in
// components/internal/screens/checkin/. The source is the shared constants file because it defines every slice
// key (the screens get `enabled` from the kit, not by name); nested toggles and gate lists stay on the dashboard.

const SOURCE = "components/internal/screens/checkin/constants.js";
const NESTED_HINT = "Switched individually on the dashboard.";

const REENTRY = [
  { value: "once", label: "Single entry" },
  { value: "multi", label: "Multiple re-entry" },
  { value: "none", label: "No re-entry tracking" },
];

const enabled = (label, hint) => c("enabled", label, "switch", { hint });

export const CHECKIN_SETTINGS = [
  {
    id: "checkin.qrTickets",
    store: "checkin",
    key: "qrTickets",
    section: "checkin",
    title: "QR Tickets",
    icon: "qr-code",
    description: "How the QR code on each ticket looks and what it encodes.",
    defaults: { size: "medium", errorCorrection: "M", encode: "ticketCode", dynamic: false, showLogo: true, brandColor: "" },
    panels: [
      {
        title: "Appearance",
        fields: [
          c("size", "Code size", "select", {
            hint: "Larger codes scan faster from a distance.",
            options: [
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ],
          }),
          c("errorCorrection", "Error correction", "select", {
            hint: "Higher levels stay scannable when a code is scuffed.",
            options: [
              { value: "L", label: "Low (7%)" },
              { value: "M", label: "Medium (15%)" },
              { value: "Q", label: "Quartile (25%)" },
              { value: "H", label: "High (30%)" },
            ],
          }),
          c("showLogo", "Show logo in center", "switch"),
          c("brandColor", "Brand color", "text", { placeholder: "#111111", hint: "Hex for the code modules. Leave blank for black." }),
        ],
      },
      {
        title: "Encoding",
        fields: [
          c("encode", "Encoded value", "select", {
            options: [
              { value: "ticketCode", label: "Ticket code" },
              { value: "orderId", label: "Order ID" },
              { value: "url", label: "Check-in URL" },
            ],
          }),
          c("dynamic", "Rotating (dynamic) codes", "switch", { hint: "Codes refresh so screenshots can't be reused." }),
        ],
      },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.checkinApp",
    store: "checkin",
    key: "checkinApp",
    section: "checkin",
    title: "Check-in App",
    icon: "scan-line",
    description: "The staff scanner your team uses to admit attendees at the door.",
    defaults: { enabled: true, methods: { qr: true, manual: true }, reentry: "once", offlineCache: false },
    panels: [
      { title: "Check-in app", fields: [enabled("Check-in app", "Allow staff to open the scanner for this project's events.")] },
      { title: "Allowed methods", fields: [c("methods", "QR scan and manual entry", "readonly", { hint: NESTED_HINT })] },
      {
        title: "Entry policy",
        fields: [
          c("reentry", "Re-entry", "select", { options: REENTRY }),
          c("offlineCache", "Offline caching", "switch", { hint: "Cache the guest list so scanning works without signal." }),
        ],
      },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.doorSales",
    store: "checkin",
    key: "doorSales",
    section: "checkin",
    title: "Door Sales",
    icon: "door-open",
    description: "Sell tickets at the entrance and check buyers in as walk-ins.",
    defaults: { enabled: false, methods: { cash: true, card: true, comp: true }, autoCheckin: true, requireEmail: false },
    panels: [
      { title: "Door sales", fields: [enabled("Door sales", "Let staff sell walk-in tickets at the door.")] },
      { title: "Payment methods", fields: [c("methods", "Cash, card and complimentary", "readonly", { hint: NESTED_HINT })] },
      {
        title: "Behavior",
        fields: [
          c("autoCheckin", "Auto check-in buyer", "switch", { hint: "Admit the buyer immediately as a walk-in." }),
          c("requireEmail", "Require email", "switch", { hint: "Collect an email so the buyer gets a receipt." }),
        ],
      },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.kiosk",
    store: "checkin",
    key: "kiosk",
    section: "checkin",
    title: "Kiosk Mode",
    icon: "monitor",
    description: "A full-screen self-service screen for a kiosk or tablet at the entrance.",
    defaults: { enabled: false, mode: "kiosk", actions: { checkin: true, register: true, buy: false }, idleMessage: "" },
    panels: [
      { title: "Kiosk mode", fields: [enabled("Kiosk mode", "Allow a kiosk or tablet self-service screen.")] },
      {
        title: "Device",
        fields: [
          c("mode", "Mode", "select", {
            hint: "Kiosk pairs with a scanner; tablet is touch self-service.",
            options: [
              { value: "kiosk", label: "Kiosk (scanner)" },
              { value: "tablet", label: "Tablet (self-service)" },
            ],
          }),
          c("idleMessage", "Idle message", "text", { placeholder: "Welcome — tap to check in" }),
        ],
      },
      { title: "Allowed actions", fields: [c("actions", "Check-in, registration and buying", "readonly", { hint: NESTED_HINT })] },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.session",
    store: "checkin",
    key: "session",
    section: "checkin",
    title: "Session Check-in",
    icon: "calendar-clock",
    description: "Track attendance per session, workshop or track, not just at the front door.",
    defaults: { enabled: false },
    panels: [{ title: "Session check-in", fields: [enabled("Session check-in", "Record separate check-ins for each session.")] }],
    source: SOURCE,
  },
  {
    id: "checkin.rfid",
    store: "checkin",
    key: "rfid",
    section: "checkin",
    title: "RFID / NFC",
    icon: "radio",
    description: "Wristbands, cards or NFC badges instead of QR codes.",
    defaults: { enabled: false, medium: "wristband", range: "short", checksum: true, billingCurrency: "usd" },
    panels: [
      { title: "RFID / NFC", fields: [enabled("RFID / NFC", "Use RFID or NFC credentials for check-in.")] },
      {
        title: "Medium",
        fields: [
          c("medium", "Credential type", "select", {
            options: [
              { value: "wristband", label: "Wristbands" },
              { value: "card", label: "Cards" },
              { value: "badge", label: "NFC badges" },
            ],
          }),
          c("range", "Read range", "select", {
            hint: "Short-range is a deliberate tap; long-range reads at a distance.",
            options: [
              { value: "short", label: "Short-range (NFC/HF tap)" },
              { value: "long", label: "Long-range (UHF)" },
            ],
          }),
          c("checksum", "Checksum verification", "switch", { hint: "Validate encoded files against a computed sum." }),
        ],
      },
      {
        title: "Paid entry defaults",
        fields: [
          c("billingCurrency", "Default currency", "select", {
            hint: "Preselected for new entry points; existing points keep theirs.",
            options: [
              { value: "usd", label: "USD ($)" },
              { value: "eur", label: "EUR (€)" },
              { value: "gbp", label: "GBP (£)" },
              { value: "inr", label: "INR (₹)" },
              { value: "aed", label: "AED (د.إ)" },
              { value: "cad", label: "CAD ($)" },
              { value: "aud", label: "AUD ($)" },
              { value: "sgd", label: "SGD ($)" },
            ],
          }),
        ],
      },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.selfCheckin",
    store: "checkin",
    key: "selfCheckin",
    section: "checkin",
    title: "Self Check-in",
    icon: "smartphone",
    description: "Attendees check themselves in by scanning their own QR code.",
    defaults: { enabled: false, requireQr: true, confirmScreen: true },
    panels: [
      { title: "Self check-in", fields: [enabled("Self check-in", "Allow attendees to admit themselves without a staff scan.")] },
      {
        title: "Options",
        fields: [
          c("requireQr", "Require QR code", "switch", { hint: "Only when the attendee scans their own ticket QR." }),
          c("confirmScreen", "Confirmation screen", "switch", { hint: "Show a “You're in” screen with next steps." }),
        ],
      },
    ],
    source: SOURCE,
  },
  {
    id: "checkin.multiGate",
    store: "checkin",
    key: "multiGate",
    section: "checkin",
    title: "Multi-gate & Zones",
    icon: "map-pin",
    description: "Multiple entrances and restricted areas with a single ticket.",
    defaults: { enabled: false, gates: [], zones: [] },
    panels: [
      { title: "Multi-gate & zones", fields: [enabled("Multi-gate & zones", "Track entry gate and which zones a ticket opens.")] },
      {
        title: "Gates and zones",
        fields: [
          c("gates", "Gates", "readonly", { hint: "Add and rename gates on the dashboard." }),
          c("zones", "Zones", "readonly", { hint: "Add and rename zones on the dashboard." }),
        ],
      },
    ],
    source: SOURCE,
  },
];
