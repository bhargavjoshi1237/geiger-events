"use client";

import {
  resolveTheme,
  themeStyle,
  themeAccent,
  resolveWidth,
  resolveHero,
  resolveLayout,
  resolveSidebar,
  themeButtonStyle,
  coverOverlayStyle,
  resolveLogo,
  resolveHeader,
  ctaHoverClass,
  themeWebfonts,
  themeFontFaceCss,
} from "@/lib/events/theme";
import { shouldRenderTree } from "@/lib/events/page_migrate";
import { useCustomCode } from "@/lib/events/custom_code";

import { defaultPageDesign, defaultSidebarBlocks, resolveFont } from "../page_design";

export function usePageTheme({ design, live, themeOverride }) {
  const defaults = defaultPageDesign();
  const cfg = design ? { ...defaults, ...design } : defaults;
  const effective = cfg.mode === "standard" ? defaults : cfg;

  useCustomCode(live ? effective.customCode : null, {
    runScripts: live,
    scope: "page",
  });

  const themed = cfg.mode !== "standard";
  const built = effective.mode === "custom" && shouldRenderTree(effective);

  const theme = themeOverride || resolveTheme(effective);
  const accent = themeAccent(theme);
  const fontClass = resolveFont(effective.font).className;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };
  const wrapperStyle = themed ? themeStyle(theme) : undefined;
  const contentWidth = themed ? resolveWidth(theme) : "72rem";

  let coverClass = "bg-gradient-to-br from-surface-active to-surface-subtle";
  let coverStyle;
  if (theme.cover === "solid") {
    coverClass = "";
    coverStyle = { backgroundColor: "var(--surface-dialog)" };
  } else if (theme.cover === "accent") {
    coverClass = "";
    coverStyle = {
      backgroundImage: `linear-gradient(135deg, ${accent.color}33, ${theme.colors.surface})`,
    };
  }

  const orderedBlocks = effective.blocks.filter((b) => b.visible);
  const sidebarBlocks = (
    effective.sidebarBlocks || defaultSidebarBlocks()
  ).filter((b) => b.visible);

  const hero = themed ? resolveHero(theme) : "classic";
  const layout = themed ? resolveLayout(theme) : "classic";
  const sidebarLeft = themed && resolveSidebar(theme) === "left";
  const primaryBtnStyle = themed ? themeButtonStyle(theme, accent) : accentStyle;
  const ctaHover = themed ? ctaHoverClass(theme) : "";
  const sectionGapStyle = themed
    ? { gap: "var(--ev-section-gap, 2.75rem)" }
    : undefined;
  const bannerOverlay =
    coverOverlayStyle(theme, accent) ||
    (hero === "banner"
      ? {
          backgroundImage:
            "linear-gradient(to top, rgb(0 0 0 / 0.6), transparent 70%)",
        }
      : null);

  const barLogo = themed ? resolveLogo(theme, "bar") : null;
  const footerLogo = themed ? resolveLogo(theme, "footer") : null;
  const webfonts = themed ? themeWebfonts(theme) : [];
  const headerCfg = themed ? resolveHeader(theme, !!barLogo) : null;
  const fontFaceCss = themed ? themeFontFaceCss(theme) : "";

  return {
    effective,
    themed,
    built,
    theme,
    accent,
    fontClass,
    wrapperStyle,
    contentWidth,
    coverClass,
    coverStyle,
    orderedBlocks,
    sidebarBlocks,
    hero,
    layout,
    sidebarLeft,
    primaryBtnStyle,
    ctaHover,
    sectionGapStyle,
    bannerOverlay,
    barLogo,
    footerLogo,
    webfonts,
    headerCfg,
    fontFaceCss,
  };
}
