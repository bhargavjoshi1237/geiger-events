import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Hardware tap endpoint for NFC readers / scanning devices.
//
//   POST /api/nfc/tap   { device_key, nfc_uid, idempotency_key?, tapped_at? }
//   GET  /api/nfc/tap?device_key=…   (provisioning check, no secret returned)
//
// Auth is the per-point device_key (provisioned from Check-in → RFID/NFC →
// entry point → Reveal/Copy). The Supabase anon key only reaches the
// SECURITY DEFINER events.nfc_tap() RPC, which validates the device key
// server-side — the same trust model as the staff scanner RPCs, so the anon
// key is safe to bake into on-site gateway software. No service-role key is
// needed or used here.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-nfc-device-key",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    db: { schema: "events" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const bad = (reason, status = 400, extra = {}) =>
  NextResponse.json({ ok: false, reason, ...extra }, { status, headers: CORS });

// Provisioning check: a reader (or installer phone) confirms which point,
// event, price and mode a key maps to before going live.
export async function GET(request) {
  const key =
    request.headers.get("x-nfc-device-key") ||
    new URL(request.url).searchParams.get("device_key") ||
    "";
  if (!key.trim()) return bad("MISSING_KEY", 401);
  const sb = anonClient();
  if (!sb) return bad("UNAVAILABLE", 503);
  const { data, error } = await sb.rpc("nfc_point_config", {
    p_device_key: key.trim(),
  });
  if (error) {
    console.error("[nfc.tap.config]", error.message);
    return bad("UNAVAILABLE", 503);
  }
  if (!data) return bad("INVALID_POINT", 401);
  if (data.active === false) return bad("POINT_INACTIVE", 409, { point: data });
  return NextResponse.json({ ok: true, point: data }, { headers: CORS });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("INVALID_JSON");
  }
  const key =
    request.headers.get("x-nfc-device-key") ||
    body?.device_key ||
    body?.deviceKey ||
    "";
  const uid = body?.nfc_uid || body?.nfcUid || "";
  const idem = body?.idempotency_key || body?.idempotencyKey || null;
  const tappedAt = body?.tapped_at || body?.tappedAt || null;

  if (!String(key).trim()) return bad("MISSING_KEY", 401);
  if (!String(uid).trim()) return bad("MISSING_UID");
  const cleanKey = String(key).trim();
  const cleanUid = String(uid).trim().toUpperCase().replace(/\s+/g, "");
  const cleanIdem = idem != null && String(idem).trim() ? String(idem).trim() : null;
  let cleanTappedAt = null;
  if (tappedAt) {
    const d = new Date(tappedAt);
    if (Number.isNaN(d.getTime())) return bad("INVALID_TAPPED_AT");
    cleanTappedAt = d.toISOString();
  }

  const sb = anonClient();
  if (!sb) return bad("UNAVAILABLE", 503);
  const { data, error } = await sb.rpc("nfc_tap", {
    p_device_key: cleanKey,
    p_nfc_uid: cleanUid,
    p_idempotency_key: cleanIdem,
    p_tapped_at: cleanTappedAt,
  });
  if (error) {
    console.error("[nfc.tap]", error.message);
    return bad("UNAVAILABLE", 503);
  }
  if (!data?.ok) {
    const reason = data?.reason || "FAILED";
    const status =
      reason === "INVALID_POINT"
        ? 401
        : reason === "UNKNOWN_UID"
          ? 404
          : reason === "POINT_INACTIVE" || reason === "CREDENTIAL_INACTIVE"
            ? 409
            : 400;
    return bad(reason, status);
  }
  return NextResponse.json(data, { headers: CORS });
}
