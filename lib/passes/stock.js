
export const MM_PER_IN = 25.4;

export const dotsPerMm = (dpi) => dpi / MM_PER_IN;

export const STOCK_PRESETS = [
  {
    value: "name-badge",
    label: "Name badge",
    desc: "3.5 × 2.25 in — clip or adhesive.",
    wMm: 88.9,
    hMm: 57.15,
  },
  {
    value: "lanyard-portrait",
    label: "Lanyard (portrait)",
    desc: "3.375 × 5.375 in — the conference standard.",
    wMm: 85.73,
    hMm: 136.53,
  },
  {
    value: "cr80",
    label: "Card (CR80)",
    desc: "85.6 × 54 mm — credit-card size.",
    wMm: 85.6,
    hMm: 54,
  },
  { value: "a7", label: "A7", desc: "74 × 105 mm — compact portrait.", wMm: 74, hMm: 105 },
  { value: "a6", label: "A6", desc: "105 × 148 mm — large portrait.", wMm: 105, hMm: 148 },
  { value: "custom", label: "Custom", desc: "Set the millimetres yourself.", wMm: 90, hMm: 60 },
];

export const PAGE_PRESETS = [
  { value: "a4", label: "A4", wMm: 210, hMm: 297 },
  { value: "letter", label: "US Letter", wMm: 215.9, hMm: 279.4 },
];

export const QR_POSITION_OPTIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "right", label: "Right side" },
];

const clampMm = (n, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(500, Math.max(20, v));
};

export function stockSize(stock) {
  const preset = STOCK_PRESETS.find((p) => p.value === stock?.preset);
  if (preset && preset.value !== "custom") return { wMm: preset.wMm, hMm: preset.hMm };
  return { wMm: clampMm(stock?.wMm, 90), hMm: clampMm(stock?.hMm, 60) };
}

export function pageSize(page) {
  const found = PAGE_PRESETS.find((p) => p.value === page);
  return found ? { wMm: found.wMm, hMm: found.hMm } : { wMm: 210, hMm: 297 };
}

export function sheetGrid(sheet, stock) {
  const page = pageSize(sheet?.page);
  const { wMm, hMm } = stockSize(stock);
  const margin = Math.max(0, Number(sheet?.marginMm) || 0);
  const gutter = Math.max(0, Number(sheet?.gutterMm) || 0);
  const usableW = page.wMm - margin * 2;
  const usableH = page.hMm - margin * 2;
  const cols = Math.max(1, Math.floor((usableW + gutter) / (wMm + gutter)));
  const rows = Math.max(1, Math.floor((usableH + gutter) / (hMm + gutter)));
  return { cols, rows, perPage: cols * rows, page, wMm, hMm, margin, gutter };
}
