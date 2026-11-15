import { isObject } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { assignReviewers, conflictOf, scoreSubmission, valueKeys } from "./assign.js";
import { allRecords, linkedIds } from "./records.js";

const bad = (message) => { throw new WorkspaceError("invalid_review", 422, message); };
const int = (value, min, max, fallback) => (Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);
const MATCHABLE = new Set(["single_select", "multi_select", "link_record", "short_text", "lookup", "email", "url"]);
const NUMERIC = (field) => ["number", "rating", "percent", "currency"].includes(field.type) || (field.type === "formula" && field.config.result === "number");

function objectOf(definition, id, what) {
  const object = definition.objects.find((item) => item.id === id && !item.deletedAt);
  if (!object) bad(what);
  return object;
}

function filterOf(definition, objectId, filter) {
  if (!filter) return null;
  try {
    compileQuery(definition, objectId, { filter, limit: 1 });
  } catch (error) {
    if (error instanceof WorkspaceError) bad(error.message);
    throw error;
  }
  return filter;
}

const fieldOn = (definition, objectId, id, test = () => true) => liveFields(definition, objectId).find((field) => field.id === id && test(field)) ?? null;

// A review setup: which lists hold submissions, reviews and reviewers, and how reviewers are chosen and scored.
export function validateReviewSetup(definition, input) {
  if (!isObject(input)) bad("Describe the review.");
  const submissions = objectOf(definition, input.submissionsObjectId, "Choose the list of submissions.");
  const reviews = objectOf(definition, input.reviewsObjectId, "Choose the list reviews are kept in.");
  if (submissions.id === reviews.id) bad("Reviews need their own list.");
  const submissionField = fieldOn(definition, reviews.id, input.submissionFieldId, (field) => field.type === "link_record" && field.config.targetObjectId === submissions.id);
  if (!submissionField) bad(`Choose the field on ${reviews.plural} that links to the ${submissions.name.toLowerCase()}.`);
  const reviewerField = fieldOn(definition, reviews.id, input.reviewerFieldId, (field) => field.type === "link_record" && field.id !== submissionField.id);
  if (!reviewerField) bad(`Choose the field on ${reviews.plural} that links to the reviewer.`);
  const reviewersObjectId = reviewerField.config.targetObjectId;
  const topicsIn = isObject(input.topics) ? input.topics : {};
  const conflictsIn = isObject(input.conflicts) ? input.conflicts : {};
  const statuses = new Set((reviews.statuses ?? []).map((status) => status.key));
  const submissionStatuses = new Set((submissions.statuses ?? []).map((status) => status.key));
  const rubric = (Array.isArray(input.rubric) ? input.rubric : []).slice(0, 20)
    .filter((item) => isObject(item) && fieldOn(definition, reviews.id, item.fieldId, NUMERIC))
    .map((item) => ({ fieldId: item.fieldId, weight: typeof item.weight === "number" && item.weight > 0 ? Math.min(100, item.weight) : 1 }));
  return {
    submissionsObjectId: submissions.id,
    reviewsObjectId: reviews.id,
    submissionFieldId: submissionField.id,
    reviewerFieldId: reviewerField.id,
    reviewersObjectId,
    submissionFilter: filterOf(definition, submissions.id, input.submissionFilter ?? null),
    reviewerFilter: filterOf(definition, reviewersObjectId, input.reviewerFilter ?? null),
    perSubmission: int(input.perSubmission, 1, 10, 3),
    maxPerReviewer: input.maxPerReviewer === null || input.maxPerReviewer === undefined || input.maxPerReviewer === "" ? null : int(input.maxPerReviewer, 1, 500, 10),
    topics: {
      submissionFieldId: fieldOn(definition, submissions.id, topicsIn.submissionFieldId, (field) => MATCHABLE.has(field.type))?.id ?? null,
      reviewerFieldId: fieldOn(definition, reviewersObjectId, topicsIn.reviewerFieldId, (field) => MATCHABLE.has(field.type))?.id ?? null,
    },
    conflicts: {
      authorsFieldId: fieldOn(definition, submissions.id, conflictsIn.authorsFieldId,
        (field) => field.type === "link_record" && field.config.targetObjectId === reviewersObjectId)?.id ?? null,
      reviewerConflictsFieldId: fieldOn(definition, reviewersObjectId, conflictsIn.reviewerConflictsFieldId,
        (field) => field.type === "link_record" && field.config.targetObjectId === submissions.id)?.id ?? null,
      sameValue: (Array.isArray(conflictsIn.sameValue) ? conflictsIn.sameValue : []).slice(0, 5).filter((pair) => isObject(pair)
        && fieldOn(definition, submissions.id, pair.submissionFieldId, (field) => MATCHABLE.has(field.type))
        && fieldOn(definition, reviewersObjectId, pair.reviewerFieldId, (field) => MATCHABLE.has(field.type)))
        .map((pair) => ({ submissionFieldId: pair.submissionFieldId, reviewerFieldId: pair.reviewerFieldId })),
    },
    rubric,
    doneStatuses: (Array.isArray(input.doneStatuses) ? input.doneStatuses : []).filter((key) => statuses.has(key)),
    newStatus: statuses.has(input.newStatus) ? input.newStatus : null,
    decisions: (Array.isArray(input.decisions) ? input.decisions : []).filter((key) => submissionStatuses.has(key)).slice(0, 8),
    disagreement: typeof input.disagreement === "number" && input.disagreement > 0 ? Math.min(100, input.disagreement) : null,
  };
}

