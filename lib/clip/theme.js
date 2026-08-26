
const NEUTRAL_CHROMA = 32;

function parseColor(value) {
  const v = String(value || "").trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/.exec(v);
  if (rgb) {
    const alpha = rgb[4];
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha),
    };
  }

  const hsl = /^hsla?\(\s*[\d.]+(?:deg)?[\s,]+([\d.]+)%/.exec(v);
  if (hsl) return { hslSaturation: Number(hsl[1]) };

  if (v === "black" || v === "white" || v === "transparent") {
    return { r: 0, g: 0, b: 0, a: v === "transparent" ? 0 : 1, named: true };
  }
  return null;
}

export function isNeutralColor(value) {
  const c = parseColor(value);
  if (!c) return false;
  if (c.hslSaturation !== undefined) return c.hslSaturation <= 12;
  if (c.named) return true;
  if (c.a !== undefined && c.a < 0.06) return true;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max - min <= NEUTRAL_CHROMA;
}

const COLOR_DECL = /(^|[;{\s])color\s*:\s*([^;}!]+)(!important)?/gi;
const BG_DECL = /(^|[;{\s])background(-color)?\s*:\s*([^;}!]+)(!important)?/gi;

export function themeAdaptCss(css, scope) {
  let out = String(css || "");

  out = out.replace(COLOR_DECL, (match, lead, value, bang) =>
    isNeutralColor(value) ? `${lead}color: inherit${bang || ""}` : match,
  );

  out = out.replace(BG_DECL, (match, lead, sub, value, bang) => {
    if (/\b(gradient|url)\s*\(/i.test(value)) return match;
    return isNeutralColor(value) ? `${lead}background-color: transparent${bang || ""}` : match;
  });

  out = out.replace(
    /(^|[;{\s])border(-(top|right|bottom|left))?-color\s*:\s*([^;}!]+)(!important)?/gi,
    (match, lead, _sub, _side, value, bang) =>
      isNeutralColor(value)
        ? `${lead}border${_sub || ""}-color: color-mix(in srgb, currentColor 22%, transparent)${bang || ""}`
        : match,
  );

  if (scope) {
    out += `\n.${scope} img, .${scope} svg, .${scope} picture { background-color: transparent; }`;
  }

  return out;
}
