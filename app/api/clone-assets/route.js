import { NextResponse } from "next/server";

import { extractCloneAssets } from "@/lib/events/clone_assets";

export const runtime = "nodejs";
export const maxDuration = 30;

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
