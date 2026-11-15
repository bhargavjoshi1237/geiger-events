import { query, request } from "../client.js";

// Browser client for email and PDF templates and certificates. Always prefixes the basePath.
const root = (eventId) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/events/${encodeURIComponent(eventId)}/workspace/documents`;

export function documentsApi(eventId) {
  return {
    list: (signal) => request("GET", root(eventId), undefined, signal),
    certificates: (params = {}, signal) => request("GET", `${root(eventId)}${query({ certificates: 1, ...params })}`, undefined, signal),
    command: (body) => request("POST", root(eventId), body),
    generate: (body) => request("POST", `${root(eventId)}/generate`, body),
    // The rendered PDF for a record (or sample data) as a blob URL for the preview frame.
    async preview(body, signal) {
      try {
        const response = await fetch(`${root(eventId)}/render`, {
          method: "POST", credentials: "same-origin", cache: "no-store", signal,
          headers: { "content-type": "application/json" }, body: JSON.stringify(body),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          return { data: null, error: payload?.error ?? { message: "Couldn't render the preview." } };
        }
        const warnings = response.headers.get("x-document-warnings");
        return { data: { url: URL.createObjectURL(await response.blob()), warnings: warnings ? JSON.parse(decodeURIComponent(warnings)) : [] }, error: null };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return { data: null, error: { message: "Connection failed. Check your connection and try again." } };
      }
    },
  };
}
