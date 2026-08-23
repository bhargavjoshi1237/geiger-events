import { NextResponse } from "next/server";

import { MAX_PAGE_BYTES, fetchUpstream, readCapped } from "@/lib/clip/fetch";
import { rewriteDocument } from "@/lib/clip/rewrite";
import { normalizeUrl } from "@/lib/net/url_safety";

// Node runtime: the rewriter works on decoded text buffers.
export const runtime = "nodejs";
// A slow origin plus a large document comfortably outruns the default budget.
export const maxDuration = 30;

// GET /api/clip/page?url=example.com
//
// Serves a remote page from our own origin so the clip picker can iframe it and
// read its DOM. The response is deliberately same-origin and deliberately
// script-free: the picker frame is sandboxed without allow-scripts, and the
// rewriter strips <script> and on* handlers before it ever reaches the browser.
//
// This is an authenticated-user-only surface. It is not a general web proxy —
// it refuses non-HTML responses, caps the body, and blocks private hosts.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = normalizeUrl(searchParams.get("url"));

  if (!target) {
    return NextResponse.json(
      { error: { code: "bad_url", message: "That doesn't look like a public web address." } },
      { status: 400 },
    );
  }

  let res;
  try {
    res = await fetchUpstream(target.toString());
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    return NextResponse.json(
      {
        error: {
          code: timedOut ? "timeout" : "unreachable",
          message: timedOut
            ? "That site took too long to respond."
            : "Couldn't reach that site.",
        },
      },
      { status: 504 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error: {
          code: "http_error",
          message: `That site responded with ${res.status}.`,
        },
      },
      { status: 502 },
    );
  }

  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (type && !type.includes("html")) {
    return NextResponse.json(
      {
        error: {
          code: "not_html",
          message: "That URL isn't a web page — point it at a page you can open in a browser.",
        },
      },
      { status: 415 },
    );
  }

  const buf = await readCapped(res, MAX_PAGE_BYTES);
  if (!buf) {
    return NextResponse.json(
      { error: { code: "too_large", message: "That page is too large to load in the picker." } },
      { status: 413 },
    );
  }

  // Resolve relative paths against the URL we actually landed on, not the one
  // we asked for — a redirect would otherwise break every asset on the page.
  const finalUrl = res.url || target.toString();
  const html = rewriteDocument(new TextDecoder("utf-8").decode(buf), finalUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Our own frame must be able to embed this; nobody else's should.
      "content-security-policy":
        "frame-ancestors 'self'; script-src 'none'; object-src 'none'; form-action 'none'",
      "x-ev-clip-source": finalUrl,
      "cache-control": "private, max-age=60",
      "referrer-policy": "no-referrer",
    },
  });
}
