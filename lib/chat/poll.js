
export function buildPoll({ question, options, multi = false }) {
  const opts = (options || [])
    .map((label, i) => ({ id: `o${i + 1}`, label: String(label || "").trim() }))
    .filter((o) => o.label);
  return {
    question: String(question || "").trim(),
    options: opts,
    votes: {},
    multi: Boolean(multi),
    closed: false,
  };
}

export function togglePollVote(poll, optionId, voterKey) {
  if (!poll || !voterKey) return poll;
  const options = Array.isArray(poll.options) ? poll.options : [];
  if (poll.closed || !options.some((o) => o.id === optionId)) return poll;

  const votes = {};
  for (const o of options) votes[o.id] = [...new Set((poll.votes && poll.votes[o.id]) || [])];
  const has = votes[optionId].includes(voterKey);

  if (!poll.multi) {
    for (const k of Object.keys(votes)) votes[k] = votes[k].filter((v) => v !== voterKey);
    if (!has) votes[optionId].push(voterKey);
  } else if (has) {
    votes[optionId] = votes[optionId].filter((v) => v !== voterKey);
  } else {
    votes[optionId].push(voterKey);
  }
  return { ...poll, votes };
}

export function pollVoterCount(poll) {
  const set = new Set();
  for (const keys of Object.values(poll?.votes || {})) for (const k of keys) set.add(k);
  return set.size;
}
