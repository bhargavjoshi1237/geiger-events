// Shared by the free-ticket checkout (client, event_public_page.jsx) and the
// paid Stripe checkout verify route (server) so a registration record looks
// the same regardless of which path the buyer took. Buckets custom-question
// answers into the registration's dedicated dietary/accessibility columns,
// leaving the rest in a label-keyed metadata bag.
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
  return { dietary, accessibility, answers: bag };
}
