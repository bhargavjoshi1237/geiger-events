import { NextResponse } from "next/server";

import { MAX_ASSET_BYTES, fetchUpstream, readCapped } from "@/lib/clip/fetch";
import { rewriteStylesheet } from "@/lib/clip/rewrite";
import { normalizeUrl } from "@/lib/net/url_safety";

export const runtime = "nodejs";
export const maxDuration = 30;

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
  return ALLOWED.some((prefix) => t.startsWith(prefix));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = normalizeUrl(searchParams.get("url"));

  if (!target) return new NextResponse(null, { status: 400 });

  let res;
  try {
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
