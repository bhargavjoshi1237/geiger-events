
export const DIETARY_ANSWER_PREFIX = "dietary:";

export function splitRegistrationAnswers(questions, answers) {
  // Several diet or access questions (e.g. "Dietary requirements" and "Allergies") are joined, not overwritten.
  const dietary = [];
  const accessibility = [];
  const bag = {};
  for (const q of Array.isArray(questions) ? questions : []) {
    const val = answers?.[q.id];
    if (val === undefined || val === "" || val === false) continue;
    if (/diet|allerg/i.test(q.label)) dietary.push(String(val));
    else if (/accessib|mobility|disab/i.test(q.label)) accessibility.push(String(val));
    else bag[q.label] = val;
  }
  for (const [key, val] of Object.entries(answers || {})) {
    if (!key.startsWith(DIETARY_ANSWER_PREFIX)) continue;
    if (val === undefined || val === "" || (Array.isArray(val) && !val.length)) continue;
    bag[key] = val;
  }
  return { dietary: dietary.join("; "), accessibility: accessibility.join("; "), answers: bag };
}
