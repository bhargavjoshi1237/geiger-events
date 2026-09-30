const prefix = (eventId) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/events/${encodeURIComponent(eventId)}/operations`;
const recordsPath = (eventId, moduleKey) =>
  `${prefix(eventId)}/modules/${encodeURIComponent(moduleKey)}/records`;

export function createOperationsClient(fetcher = fetch) {
  async function send(method, url, body, signal) {
    try {
      const response = await fetcher(url, {
        method, credentials: "same-origin", cache: "no-store", signal,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return { data: null, error: payload?.error ?? {
          code: "request_failed", message: "Couldn't complete the request.",
        } };
      }
      return { data: payload, error: null };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { data: null, error: { code: "network_error", message: "Connection failed. Try again." } };
    }
  }
  return {
    workspace: (eventId, signal) => send("GET", `${prefix(eventId)}/workspace`, undefined, signal),
    packs: (eventId, signal) => send("GET", `${prefix(eventId)}/packs`, undefined, signal),
    saveDraft: (eventId, body, signal) => send("PUT", `${prefix(eventId)}/workspace`, body, signal),
    publish: (eventId, body, signal) => send("POST", `${prefix(eventId)}/workspace`, body, signal),
    archiveModule: (eventId, body, signal) => send("PATCH", `${prefix(eventId)}/workspace`, body, signal),
    moduleImpact: (eventId, moduleKey, signal) =>
      send("GET", `${prefix(eventId)}/modules/${encodeURIComponent(moduleKey)}/impact`, undefined, signal),
    listRecords: (eventId, moduleKey, filter = {}, signal) => {
      const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value != null));
      return send("GET", `${recordsPath(eventId, moduleKey)}?${query}`, undefined, signal);
    },
    createRecord: (eventId, moduleKey, body, signal) =>
      send("POST", recordsPath(eventId, moduleKey), body, signal),
    readRecord: (eventId, moduleKey, recordId, signal) =>
      send("GET", `${recordsPath(eventId, moduleKey)}/${encodeURIComponent(recordId)}`, undefined, signal),
    updateRecord: (eventId, moduleKey, recordId, body, signal) =>
      send("PUT", `${recordsPath(eventId, moduleKey)}/${encodeURIComponent(recordId)}`, body, signal),
    transitionRecord: (eventId, moduleKey, recordId, body, signal) =>
      send("PATCH", `${recordsPath(eventId, moduleKey)}/${encodeURIComponent(recordId)}`, body, signal),
    archiveRecord: (eventId, moduleKey, recordId, body, signal) =>
      send("DELETE", `${recordsPath(eventId, moduleKey)}/${encodeURIComponent(recordId)}`, body, signal),
  };
}

export const operationsClient = createOperationsClient();
