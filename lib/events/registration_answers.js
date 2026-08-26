
export const DIETARY_ANSWER_PREFIX = "dietary:";

export function splitRegistrationAnswers(questions, answers) {
  let dietary = "";
  let accessibility = "";
  const bag = {};
  for (const q of Array.isArray(questions) ? questions : []) {
    const val = answers?.[q.id];
    if (val === undefined || val === "" || val === false) continue;
    if (/diet|allerg/i.test(q.label)) dietary = String(val);
    else if (/accessib|mobility|disab/i.test(q.label)) accessibility = String(val);
    else bag[q.label] = val;
  }
  for (const [key, val] of Object.entries(answers || {})) {
    if (!key.startsWith(DIETARY_ANSWER_PREFIX)) continue;
    if (val === undefined || val === "" || (Array.isArray(val) && !val.length)) continue;
    bag[key] = val;
  }
  return { dietary, accessibility, answers: bag };
}
