import Constants from "expo-constants";

// The only module that calls fetch against the portal API. Base URL comes from
// the runtime env var, then app.json's extra.apiBaseUrl, then production.
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "https://geiger.studio/events"
).replace(/\/+$/, "");

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type ApiInit = {
  method?: string;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

// Registered by the session provider so a 401 anywhere drops the session. The
// indirection keeps api.ts free of any dependency on state/.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function api<T>(
  path: string,
  init: ApiInit = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-geiger-client": "mobile",
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method || "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch {
    return { ok: false, error: "You appear to be offline.", status: 0 };
  }

  const data = parseJson<T>(await res.text().catch(() => "{}"));
  if (res.status === 401) {
    unauthorizedHandler?.();
    return { ok: false, error: errorText(data), status: 401 };
  }
  if (!res.ok) {
    return { ok: false, error: errorText(data), status: res.status };
  }
  return { ok: true, data };
}

function errorText(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err) return err;
  }
  return "Something went wrong.";
}
