// Reviewer assignment and rubric scoring. Pure: callers load records and turn values into the plain sets used here.

const overlap = (a, b) => {
  let n = 0;
  for (const item of a) if (b.has(item)) n += 1;
  return n;
};

// Why a reviewer can't review a submission, or null when they can.
export function conflictOf(submission, reviewer) {
  if (submission.authorIds?.has(reviewer.id)) return "is an author";
  if (reviewer.conflictSubmissionIds?.has(submission.id)) return "declared a conflict";
  if (submission.conflictKeys && reviewer.conflictKeys && overlap(submission.conflictKeys, reviewer.conflictKeys) > 0) return "shares an affiliation";
  return null;
}

// submissions: [{ id, topics: Set, authorIds: Set, conflictKeys: Set }]
// reviewers:   [{ id, topics: Set, conflictKeys: Set, conflictSubmissionIds: Set }]
// existing:    [{ submissionId, reviewerId }] — reviews already assigned (they count towards load and the per-submission total).
// Assigns one reviewer per submission per pass (most constrained submissions first), preferring topic matches and light loads.
export function assignReviewers({ submissions, reviewers, existing = [], perSubmission = 3, maxPerReviewer = null }) {
  const assigned = new Map(submissions.map((submission) => [submission.id, new Set()]));
  const load = new Map(reviewers.map((reviewer) => [reviewer.id, 0]));
  for (const pair of existing) {
    assigned.get(pair.submissionId)?.add(pair.reviewerId);
    if (load.has(pair.reviewerId)) load.set(pair.reviewerId, load.get(pair.reviewerId) + 1);
  }
  const cap = Number.isInteger(maxPerReviewer) && maxPerReviewer > 0 ? maxPerReviewer : Infinity;
  const eligible = new Map(submissions.map((submission) => [submission.id,
    reviewers.filter((reviewer) => !conflictOf(submission, reviewer))]));
  const order = [...submissions].sort((a, b) => eligible.get(a.id).length - eligible.get(b.id).length || String(a.id).localeCompare(String(b.id)));
  const pairs = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (const submission of order) {
      const have = assigned.get(submission.id);
      if (have.size >= perSubmission) continue;
      let best = null;
      for (const reviewer of eligible.get(submission.id)) {
        if (have.has(reviewer.id) || load.get(reviewer.id) >= cap) continue;
        const topics = submission.topics && reviewer.topics ? overlap(submission.topics, reviewer.topics) : 0;
        const score = topics * 3 - load.get(reviewer.id);
        if (!best || score > best.score || (score === best.score && String(reviewer.id) < String(best.reviewer.id))) best = { reviewer, score, topics };
      }
      if (!best) continue;
      have.add(best.reviewer.id);
      load.set(best.reviewer.id, load.get(best.reviewer.id) + 1);
      pairs.push({ submissionId: submission.id, reviewerId: best.reviewer.id, topics: best.topics });
      progress = true;
    }
  }

  const unfilled = [];
  for (const submission of submissions) {
    const missing = perSubmission - assigned.get(submission.id).size;
    if (missing <= 0) continue;
    const candidates = eligible.get(submission.id);
    const reason = !candidates.length ? "Every reviewer has a conflict"
      : candidates.every((reviewer) => assigned.get(submission.id).has(reviewer.id) || load.get(reviewer.id) >= cap) ? "Every eligible reviewer is at their limit"
        : "Not enough eligible reviewers";
    unfilled.push({ submissionId: submission.id, missing, reason });
  }
  return { pairs, unfilled, load: Object.fromEntries(load) };
}

const toNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// One review's weighted score over the rubric, or null until every rubric field is filled.
export function reviewScore(values, rubric) {
  if (!rubric?.length) return null;
  let total = 0;
  let weights = 0;
  for (const item of rubric) {
    const value = toNumber(values?.[item.fieldId]);
    if (value === null) return null;
    const weight = typeof item.weight === "number" && item.weight > 0 ? item.weight : 1;
    total += value * weight;
    weights += weight;
  }
  return weights ? total / weights : null;
}

// A submission's result from its reviews: average of finished reviews, spread between them, and counts.
export function scoreSubmission(reviews, rubric, { doneStatuses = [] } = {}) {
  const done = reviews.filter((review) => (doneStatuses.length ? doneStatuses.includes(review.status) : true));
  const scores = done.map((review) => reviewScore(review.values, rubric)).filter((score) => score !== null);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const spread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
  return {
    assigned: reviews.length, done: scores.length,
    average: average === null ? null : Math.round(average * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    scores: scores.map((score) => Math.round(score * 100) / 100),
  };
}

// Plain strings for matching: option ids, link target ids, or folded text.
export function valueKeys(value, links) {
  if (links) return new Set(links.map((link) => link.id));
  if (value === null || value === undefined || value === "") return new Set();
  const list = Array.isArray(value) ? value : [value];
  return new Set(list.map((item) => (typeof item === "string" ? item.trim().toLowerCase() : typeof item === "object" ? String(item?.label ?? item?.id ?? "").toLowerCase() : String(item))).filter(Boolean));
}
