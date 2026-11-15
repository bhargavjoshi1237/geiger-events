// Browser client for the Workspace API. Always prefixes the basePath (bare fetch("/api/…") skips it).
const root = (eventId) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/events/${encodeURIComponent(eventId)}/workspace`;

export const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export async function request(method, url, body, signal) {
  try {
    const response = await fetch(url, {
      method, credentials: "same-origin", cache: "no-store", signal,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: payload?.error ?? { code: "request_failed", message: "Couldn't complete the request." } };
    }
    return { data: payload, error: null };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { data: null, error: { code: "network_error", message: "Connection failed. Check your connection and try again." } };
  }
}

export const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const workspaceApi = {
  definition: (eventId, signal) => request("GET", root(eventId), undefined, signal),

  // Sends one action; a dropped connection is retried once with the same commandId so it can't apply twice.
  async command(eventId, body) {
    const payload = { commandId: newId(), ...body };
    const first = await request("POST", root(eventId), payload);
    if (first.error?.code !== "network_error") return first;
    return request("POST", root(eventId), payload);
  },

  records: (eventId, objectId, spec, signal) => request("POST", `${root(eventId)}/records`, { objectId, spec }, signal),
  record: (eventId, recordId, signal) => request("GET", `${root(eventId)}/records/${encodeURIComponent(recordId)}`, undefined, signal),
  importRows: (eventId, body) => request("POST", `${root(eventId)}/records/import`, body),
  lookup: (eventId, params, signal) => request("GET", `${root(eventId)}/lookup${query(params)}`, undefined, signal),
  signUpload: (eventId, body) => request("POST", `${root(eventId)}/files`, body),
  download: (eventId, fileId) => request("GET", `${root(eventId)}/files${query({ id: fileId })}`),
  changes: (eventId, params = {}) => request("GET", `${root(eventId)}/changes${query(params)}`),
  trash: (eventId) => request("GET", `${root(eventId)}/changes?trash=1`),
  copySources: (eventId) => request("GET", `${root(eventId)}/copy?sources=1`),
  copySource: (eventId, sourceEventId) => request("GET", `${root(eventId)}/copy${query({ event: sourceEventId })}`),
  copy: (eventId, body) => request("POST", `${root(eventId)}/copy`, body),
  copyJob: (eventId, jobId) => request("GET", `${root(eventId)}/copy${query({ job: jobId })}`),
  matchTickets: (eventId, body) => request("POST", `${root(eventId)}/tickets`, { action: "match_email", ...body }),
  templates: (eventId) => request("GET", `${root(eventId)}/templates`),
  saveTemplate: (eventId, body) => request("POST", `${root(eventId)}/templates`, body),
  installTemplate: (eventId, key) => request("POST", `${root(eventId)}/templates`, { action: "install", key }),
  deleteTemplate: (eventId, id) => request("DELETE", `${root(eventId)}/templates${query({ id })}`),
};