// Field keys for matching: links compare by linked record, choices by option, text case-insensitively.
function keysOf(definition, record, fieldId) {
  if (!fieldId || !record) return new Set();
  const field = definition.fields.find((item) => item.id === fieldId);
  if (!field) return new Set();
  if (getType(field.type)?.cast === "link") return valueKeys(null, record.links?.[fieldId] ?? []);
  if (field.type === "lookup") {
    const raw = record.computed?.[fieldId];
    return valueKeys(typeof raw === "string" ? raw.split(",") : raw);
  }
  return valueKeys(record.values?.[fieldId]);
}

function union(...sets) {
  const out = new Set();
  for (const set of sets) for (const item of set) out.add(item);
  return out;
}

// Everything a setup needs: submissions, the reviewer pool, existing reviews, all as records with links.
export async function loadReviewData(context, definition, setup, { submissionIds = null, workspace, venueId } = {}) {
  const config = setup.config;
  const options = { workspace, venueId };
  const [submissionRows, reviewerRows, reviewRows] = await Promise.all([
    allRecords(context, definition, config.submissionsObjectId, { ...options, filter: config.submissionFilter, max: 2000 }),
    allRecords(context, definition, config.reviewersObjectId, { ...options, filter: config.reviewerFilter, max: 2000 }),
    allRecords(context, definition, config.reviewsObjectId, { ...options, max: 10_000 }),
  ]);
  const wanted = submissionIds ? new Set(submissionIds) : null;
  return {
    submissions: wanted ? submissionRows.filter((row) => wanted.has(row.id)) : submissionRows,
    reviewers: reviewerRows,
    reviews: reviewRows,
  };
}

// Proposed reviewer pairs for submissions (all, or only `submissionIds`), honouring existing reviews.
export function planAssignments(definition, setup, data) {
  const config = setup.config;
  const existing = data.reviews.flatMap((review) => {
    const submissionId = linkedIds(review, config.submissionFieldId)[0];
    const reviewerId = linkedIds(review, config.reviewerFieldId)[0];
    return submissionId && reviewerId ? [{ submissionId, reviewerId }] : [];
  });
  const submissions = data.submissions.map((row) => ({
    id: row.id,
    topics: keysOf(definition, row, config.topics.submissionFieldId),
    authorIds: new Set(linkedIds(row, config.conflicts.authorsFieldId)),
    conflictKeys: union(...config.conflicts.sameValue.map((pair) => keysOf(definition, row, pair.submissionFieldId))),
  }));
  const reviewers = data.reviewers.map((row) => ({
    id: row.id,
    topics: keysOf(definition, row, config.topics.reviewerFieldId),
    conflictKeys: union(...config.conflicts.sameValue.map((pair) => keysOf(definition, row, pair.reviewerFieldId))),
    conflictSubmissionIds: new Set(linkedIds(row, config.conflicts.reviewerConflictsFieldId)),
  }));
  const result = assignReviewers({
    submissions, reviewers, existing,
    perSubmission: config.perSubmission, maxPerReviewer: config.maxPerReviewer,
  });
  const label = (rows, id) => rows.find((row) => row.id === id)?.title ?? "";
  return {
    pairs: result.pairs.map((pair) => ({ ...pair, submission: label(data.submissions, pair.submissionId), reviewer: label(data.reviewers, pair.reviewerId) })),
    unfilled: result.unfilled.map((item) => ({ ...item, submission: label(data.submissions, item.submissionId) })),
    conflicts: submissions.reduce((n, submission) => n + reviewers.filter((reviewer) => conflictOf(submission, reviewer)).length, 0),
    reviewers: reviewers.length,
  };
}

// The review screen's table: each submission with its reviews, score and flags.
export function reviewResults(definition, setup, data) {
  const config = setup.config;
  const reviewsObject = definition.objects.find((object) => object.id === config.reviewsObjectId);
  const bySubmission = new Map(data.submissions.map((row) => [row.id, []]));
  for (const review of data.reviews) {
    const id = linkedIds(review, config.submissionFieldId)[0];
    if (bySubmission.has(id)) bySubmission.get(id).push(review);
  }
  return data.submissions.map((row) => {
    const reviews = bySubmission.get(row.id);
    const score = scoreSubmission(reviews, config.rubric, { doneStatuses: config.doneStatuses });
    return {
      id: row.id, number: row.number, title: row.title, status: row.status,
      ...score,
      flagged: config.disagreement !== null && score.done > 1 && score.spread >= config.disagreement,
      reviews: reviews.map((review) => ({
        id: review.id, number: review.number, status: review.status,
        statusLabel: reviewsObject?.statuses?.find((status) => status.key === review.status)?.label ?? "",
        reviewer: review.links?.[config.reviewerFieldId]?.[0]?.label ?? "Unassigned",
        reviewerId: linkedIds(review, config.reviewerFieldId)[0] ?? null,
        score: scoreSubmission([review], config.rubric).average,
        done: config.doneStatuses.length ? config.doneStatuses.includes(review.status) : true,
      })),
    };
  });
}

// The values that create one review record for a pair.
export function reviewInput(setup, pair) {
  const config = setup.config;
  return {
    values: { [config.submissionFieldId]: [pair.submissionId], [config.reviewerFieldId]: [pair.reviewerId] },
    ...(config.newStatus ? { status: config.newStatus } : {}),
  };
}
