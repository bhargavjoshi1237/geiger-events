export function selectSubmission(previous, payload, makeId) {
  const signature = JSON.stringify(payload);
  return previous?.signature === signature ? previous : { signature, commandId: makeId() };
}
