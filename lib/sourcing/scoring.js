// Pure bid comparison and weighted scoring for an RFP. No I/O; every number the grid shows comes from here.

import {
  LINE_CATEGORY_KEYS,
  WEIGHT_KEYS,
  formatMoney,
  formatPct,
  normalizeConcessions,
  normalizeWeights,
  toNumber,
} from "./rfp_model.js";

export const WEIGHT_LABELS = {
  price: "Price",
  capacity: "Capacity fit",
  concessions: "Concessions",
  terms: "Terms",
};

const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const round = (n) => Math.round(n);

export function categoryTotals(lineItems) {
  const out = Object.fromEntries(LINE_CATEGORY_KEYS.map((k) => [k, 0]));
  for (const l of lineItems || []) {
    const key = LINE_CATEGORY_KEYS.includes(l.category) ? l.category : "other";
    out[key] += Number(l.total ?? (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)) || 0;
  }
  for (const k of LINE_CATEGORY_KEYS) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

// The budget figure deltas are measured against: the ceiling when set, else the floor.
export function budgetReference(rfp) {
  const max = toNumber(rfp?.budgetMax);
  if (max !== null && max > 0) return max;
  const min = toNumber(rfp?.budgetMin);
  return min !== null && min > 0 ? min : null;
}

// 0–100: how well a space's capacity matches the group. Undersized is penalised hardest, oversized gently.
export function capacityScore(capacity, attendees) {
  const cap = toNumber(capacity);
  const pax = Number(attendees) || 0;
  if (cap === null || cap <= 0 || pax <= 0) return { score: 50, known: false };
  const ratio = cap / pax;
  if (ratio < 1) return { score: round(clamp(ratio * 60)), known: true, ratio };
  if (ratio <= 1.5) return { score: 100, known: true, ratio };
  return { score: round(clamp(100 - (ratio - 1.5) * 40, 40)), known: true, ratio };
}

// 0–100 from deposit and attrition allowance; lapsing before the decision date costs 25.
export function termsScore(bid, rfp) {
  const deposit = toNumber(bid?.depositPct);
  const attrition = toNumber(bid?.attritionPct);
  const depositPart = deposit === null ? 50 : clamp(100 - deposit);
  const attritionPart = attrition === null ? 50 : clamp(attrition * 4);
  let score = (depositPart + attritionPart) / 2;
  const lapses = Boolean(bid?.validUntil && rfp?.decisionDate && bid.validUntil < rfp.decisionDate);
  if (lapses) score -= 25;
  return { score: round(clamp(score)), lapses, deposit, attrition };
}

function capacityReason(cap, pax, fit) {
  if (!fit.known) return "Capacity not stated";
  if (cap < pax) return `Holds ${cap.toLocaleString("en-US")} — ${(pax - cap).toLocaleString("en-US")} short`;
  if (fit.ratio <= 1.5) {
    const headroom = Math.round((fit.ratio - 1) * 100);
    return headroom > 0 ? `Fits ${pax.toLocaleString("en-US")} with ${headroom}% headroom` : `Fits ${pax.toLocaleString("en-US")} exactly`;
  }
  return `Oversized — ${cap.toLocaleString("en-US")} for ${pax.toLocaleString("en-US")}`;
}

// Scores every comparable bid. entries: [{ recipient, bid }]. Rejected bids are shown but never ranked.
export function compareBids(rfp, entries) {
  const weights = normalizeWeights(rfp?.scoringWeights);
  const weightSum = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0) || 1;
  const currency = rfp?.currency || "USD";
  const pax = Number(rfp?.attendees) || 0;
  const budget = budgetReference(rfp);

  const live = (entries || []).filter((e) => e?.bid && e.recipient?.status !== "declined");
  const ranked = live.filter((e) => e.bid.status !== "rejected");
  const totals = ranked.map((e) => Number(e.bid.total) || 0).filter((t) => t > 0);
  const lowest = totals.length ? Math.min(...totals) : null;
  const maxConcessions = Math.max(0, ...ranked.map((e) => normalizeConcessions(e.bid.concessions).length));

  const rows = live.map((e) => {
    const { bid, recipient } = e;
    const total = Number(bid.total) || 0;
    const categories = categoryTotals(bid.lineItems);
    const capacity = toNumber(bid.capacity) ?? toNumber(recipient?.details?.capacity);
    const fit = capacityScore(capacity, pax);
    const terms = termsScore(bid, rfp);
    const concessions = normalizeConcessions(bid.concessions);

    const scores = {
      price: lowest && total > 0 ? round(clamp((lowest / total) * 100)) : 0,
      capacity: fit.score,
      concessions: maxConcessions > 0 ? round((concessions.length / maxConcessions) * 100) : 0,
      terms: terms.score,
    };
    const weighted = round(WEIGHT_KEYS.reduce((s, k) => s + scores[k] * weights[k], 0) / weightSum);

    const vsBudget = budget !== null ? total - budget : null;
    const vsLowest = lowest !== null ? total - lowest : null;
    const reasons = [];
    if (lowest !== null && total === lowest) reasons.push("Lowest total");
    else if (lowest) reasons.push(`${formatPct(((total - lowest) / lowest) * 100)} above the lowest`);
    if (budget !== null) {
      reasons.push(
        vsBudget <= 0
          ? `${vsBudget === 0 ? "On" : `${formatPct((Math.abs(vsBudget) / budget) * 100)} under`} budget`
          : `${formatPct((vsBudget / budget) * 100)} over budget`,
      );
    }
    reasons.push(capacityReason(capacity, pax, fit));
    reasons.push(concessions.length ? `${concessions.length} concession${concessions.length === 1 ? "" : "s"}` : "No concessions");
    const termBits = [];
    if (terms.deposit !== null) termBits.push(`${terms.deposit}% deposit`);
    if (terms.attrition !== null) termBits.push(`${terms.attrition}% attrition allowance`);
    if (termBits.length) reasons.push(termBits.join(", "));
    if (terms.lapses) reasons.push("Offer lapses before your decision date");

    return {
      recipientId: recipient?.id,
      bidId: bid.id,
      name: recipient?.name || "Unnamed venue",
      status: bid.status,
      revision: bid.revision,
      total,
      subtotal: Number(bid.subtotal) || 0,
      taxesFees: Number(bid.taxesFees) || 0,
      categories,
      capacity,
      perAttendee: pax > 0 ? total / pax : null,
      vsBudget,
      vsBudgetPct: budget ? (vsBudget / budget) * 100 : null,
      vsLowest,
      vsLowestPct: lowest ? (vsLowest / lowest) * 100 : null,
      concessions,
      scores,
      weighted: bid.status === "rejected" ? null : weighted,
      rank: null,
      reasons,
      lapses: terms.lapses,
    };
  });

  const order = rows
    .filter((r) => r.weighted !== null)
    .sort((a, b) => b.weighted - a.weighted || a.total - b.total);
  order.forEach((r, i) => {
    r.rank = i + 1;
  });

  const bestByCategory = {};
  for (const k of LINE_CATEGORY_KEYS) {
    const priced = order.filter((r) => r.categories[k] > 0);
    if (priced.length > 1) {
      bestByCategory[k] = priced.reduce((best, r) => (r.categories[k] < best.categories[k] ? r : best)).recipientId;
    }
  }

  return {
    weights,
    lowest,
    budget,
    currency,
    rows: [...order, ...rows.filter((r) => r.weighted === null)],
    bestByCategory,
    recommendation: recommend(order, weights, currency),
  };
}

