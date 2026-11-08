// The one Geiger Events app's per-project configuration: which sections show, the home screen, and white-label build settings.

export const SECTION_KEYS = [
  "memberships",
  "live",
  "watch",
  "orders",
  "community",
  "qa",
  "messages",
  "notifications",
  "agenda",
  "speakers",
  "sponsors",
  "map",
  "networking",
  "discussions",
];

// Saved now so organisers can decide early; the app renders them as each one ships (design §5, Phase 5).
export const UPCOMING_SECTIONS = ["agenda", "speakers", "sponsors", "map", "networking", "discussions"];

export const SHORTCUT_KEYS = ["community", "watch", "memberships", "live", "orders", "qa"];

export const MAX_SHORTCUTS = 4;

const WELCOME_MAX = 280;

const THEME_MODES = ["dark", "light", "system"];
const ANDROID_FORMATS = ["apk", "aab"];
const IOS_METHODS = ["testflight", "store"];

const WHITE_LABEL_TEXT = {
  appName: 80,
  orgName: 120,
  tagline: 160,
  slug: 60,
  scheme: 40,
  version: 20,
  iosBundleId: 120,
  androidPackage: 120,
  easProjectId: 60,
  accent: 9,
  background: 9,
  card: 9,
  primary: 9,
  splashBackground: 9,
  splashMessage: 160,
  iosUrl: 500,
  androidUrl: 500,
  releaseNotes: 1000,
};

const DEFAULT_SHORTCUTS = ["community", "watch", "memberships"];

export const DEFAULT_APP_CONFIG = {
  version: 1,
  sections: Object.fromEntries(SECTION_KEYS.map((key) => [key, true])),
  home: { welcome: "", liveStrip: true, recentOrders: true, shortcuts: DEFAULT_SHORTCUTS },
  whiteLabel: {
    appName: "",
    orgName: "",
    tagline: "",
    slug: "",
    scheme: "",
    version: "1.0.0",
    iosBundleId: "",
    androidPackage: "",
    easProjectId: "",
    themeMode: "dark",
    accent: "#6366f1",
    background: "#161616",
    card: "#202020",
    primary: "#ffffff",
    splashBackground: "#161616",
    splashMessage: "",
    iosUrl: "",
    androidUrl: "",
    androidFormat: "apk",
    iosMethod: "testflight",
    releaseNotes: "",
  },
};

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value, max, fallback) => (typeof value === "string" ? value.trim().slice(0, max) : fallback);

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function normalizeShortcuts(value, sections) {
  const list = Array.isArray(value) ? value : DEFAULT_SHORTCUTS;
  const out = [];
  for (const key of list) {
    if (out.length === MAX_SHORTCUTS) break;
    if (SHORTCUT_KEYS.includes(key) && sections[key] && !out.includes(key)) out.push(key);
  }
  return out;
}

export function normalizeAppConfig(raw) {
  const source = isObject(raw) ? raw : {};
  const rawSections = isObject(source.sections) ? source.sections : {};
  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => [key, typeof rawSections[key] === "boolean" ? rawSections[key] : true]),
  );

  const rawHome = isObject(source.home) ? source.home : {};
  const home = {
    welcome: text(rawHome.welcome, WELCOME_MAX, ""),
    liveStrip: rawHome.liveStrip !== false,
    recentOrders: rawHome.recentOrders !== false,
    shortcuts: normalizeShortcuts(rawHome.shortcuts, sections),
  };

  const rawWhiteLabel = isObject(source.whiteLabel) ? source.whiteLabel : {};
  const defaults = DEFAULT_APP_CONFIG.whiteLabel;
  const whiteLabel = { ...defaults };
  for (const [key, max] of Object.entries(WHITE_LABEL_TEXT)) {
    whiteLabel[key] = text(rawWhiteLabel[key], max, defaults[key]);
  }
  whiteLabel.themeMode = oneOf(rawWhiteLabel.themeMode, THEME_MODES, defaults.themeMode);
  whiteLabel.androidFormat = oneOf(rawWhiteLabel.androidFormat, ANDROID_FORMATS, defaults.androidFormat);
  whiteLabel.iosMethod = oneOf(rawWhiteLabel.iosMethod, IOS_METHODS, defaults.iosMethod);

  return { version: 1, sections, home, whiteLabel };
}

// What the shared app shows a member: a section is on when any connected project leaves it on; projects with no saved config count as defaults.
export function mergeForMember(configs) {
  const list = (configs.length ? configs : [null]).map(normalizeAppConfig);
  const sections = Object.fromEntries(SECTION_KEYS.map((key) => [key, list.some((c) => c.sections[key])]));
  const only = list.length === 1 ? list[0] : null;
  return {
    sections,
    home: {
      welcome: only ? only.home.welcome : "",
      liveStrip: list.some((c) => c.home.liveStrip),
      recentOrders: list.some((c) => c.home.recentOrders),
      shortcuts: normalizeShortcuts(only ? only.home.shortcuts : DEFAULT_SHORTCUTS, sections),
    },
  };
}
