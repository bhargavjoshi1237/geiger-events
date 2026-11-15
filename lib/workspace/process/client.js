import { query, request } from "../client.js";

// Browser client for stage rules, automations, runs, approvals and review. Always prefixes the basePath.
const root = (eventId) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/events/${encodeURIComponent(eventId)}/workspace`;

export function processApi(eventId) {
  return {
    overview: (signal) => request("GET", `${root(eventId)}/process`, undefined, signal),
    recordContext: (recordId, signal) => request("GET", `${root(eventId)}/process${query({ record: recordId })}`, undefined, signal),
    command: (body) => request("POST", `${root(eventId)}/process`, body),
    runs: (params = {}, signal) => request("GET", `${root(eventId)}/runs${query(params)}`, undefined, signal),
    retry: (runId) => request("POST", `${root(eventId)}/runs`, { action: "retry", runId }),
    approvals: (params = {}, signal) => request("GET", `${root(eventId)}/approvals${query(params)}`, undefined, signal),
    approvalCount: (signal) => request("GET", `${root(eventId)}/approvals?count=1`, undefined, signal),
    approval: (body) => request("POST", `${root(eventId)}/approvals`, body),
    review: (setupId, signal) => request("GET", `${root(eventId)}/review${query({ setup: setupId })}`, undefined, signal),
    reviewAction: (body) => request("POST", `${root(eventId)}/review`, body),
  };
}
