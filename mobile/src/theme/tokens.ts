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
  borderMuted: "#3a3a3a",
  borderStrong: "#474747",
  surfaceSubtle: "#1a1a1a",
  surfaceCard: "#202020",
  surfaceActive: "#242424",
  surfaceHover: "#2a2a2a",
  surfaceDialog: "#2e2e2e",
  surfaceStrong: "#333333",
  textSecondary: "#737373",
  textTertiary: "#525252",
  success: "#34d399",
  danger: "#f87171",
  info: "#38bdf8",
  warning: "#fbbf24",
  overlay: "rgba(0,0,0,0.6)",
  scrim: "rgba(0,0,0,0.55)",
  chipScrim: "rgba(22,22,22,0.72)",
  glassScrim: "rgba(22,22,22,0.92)",
  avatarGradientStart: "#3a3a3a",
  avatarGradientEnd: "#1e1e1e",
  // The pass surface is deliberately light so a scanner reads it at any brightness.
  paper: "#ffffff",
  paperForeground: "#161616",
  paperMuted: "#525252",
  paperSecondary: "#737373",
  paperSubtle: "#f3f4f6",
  paperBorder: "#e5e7eb",
  paperDash: "#d4d4d4",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_500Medium",
  monoSemibold: "GeistMono_600SemiBold",
} as const;

type TypeToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

// Never set fontWeight: each Geist file IS one weight, so a weight on top of it
// makes RN/the browser synthesise a fake bold that measures narrower than it draws
// and clips the last glyph. Pick the face via fonts.* instead.
export const type = {
  hero: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 38, letterSpacing: -0.7 },
  display: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 31, letterSpacing: -0.56 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 27, letterSpacing: -0.24 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  subhead: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  labelStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  mono: { fontFamily: fonts.monoSemibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  monoSmall: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
  monoLarge: { fontFamily: fonts.monoSemibold, fontSize: 18, lineHeight: 22, letterSpacing: 0.6 },
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
