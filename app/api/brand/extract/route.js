import { NextResponse } from "next/server";

import { extractBrand } from "@/lib/brand/extract";
import { classifyPalette } from "@/lib/brand/to-theme";

// Node runtime: extraction base64-encodes fetched images with Buffer.
export const runtime = "nodejs";

// GET /api/brand/extract?url=acme.com
// Reads a public website and returns its brand signals — logo candidates (as data
// URLs), a ranked palette with roles pre-assigned, fonts, radius, and button
// style. Extraction failures come back as a typed `error`, never a throw, so the
// import dialog can show the right message and keep the URL for a retry.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  const result = await extractBrand(target);
  if (result.error) {
    const status = result.error.code === "bad_url" ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  // A site we could read but got nothing usable from — say so rather than
  // handing back a blank theme the user would have to undo.
  const hasColors = result.palette.length > 0 || !!result.themeColor;
  const hasFonts = !!(result.fonts.heading || result.fonts.body);
  if (!result.logos.length && !hasColors && !hasFonts) {
    return NextResponse.json(
      {
        error: {
          code: "empty",
          message:
            "Couldn't find any branding on that page. Sites that render with JavaScript often hide it from a plain fetch.",
        },
      },
      { status: 422 },
    );
  }

  // Pre-assign roles server-side so the dialog can render swatches immediately.
  const colors = hasColors ? classifyPalette(result) : null;

  return NextResponse.json({
    ...result,
    colors: colors?.colors || null,
    base: colors?.base || null,
    found: {
      logo: result.logos.length > 0,
      colors: hasColors,
      fonts: hasFonts,
      shape: !!(
        result.radius ||
        result.button ||
        result.elevation ||
        Number.isFinite(result.borderWidth)
      ),
      layout: !!(result.width || result.density || result.pageGradient),
      header: !!(result.nav?.length || result.cta),
      footer: !!(
        result.footer?.links?.length ||
        result.footer?.socials?.length ||
        result.footer?.text
      ),
      content: !!(result.tagline || result.heroImage || result.favicon),
      background: !!(result.background || result.heroImage),
    },
  });
}
