import { NextResponse } from "next/server";

import { extractBrand } from "@/lib/brand/extract";
import { classifyPalette } from "@/lib/brand/to-theme";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  const result = await extractBrand(target);
  if (result.error) {
    const status = result.error.code === "bad_url" ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

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
      header: !!(
        result.nav?.length ||
        result.cta ||
        result.headerStyle?.background ||
        result.headerStyle?.sticky
      ),
      footer: !!(
        result.footer?.links?.length ||
        result.footer?.socials?.length ||
        result.footer?.text ||
        result.footerStyle?.background
      ),
      content: !!(result.tagline || result.heroImage || result.favicon),
      background: !!(result.background || result.heroImage),
    },
  });
}