// The top-ranked bid, with the reasoning behind the pick spelled out.
function recommend(order, weights, currency) {
  const top = order[0];
  if (!top) return null;
  const runnerUp = order[1] || null;
  const strengths = WEIGHT_KEYS.filter((k) => weights[k] > 0)
    .sort((a, b) => top.scores[b] * weights[b] - top.scores[a] * weights[a])
    .slice(0, 2)
    .map((k) => `${WEIGHT_LABELS[k].toLowerCase()} (${top.scores[k]})`);

  const reasons = [];
  if (strengths.length) reasons.push(`Strongest on ${strengths.join(" and ")}.`);
  const cheapest = order.reduce((a, b) => (b.total > 0 && b.total < a.total ? b : a), top);
  if (cheapest !== top && cheapest.total > 0) {
    const gain = (k) => (top.scores[k] - cheapest.scores[k]) * weights[k];
    const edges = WEIGHT_KEYS.filter((k) => k !== "price" && gain(k) > 0)
      .sort((a, b) => gain(b) - gain(a))
      .slice(0, 2)
      .map((k) => WEIGHT_LABELS[k].toLowerCase());
    reasons.push(
      `Costs ${formatMoney(top.total - cheapest.total, currency)} more than ${cheapest.name}${edges.length ? `, but wins on ${edges.join(" and ")}` : ""}.`,
    );
  } else if (order.length > 1) {
    reasons.push("It is also the lowest-priced bid.");
  }
  if (top.vsBudget !== null && top.vsBudget > 0) {
    reasons.push(`Note: ${formatMoney(top.vsBudget, currency)} over budget — negotiate before awarding.`);
  }
  if (top.lapses) reasons.push("Its validity ends before your decision date — ask the venue to extend it.");
  if (runnerUp) {
    const gap = top.weighted - runnerUp.weighted;
    reasons.push(
      gap <= 3
        ? `Only ${gap} point${gap === 1 ? "" : "s"} ahead of ${runnerUp.name} — close enough to compare side by side.`
        : `Leads ${runnerUp.name} by ${gap} points.`,
    );
  } else {
    reasons.push("It is the only bid in contention so far.");
  }

  return {
    recipientId: top.recipientId,
    bidId: top.bidId,
    name: top.name,
    score: top.weighted,
    headline: `${top.name} scores ${top.weighted}/100 on your weights.`,
    reasons,
  };
}
