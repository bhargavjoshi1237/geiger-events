import { adminClient } from "@/lib/supabase/admin";

import { PAGE_LIMIT, RATE_LIMIT } from "../catalog.js";
import { hashApiKey, looksLikeApiKey } from "../crypto.js";

// Public REST API plumbing: bearer-key auth, scope checks, rate limiting, query parsing and one error shape.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const AUTH_MESSAGES = {
  invalid_key: "That API key isn't valid.",
  revoked_key: "This API key was revoked.",
  expired_key: "This API key has expired.",
};

function rateHeaders(rate) {
  const headers = { "Cache-Control": "no-store" };
  if (rate) {
    headers["X-RateLimit-Limit"] = String(rate.limit);
    headers["X-RateLimit-Remaining"] = String(rate.remaining);
    headers["X-RateLimit-Reset"] = String(rate.reset);
  }
  return headers;
}

export function apiError(status, code, message, rate = null, extraHeaders = {}) {
  return Response.json({ error: { status, code, message } }, { status, headers: { ...rateHeaders(rate), ...extraHeaders } });
}

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || null;
}

// Wraps a route handler: `handler({ request, params, query, db, projectId, key })` returns { body, status? }.
export function apiRoute(scope, handler) {
  return async function route(request, context) {
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
    if (!match) return apiError(401, "missing_api_key", "Send your API key in the header: Authorization: Bearer <key>.");
    if (!looksLikeApiKey(match[1])) return apiError(401, "invalid_key", AUTH_MESSAGES.invalid_key);

    const db = adminClient();
    if (!db) return apiError(503, "unavailable", "The API isn't available right now.");

    const { data: auth, error } = await db.rpc("api_authenticate", {
      p_hash: hashApiKey(match[1]),
      p_ip: clientIp(request),
      p_limit: RATE_LIMIT.limit,
      p_window_seconds: RATE_LIMIT.windowSeconds,
    });
    if (error) {
      console.error("[api.v1.auth]", error.message);
      return apiError(503, "unavailable", "The API isn't available right now.");
    }
    if (!auth?.ok) {
      const reason = auth?.reason || "invalid_key";
      return apiError(401, reason, AUTH_MESSAGES[reason] || AUTH_MESSAGES.invalid_key);
    }

    const rate = auth.rate || null;
    if (rate?.limited) {
      const retryAfter = Math.max(1, Number(rate.reset) - Math.floor(Date.now() / 1000));
      return apiError(
        429,
        "rate_limited",
        `Too many requests. Each key can make ${rate.limit} requests a minute.`,
        rate,
        { "Retry-After": String(retryAfter) },
      );
    }
    if (!(auth.scopes || []).includes(scope)) {
      return apiError(403, "insufficient_scope", `This key doesn't have the ${scope} scope.`, rate);
    }

    try {
      const params = context?.params ? await context.params : {};
      const result = await handler({
        request,
        params: params || {},
        query: new URL(request.url).searchParams,
        db,
        projectId: auth.project_id,
        key: { id: auth.key_id, name: auth.name || "" },
      });
      return Response.json(result.body, { status: result.status || 200, headers: rateHeaders(rate) });
    } catch (e) {
      if (e instanceof ApiError) return apiError(e.status, e.code, e.message, rate);
      console.error("[api.v1]", e);
      return apiError(500, "internal_error", "Something went wrong on our side. Please try again.", rate);
    }
  };
}

export function parseUuid(value, name, { required = false } = {}) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) throw new ApiError(400, "missing_parameter", `${name} is required.`);
    return null;
  }
  if (!UUID.test(raw)) throw new ApiError(400, "invalid_parameter", `${name} must be a UUID.`);
  return raw.toLowerCase();
}

// Accepts an ISO 8601 date/time or unix seconds.
export function parseTime(value, name) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return null;
  const date = /^\d+$/.test(raw) ? new Date(Number(raw) * 1000) : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "invalid_parameter", `${name} must be an ISO 8601 timestamp or unix seconds.`);
  }
  return date.toISOString();
}

export function parseEnum(value, name) {
  const raw = value == null ? "" : String(value).trim().toLowerCase();
  if (!raw) return null;
  if (!/^[a-z0-9_]{1,40}$/.test(raw)) throw new ApiError(400, "invalid_parameter", `${name} isn't a valid value.`);
  return raw;
}

export function parsePage(query) {
  const rawLimit = query.get("limit");
  let limit = PAGE_LIMIT.default;
  if (rawLimit != null && rawLimit !== "") {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_LIMIT.max) {
      throw new ApiError(400, "invalid_parameter", `limit must be a whole number from 1 to ${PAGE_LIMIT.max}.`);
    }
  }
  return { limit, startingAfter: parseUuid(query.get("starting_after"), "starting_after") };
}

export async function callRpc(db, fn, args) {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    console.error(`[api.v1.${fn}]`, error.message);
    throw new ApiError(503, "unavailable", "The API isn't available right now.");
  }
  return data;
}

// A list RPC's { data, has_more } as the public list envelope.
export function listBody(result) {
  if (result?.error === "invalid_cursor") {
    throw new ApiError(400, "invalid_cursor", "starting_after must be the id of an object from a previous page.");
  }
  const data = Array.isArray(result?.data) ? result.data : [];
  const hasMore = result?.has_more === true;
  return {
    body: { object: "list", data, has_more: hasMore, next_cursor: hasMore && data.length ? data[data.length - 1].id : null },
  };
}

export function notFound(what) {
  return new ApiError(404, "not_found", `No ${what} with that id in this project.`);
}
