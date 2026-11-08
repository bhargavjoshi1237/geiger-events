import { api, type ApiResult } from "@/lib/api";
import { teamAccessToken } from "@/lib/team_auth";

// Every Control request carries the team session — never the attendee token.
export async function controlApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const token = await teamAccessToken();
  if (!token) return { ok: false, error: "Sign in to Control to continue.", status: 401 };
  return api<T>(path, { ...init, token, onUnauthorized: "ignore" });
}
