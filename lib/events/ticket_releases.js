// Batched ticket releases (waves) — one ticket, several tranches.
//
// A ticket WITHOUT releases keeps its legacy behaviour (ticket.qty is the cap,
// always on sale). A ticket WITH releases partitions its inventory:
//
//   ticket.releases = [
//     {
//       id: "uuid",
//       name: "Early release",        // organiser label
//       qty: 100,                    // tranche size (0 = unlimited)
//       startMode: "now"             // now | date | after_stockout | manual
//         | "date" | "after_stockout" | "manual",
//       startAt: "2026-10-01T10:00", // startMode === "date"
//       afterReleaseId: "<id>",      // startMode === "after_stockout"
//       delayDays: 10,               // ... sold out + N days (0 = immediately)
//       endAt: "",                   // optional hard close for this tranche
//       released: true,              // startMode === "manual": organiser flip
//       paused: false,               // organiser hold — locks any mode
//     },
//   ]
//
// Sales fill tranches FIFO (release 0 first), so a single per-ticket sold
// counter is enough — no per-release counter to clobber. The moment each
// tranche sells out is stamped in metadata.releaseSoldOutAt = { releaseId: ISO }
// by buy_ticket; the JS delay check reads that map, the SQL mirror writes it.
//
// Pure: no imports, no I/O — safe in the editor, the storefront, the checkout
// API route, and (mirrored) in Postgres.

export const RELEASE_START_MODES = [
  { value: "now", label: "On sale now" },
  { value: "date", label: "On a date" },
  { value: "after_stockout", label: "After a sell-out" },
  { value: "manual", label: "Manual release" },
];

export function newReleaseId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeRelease(raw, idx = 0) {
  const r = raw && typeof raw === "object" ? raw : {};
  const startMode = ["now", "date", "after_stockout", "manual"].includes(r.startMode)
    ? r.startMode
    : "now";
  return {
    id: String(r.id || newReleaseId()),
    name: String(r.name || `Wave ${idx + 1}`),
    qty: Math.max(0, Math.round(Number(r.qty) || 0)),
    startMode,
    startAt: typeof r.startAt === "string" ? r.startAt : "",
    afterReleaseId: r.afterReleaseId != null ? String(r.afterReleaseId) : "",
    delayDays: Math.max(0, Number(r.delayDays) || 0),
    endAt: typeof r.endAt === "string" ? r.endAt : "",
    released: r.released !== false,
    paused: r.paused === true,
  };
}

export function getTicketReleases(ticket) {
  const list = Array.isArray(ticket?.releases) ? ticket.releases : [];
  return list.map((r, i) => normalizeRelease(r, i));
}

export function hasReleases(ticket) {
  return getTicketReleases(ticket).length > 0;
}

export function defaultRelease(idx = 0, qty = 50) {
  return normalizeRelease(
    {
      id: newReleaseId(),
      name: `Wave ${idx + 1}`,
      qty: Math.max(0, Math.round(Number(qty) || 0)),
      startMode: idx === 0 ? "now" : "after_stockout",
      delayDays: 0,
      released: true,
      paused: false,
    },
    idx,
  );
}

