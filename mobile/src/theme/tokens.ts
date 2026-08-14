// Single source of colour — a byte-for-byte port of the web app's dark theme
// (../app/globals.css, the `.dark` block) so both surfaces match exactly.
export const colors = {
  background: "#161616",
  foreground: "#e7e7e7",
  card: "#202020",
  muted: "#1a1a1a",
  mutedForeground: "#a3a3a3",
  accent: "#242424",
  primary: "#ffffff",
  primaryForeground: "#161616",
  destructive: "#7f1d1d",
  border: "#333333",
  borderStrong: "#474747",
  surfaceSubtle: "#1a1a1a",
  surfaceCard: "#202020",
  surfaceActive: "#242424",
  surfaceHover: "#2a2a2a",
  surfaceDialog: "#2e2e2e",
  surfaceStrong: "#333333",
  textSecondary: "#737373",
  textTertiary: "#525252",
  success: "#34d399", // emerald-400
  danger: "#f87171", // red-400
  info: "#38bdf8", // sky-400
  warning: "#fbbf24", // amber-400
  overlay: "rgba(0,0,0,0.6)",
  avatarGradientStart: "#3a3a3a",
  avatarGradientEnd: "#1e1e1e",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// The web `--radius` is 0.625rem = 10px, so `md` is the default card radius.
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
} as const;

type TypeToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight:
    | "400"
    | "500"
    | "600"
    | "700"
    | "normal"
    | "bold"
    | "100"
    | "200"
    | "300"
    | "800"
    | "900";
  letterSpacing?: number;
};

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "500", letterSpacing: 0.4 },
} satisfies Record<string, TypeToken>;

export const timing = {
  fast: 180,
  base: 240,
  slow: 320,
} as const;

export const spring = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
} as const;
