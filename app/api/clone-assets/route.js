import { NextResponse } from "next/server";

import { extractCloneAssets } from "@/lib/events/clone_assets";

// Node runtime: extraction base64-encodes fetched images with Buffer.
export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/clone-assets?url=https://example.com/page
// Reads a public page and returns its external stylesheet and script URLs, so a
// pasted Raw HTML block can carry along the CSS and JS that style it. Failures
// come back as a typed `error`, never a throw.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  const result = await extractCloneAssets(target);
  if (result.error) {
    const status = result.error.code === "bad_url" ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
