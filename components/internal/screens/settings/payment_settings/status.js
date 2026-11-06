import { ACCOUNT_STATUS, CONNECT_COUNTRIES } from "@geiger/pay";

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const formatDateTime = (value) =>
  new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const countryName = (code) => CONNECT_COUNTRIES.find((item) => item.code === code)?.name || code;

export function isConnected(account) {
  const status = account?.status || ACCOUNT_STATUS.NOT_CONNECTED;
  return status !== ACCOUNT_STATUS.NOT_CONNECTED && status !== ACCOUNT_STATUS.DISCONNECTED;
}

// Stripe still wants something from the owner: an unfinished form or details due on a live account.
export function needsSetup(account) {
  return account?.status === ACCOUNT_STATUS.ACTION_REQUIRED || account?.requirementsDue > 0;
}

function detailsValue(account) {
  const due = account.requirementsDue || 0;
  if (account.status === ACCOUNT_STATUS.REJECTED) return "Couldn't be verified";
  if (account.status === ACCOUNT_STATUS.PENDING) return "In review with Stripe";
  if (due > 0) {
    const deadline = account.requirementsDeadline ? ` by ${formatDate(account.requirementsDeadline)}` : "";
    return `${due} ${due === 1 ? "item" : "items"} due${deadline}`;
  }
  if (account.status === ACCOUNT_STATUS.ACTION_REQUIRED) return "Setup not finished";
  return "Verified";
}

// Label/value rows describing a connected account, in the order Stripe unlocks them.
export function accountRows(account) {
  return [
    { label: "Business details", value: detailsValue(account) },
    { label: "Card payments", value: account.status === ACCOUNT_STATUS.ACTIVE ? "Enabled" : "Not yet enabled" },
    { label: "Payouts", value: account.payoutsEnabled ? "Enabled" : "Not yet enabled" },
    account.syncedAt ? { label: "Last checked", value: formatDateTime(account.syncedAt) } : null,
  ].filter(Boolean);
}
