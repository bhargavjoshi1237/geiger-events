import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Server-only helpers for the RFP API routes and the public response page.

// A 256-bit link token; only its sha256 is stored (rfp_public_recipient_id hashes the same way).
export function newLinkToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: crypto.createHash("sha256").update(token, "utf8").digest("hex") };
}

// Runs fn over items with at most `limit` in flight.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Anonymous client for the token-gated rfp_public_* functions.
export function anonClient() {
  if (!SUPABASE_URL() || !ANON_KEY()) return null;
  return createClient(SUPABASE_URL(), ANON_KEY(), {
    db: { schema: "events" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The signed-in organiser's client (cookie session or bearer token), so RLS scopes every read and write.
export async function userClient(request) {
  if (!SUPABASE_URL() || !ANON_KEY()) return null;
  const header = request?.headers?.get?.("authorization") || "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(header)?.[1] || null;

  if (bearer) {
    const sb = createClient(SUPABASE_URL(), ANON_KEY(), {
      db: { schema: "events" },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getUser(bearer);
    if (error || !data?.user) return null;
    return { sb, user: data.user };
  }

  const { cookies } = await import("next/headers");
  const store = await cookies();
  const sb = createServerClient(SUPABASE_URL(), ANON_KEY(), {
    db: { schema: "events" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) store.set(name, value, options);
        } catch {
          // Cookies are read-only outside a mutable response; the refreshed session is simply not persisted.
        }
      },
    },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return null;
  return { sb, user: data.user };
}

// The public origin + basePath links in emails point at.
export function publicBaseUrl(request) {
  try {
    const configured = process.env.GEIGER_OPERATIONS_PUBLIC_URL;
    let base;
    if (configured) {
      base = new URL(configured);
    } else {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      if (basePath && !/^\/(?!\/)[^?#]*$/.test(basePath)) return null;
      base = new URL(basePath || "/", new URL(request.url).origin);
    }
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      return null;
    }
    return base.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const rfpResponseUrl = (base, token) => `${base}/rfp/${token}`;

// What the response page renders; never throws.
export async function fetchPublicRfp(token) {
  if (!TOKEN_RE.test(String(token || ""))) return { ok: false, reason: "not_found" };
  const sb = anonClient();
  if (!sb) return { ok: false, reason: "unavailable" };
  try {
    const { data, error } = await sb.rpc("rfp_public_get", { p_token: token });
    if (error) {
      console.error("[rfp.public.get]", error.message);
      return { ok: false, reason: "unavailable" };
    }
    return data && typeof data === "object" ? data : { ok: false, reason: "not_found" };
  } catch (e) {
    console.error("[rfp.public.get]", e);
    return { ok: false, reason: "unavailable" };
  }
}

// The response page's data plus the server clock its countdown starts from.
export async function loadRfpPage(token) {
  const data = await fetchPublicRfp(token);
  return { data, serverNow: Date.now() };
}

export function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
