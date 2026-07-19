// Pure poll helpers shared by the organiser data layer (client) and the member
// routes (server). A poll lives on a chat message's metadata:
//   metadata.type = 'poll'
//   metadata.poll = { question, options: [{ id, label }], votes: { optionId: [voterKey] }, multi, closed }
// A voterKey is "u:<userId>" (organiser) or "m:<memberId>" (member).

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

// Toggle a voter's choice, returning a new poll object. Single-choice polls move
// the vote; multi-choice toggle the one option.
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

// Total distinct voters across all options.
export function pollVoterCount(poll) {
  const set = new Set();
  for (const keys of Object.values(poll?.votes || {})) for (const k of keys) set.add(k);
  return set.size;
}
