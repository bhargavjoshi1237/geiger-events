// Shared Discussion Boards domain rules — used by the dashboard, the portal UI and the portal API routes.

export const BOARD_FORMATS = [
  { value: "discussion", label: "Discussion", hint: "Open conversation; members like replies." },
  { value: "qa", label: "Q&A", hint: "Questions and answers; members upvote and the asker accepts an answer." },
];

export const POSTING_POLICIES = [
  { value: "members", label: "Members can start topics" },
  { value: "moderators_only", label: "Organisers only (announcements)" },
];

export const EMAIL_SETTINGS = [
  { value: "inherit", label: "Use the default" },
  { value: "on", label: "Email replies" },
  { value: "off", label: "In-app only" },
];

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
];

export const EDIT_WINDOW_OPTIONS = [
  { value: 0, label: "No editing" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "24 hours" },
  { value: -1, label: "Any time" },
];

export const BANNED_WORD_ACTIONS = [
  { value: "hold", label: "Hold for review" },
  { value: "block", label: "Block the post" },
];

export const DEFAULT_SETTINGS = {
  emailDefault: "on",
  autoSubscribe: true,
  editWindowMinutes: 30,
  bannedWords: [],
  bannedWordAction: "hold",
};

export const LIMITS = { title: 160, body: 10000, tags: 5, tag: 24, reportDetails: 500 };

// Reaction kind a board's members use: upvotes rank Q&A answers, likes everywhere else.
export function reactionKindFor(format) {
  return format === "qa" ? "upvote" : "like";
}

export function normalizeSettings(config) {
  const c = config && typeof config === "object" ? config : {};
  const editWindow = Number(c.editWindowMinutes);
  return {
    emailDefault: c.emailDefault === "off" ? "off" : "on",
    autoSubscribe: c.autoSubscribe !== false,
    editWindowMinutes: Number.isFinite(editWindow) ? editWindow : DEFAULT_SETTINGS.editWindowMinutes,
    bannedWords: Array.isArray(c.bannedWords)
      ? [...new Set(c.bannedWords.map((w) => String(w || "").trim().toLowerCase()).filter(Boolean))]
      : [],
    bannedWordAction: c.bannedWordAction === "block" ? "block" : "hold",
  };
}

// -1 = always editable, 0 = never, otherwise minutes since creation.
export function withinEditWindow(createdAt, minutes, now = Date.now()) {
  const m = Number(minutes);
  if (m < 0) return true;
  if (!m || !createdAt) return false;
  const at = new Date(createdAt).getTime();
  if (Number.isNaN(at)) return false;
  return now - at <= m * 60000;
}

export function editWindowLabel(minutes) {
  const hit = EDIT_WINDOW_OPTIONS.find((o) => o.value === Number(minutes));
  return hit ? hit.label : `${minutes} minutes`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Banned words match whole words (or whole phrases), case-insensitively.
export function findBannedWords(text, words) {
  const list = Array.isArray(words) ? words : [];
  const hay = String(text || "");
  if (!hay || !list.length) return [];
  return list.filter((w) => {
    const word = String(w || "").trim();
    if (!word) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(word)}($|[^\\p{L}\\p{N}])`, "iu").test(hay);
  });
}

export function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const out = [];
  for (const t of raw) {
    const tag = String(t || "")
      .trim()
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, LIMITS.tag);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// A slug not already used by another board in the list.
export function uniqueSlug(name, boards = [], selfId = null) {
  const base = slugify(name) || "board";
  const taken = new Set(
    boards.filter((b) => b.id !== selfId).map((b) => String(b.slug || "").toLowerCase()),
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function excerpt(text, max = 160) {
  const flat = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function relTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
