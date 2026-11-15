import { newId, query, request } from "../client.js";

// Browser clients for the portal (outside people) and the portal builder (staff). Both prefix the basePath.
const base = () => process.env.NEXT_PUBLIC_BASE_PATH || "";
const portalRoot = (eventId) => `${base()}/api/portal/workspace/${encodeURIComponent(eventId)}`;
const staffRoot = (eventId) => `${base()}/api/events/${encodeURIComponent(eventId)}/workspace/portal`;

// A write is retried once with the same commandId after a dropped connection, so it can't apply twice.
async function once(method, url, body) {
  const payload = { commandId: newId(), ...body };
  const first = await request(method, url, payload);
  if (first.error?.code !== "network_error") return first;
  return request(method, url, payload);
}

export function portalApi(eventId) {
  const root = portalRoot(eventId);
  return {
    session: (signal) => request("GET", root, undefined, signal),
    page: (slug, signal) => request("GET", `${root}/page${query({ slug })}`, undefined, signal),
    recordPage: (list, number, signal) => request("GET", `${root}/page${query({ list, number })}`, undefined, signal),
    blockData: (body, signal) => request("POST", `${root}/block`, body, signal),
    command: (body) => once("POST", `${root}/command`, body),
    lookup: (params, signal) => request("GET", `${root}/lookup${query(params)}`, undefined, signal),
    signUpload: (body) => request("POST", `${root}/files`, body),
    signFile: (params) => request("GET", `${root}/files${query({ ...params, inline: params.inline ? 1 : undefined })}`),
    saveDraft: (body) => request("PUT", `${root}/drafts`, body),
    clearDraft: (params) => request("DELETE", `${root}/drafts${query(params)}`),
    requestCode: (email) => request("POST", `${root}/auth/code`, { email }),
    verifyCode: (email, code) => request("POST", `${root}/auth/verify`, { email, code }),
    acceptInvite: (token) => request("POST", `${root}/auth/invite`, { token }),
    signOut: () => request("POST", `${root}/auth/signout`, {}),
  };
}

export function portalBuilderApi(eventId) {
  const root = staffRoot(eventId);
  return {
    state: (signal) => request("GET", root, undefined, signal),
    command: (body) => once("POST", root, body),
    view: (body, signal) => request("POST", `${root}/view`, body, signal),
    scan: (body) => once("POST", `${root}/scan`, body),
    people: (signal) => request("GET", `${root}/invites`, undefined, signal),
    invite: (body) => request("POST", `${root}/invites`, { action: "send", ...body }),
    revokeInvite: (inviteId) => request("POST", `${root}/invites`, { action: "revoke", inviteId }),
  };
}