function toTime(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function soldOutAtOf(releaseId, soldOutAtMap) {
  if (!soldOutAtMap || typeof soldOutAtMap !== "object") return null;
  return toTime(soldOutAtMap[releaseId] ?? soldOutAtMap[String(releaseId)]);
}

// FIFO allocation: sales fill release 0, then 1, … — returns per-release sold.
export function allocateReleaseSales(releases, sold) {
  let left = Math.max(0, Math.round(Number(sold) || 0));
  return releases.map((r) => {
    const cap = Number(r.qty) || 0;
    if (cap <= 0) return { release: r, sold: 0, soldOut: false, unlimited: true };
    const take = Math.min(cap, left);
    left -= take;
    return { release: r, sold: take, soldOut: take >= cap, unlimited: false };
  });
}

// Is one release on sale right now? `alloc` is allocateReleaseSales() output so
// after_stockout can see whether its trigger tranche is sold out.
export function releaseUnlockState(release, idx, { releases, alloc, soldOutAtMap, now }) {
  const t = now instanceof Date ? now.getTime() : toTime(now) ?? Date.now();

  if (release.paused) return { unlocked: false, status: "paused", unlocksAt: null };

  const endT = toTime(release.endAt);
  if (endT != null && t > endT) return { unlocked: false, status: "ended", unlocksAt: null };

  if (release.startMode === "manual") {
    if (release.released) return { unlocked: true, status: "live", unlocksAt: null };
    return { unlocked: false, status: "manual_hold", unlocksAt: null };
  }

  if (release.startMode === "date") {
    const startT = toTime(release.startAt);
    if (startT == null) return { unlocked: true, status: "live", unlocksAt: null };
    if (t >= startT) return { unlocked: true, status: "live", unlocksAt: null };
    return { unlocked: false, status: "scheduled", unlocksAt: release.startAt };
  }

  if (release.startMode === "after_stockout") {
    // Default trigger: the previous release in order.
    let triggerId = release.afterReleaseId || "";
    if (!triggerId && idx > 0) triggerId = releases[idx - 1]?.id || "";
    if (!triggerId) return { unlocked: true, status: "live", unlocksAt: null };
    const triggerIdx = releases.findIndex((r) => String(r.id) === String(triggerId));
    const triggerAlloc = triggerIdx >= 0 ? alloc[triggerIdx] : null;
    // An unlimited trigger never "sells out" — stay locked until the organiser
    // releases manually (pause off + switch to now/date/manual).
    if (!triggerAlloc || triggerAlloc.unlimited || !triggerAlloc.soldOut) {
      return { unlocked: false, status: "waiting_stockout", unlocksAt: null, triggerId };
    }
    const delay = Math.max(0, Number(release.delayDays) || 0);
    if (delay <= 0) return { unlocked: true, status: "live", unlocksAt: null };
    const soT = soldOutAtOf(triggerId, soldOutAtMap);
    // Backward compat: sold out before we stamped times — treat the delay as
    // already elapsed rather than locking buyers out forever.
    if (soT == null) return { unlocked: true, status: "live", unlocksAt: null };
    const unlockT = soT + delay * 86400000;
    if (t >= unlockT) return { unlocked: true, status: "live", unlocksAt: null };
    return {
      unlocked: false,
      status: "waiting_delay",
      unlocksAt: new Date(unlockT).toISOString(),
      triggerId,
    };
  }

  // "now"
  return { unlocked: true, status: "live", unlocksAt: null };
}

export const RELEASE_STATUS_LABELS = {
  live: "On sale",
  scheduled: "Scheduled",
  waiting_stockout: "Waits for sell-out",
  waiting_delay: "Cooling down",
  manual_hold: "Not opened",
  paused: "Paused",
  ended: "Closed",
  soldout: "Sold out",
};

// Full per-ticket resolution. `sold` is the ticket's sold counter
// (metadata.ticketSold[ticketId]); `soldOutAtMap` is
// metadata.releaseSoldOutAt.
export function resolveTicketReleases(ticket, { sold = 0, soldOutAtMap = null, now = null } = {}) {
  const releases = getTicketReleases(ticket);
  if (!releases.length) {
    const qty = Number(ticket?.qty) || 0;
    const s = Math.max(0, Math.round(Number(sold) || 0));
    const remaining = qty > 0 ? Math.max(0, qty - s) : Infinity;
    return {
      hasReleases: false,
      releases,
      totalQty: qty,
      unlockedQty: qty,
      sold: s,
      remaining,
      soldOut: qty > 0 && remaining <= 0,
      activeReleases: [],
      nextRelease: null,
      perRelease: [],
    };
  }

  const nowDate = now instanceof Date ? now : now ? new Date(now) : new Date();
  const s = Math.max(0, Math.round(Number(sold) || 0));
  const alloc = allocateReleaseSales(releases, s);

  let unlockedQty = 0;
  let unlimitedUnlocked = false;
  const perRelease = releases.map((r, i) => {
    const a = alloc[i];
    const u = releaseUnlockState(r, i, { releases, alloc, soldOutAtMap, now: nowDate });
    const cap = Number(r.qty) || 0;
    const rem = cap > 0 ? Math.max(0, cap - a.sold) : Infinity;
    if (u.unlocked) {
      if (cap <= 0) unlimitedUnlocked = true;
      else unlockedQty += cap;
    }
    const soldOut = cap > 0 && a.sold >= cap;
    return {
      release: r,
      sold: a.sold,
      remaining: rem,
      soldOut,
      unlocked: u.unlocked,
      status: soldOut ? "soldout" : u.status,
      statusLabel: soldOut ? RELEASE_STATUS_LABELS.soldout : RELEASE_STATUS_LABELS[u.status] || u.status,
      unlocksAt: u.unlocksAt,
      triggerId: u.triggerId || null,
    };
  });

  const unlockedTotal = unlimitedUnlocked ? 0 : unlockedQty;
  const remaining = unlimitedUnlocked ? Infinity : Math.max(0, unlockedTotal - s);
  const totalQty = releases.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const allSoldOut = totalQty > 0 && s >= totalQty;

  const nextRelease =
    perRelease.find((p) => !p.unlocked && ["scheduled", "waiting_delay"].includes(p.status) && p.unlocksAt) ||
    perRelease.find((p) => !p.unlocked && !p.soldOut) ||
    null;

  return {
    hasReleases: true,
    releases,
    totalQty,
    unlockedQty: unlimitedUnlocked ? 0 : unlockedQty,
    unlimitedUnlocked,
    sold: s,
    remaining,
    soldOut: remaining <= 0 && !unlimitedUnlocked,
    allSoldOut,
    activeReleases: perRelease.filter((p) => p.unlocked && !p.soldOut),
    nextRelease,
    perRelease,
  };
}

// Buyer-facing line for a ticket with releases, e.g.
// "Wave 1 on sale · 34 left" or "Next wave opens 1 Oct".
export function releaseSummaryForTicket(ticket, { sold = 0, soldOutAtMap = null, now = null } = {}) {
  const st = resolveTicketReleases(ticket, { sold, soldOutAtMap, now });
  if (!st.hasReleases) return "";
  if (st.unlimitedUnlocked) return "On sale now";
  if (st.remaining > 0) {
    const live = st.activeReleases[0]?.release?.name;
    return `${live ? `${live} on sale · ` : ""}${st.remaining} left in this wave`;
  }
  if (st.nextRelease?.unlocksAt) {
    const d = new Date(st.nextRelease.unlocksAt);
    const label = Number.isNaN(d.getTime())
      ? st.nextRelease.unlocksAt
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `Next wave opens ${label}`;
  }
  if (st.nextRelease) return `${st.nextRelease.release?.name || "Next wave"} coming soon`;
  return "All waves sold out";
}

export function formatReleaseDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Release-aware availability for one ticket: the buyer can buy at most the
// unlocked tranche qty minus what is already sold minus reserved holds.
// Returns Infinity for unlimited. `reserved` is a held count for this ticket.
export function ticketReleaseAvailable(ticket, { sold = 0, soldOutAtMap = null, reserved = 0, now = null } = {}) {
  const st = resolveTicketReleases(ticket, { sold, soldOutAtMap, now });
  if (!st.hasReleases) {
    const qty = Number(ticket?.qty) || 0;
    if (qty <= 0) return Infinity;
    return Math.max(0, qty - Math.max(0, Number(sold) || 0) - Math.max(0, Number(reserved) || 0));
  }
  if (st.unlimitedUnlocked) return Infinity;
  return Math.max(0, st.remaining - Math.max(0, Number(reserved) || 0));
}
