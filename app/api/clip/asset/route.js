import { NextResponse } from "next/server";

import { MAX_ASSET_BYTES, fetchUpstream, readCapped } from "@/lib/clip/fetch";
import { rewriteStylesheet } from "@/lib/clip/rewrite";
import { normalizeUrl } from "@/lib/net/url_safety";

export const runtime = "nodejs";
export const maxDuration = 30;

// Content types the picker frame is allowed to load. Anything else — HTML in
// particular — would let this route be used as an open redirect-ish fetcher, so
// it's refused rather than passed through.
const ALLOWED = [
  "text/css",
  "image/",
  "font/",
  "application/font",
  "application/x-font",
  "video/",
  "audio/",
];

function isAllowed(type) {
  const t = (type || "").toLowerCase();
  if (!t) return true; // servers that omit it are usually serving fonts
  return ALLOWED.some((prefix) => t.startsWith(prefix));
}

// GET /api/clip/asset?url=…
//
// Subresource proxy for the picker frame. A page served from our origin can't
// resolve the target site's relative paths, so lib/clip/rewrite.js points every
// asset URL here. Stylesheets get rewritten on the way through so their own
// url() and @import references keep working; everything else streams verbatim.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = normalizeUrl(searchParams.get("url"));

  if (!target) return new NextResponse(null, { status: 400 });

  let res;
  try {
    // Some CDNs 403 an assetless referer; send the asset's own origin.
    res = await fetchUpstream(target.toString(), { referer: target.origin });
  } catch {
    return new NextResponse(null, { status: 504 });
  }

  if (!res.ok) return new NextResponse(null, { status: res.status });

  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!isAllowed(type)) return new NextResponse(null, { status: 415 });

  const buf = await readCapped(res, MAX_ASSET_BYTES);
  if (!buf) return new NextResponse(null, { status: 413 });

  const finalUrl = res.url || target.toString();
  const headers = {
    "content-type": type || "application/octet-stream",
    "cache-control": "private, max-age=300",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  };

  if (type === "text/css") {
    const css = rewriteStylesheet(new TextDecoder("utf-8").decode(buf), finalUrl);
    return new NextResponse(css, { status: 200, headers });
  }

  return new NextResponse(buf, { status: 200, headers });
}
