"use client";

import * as echarts from "echarts/core";

// Shared categorical palette across all twelve analytics screens.
// Grayscale-first (matches Overview) with cool accents for secondary series.
export const PALETTE = [
  "#ffffff",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
  "#94a3b8",
  "#737373",
];

export const INK = {
  text: "#e7e7e7",
  muted: "#a3a3a3",
  faint: "#737373",
  grid: "#262626",
  border: "#333333",
  card: "#1a1a1a",
  track: "#242424",
};

// The chart options above are authored for dark mode; in light mode every
// colour is swapped through this map (write "white" for text that must stay white).
const LIGHT_SWAP = {
  "#ffffff": "#18181b",
  "#fff": "#18181b",
  "#e7e7e7": "#3f3f46",
  "#a3a3a3": "#71717a",
  "#525252": "#a1a1aa",
  "#474747": "#a1a1aa",
  "#3f3f3f": "#d4d4d8",
  "#333333": "#d4d4d8",
  "#333": "#d4d4d8",
  "#2e2e2e": "#e4e4e7",
  "#2a2a2a": "#f4f4f5",
  "#262626": "#e4e4e7",
  "#242424": "#f4f4f5",
  "#202020": "#ffffff",
  "#1a1a1a": "#ffffff",
  "#161616": "#ffffff",
};

function swapColor(value) {
  if (typeof value !== "string") return value;
  const key = value.toLowerCase();
  if (LIGHT_SWAP[key]) return LIGHT_SWAP[key];
  return value.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/g, "rgba(24,24,27,");
}

export function themeOption(option, mode) {
  if (mode !== "light") return option;
  const walk = (node, key) => {
    if (typeof node === "string") return swapColor(node);
    if (typeof node === "function") {
      return key === "color" ? (...args) => walk(node(...args)) : node;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, key));
    if (node instanceof echarts.graphic.LinearGradient) {
      return new echarts.graphic.LinearGradient(
        node.x,
        node.y,
        node.x2,
        node.y2,
        node.colorStops.map((stop) => ({ ...stop, color: swapColor(stop.color) })),
        node.global,
      );
    }
    if (node && Object.getPrototypeOf(node) === Object.prototype) {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, k);
      return out;
    }
    return node;
  };
  return walk(option);
}

export function areaGradient(hex, fromAlpha = 0.32, toAlpha = 0.02) {
  const normalized = String(hex || "#ffffff");
  const toRgba = (h, a) => {
    const v = h.replace("#", "");
    if (v.length !== 6) return h;
    const n = parseInt(v, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: toRgba(normalized, fromAlpha) },
    { offset: 1, color: toRgba(normalized, toAlpha) },
  ]);
}

export function barGradient(hex) {
  const toRgba = (h, a) => {
    const v = String(h).replace("#", "");
    if (v.length !== 6) return h;
    const n = parseInt(v, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: toRgba(hex, 1) },
    { offset: 1, color: toRgba(hex, 0.55) },
  ]);
}

export const baseTooltip = (extra = {}) => ({
  trigger: "axis",
  backgroundColor: "#202020",
  borderColor: "#333333",
  borderWidth: 1,
  padding: [10, 14],
  textStyle: { color: "#e7e7e7", fontSize: 12 },
  axisPointer: {
    type: "line",
    lineStyle: { color: "#525252", type: "dashed" },
    crossStyle: { color: "#525252" },
  },
  ...extra,
});

export const itemTooltip = {
  trigger: "item",
  backgroundColor: "#202020",
  borderColor: "#333333",
  borderWidth: 1,
  padding: [10, 14],
  textStyle: { color: "#e7e7e7", fontSize: 12 },
};

export const baseGrid = (extra = {}) => ({
  left: 8,
  right: 12,
  top: 36,
  bottom: 0,
  containLabel: true,
  ...extra,
});

export const axisCommon = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: "#737373", fontSize: 11 },
  splitLine: { lineStyle: { color: "#262626", type: "dashed" } },
};

export function categoryAxis(data, extra = {}) {
  return {
    type: "category",
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#737373", fontSize: 11, interval: 0 },
    ...extra,
  };
}

export function valueAxis(extra = {}) {
  return {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#737373", fontSize: 11 },
    splitLine: { lineStyle: { color: "#242424", type: "dashed" } },
    ...extra,
  };
}

export const baseLegend = {
  bottom: 0,
  icon: "roundRect",
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
  textStyle: { color: "#a3a3a3", fontSize: 11 },
};

// ---- Motion: load + actionable animation presets ----
// ECharts animates on mount by default, but the defaults are instant-ish and
// per-chart inconsistent. These presets give every analytics chart the same
// premium enter motion (clip-in lines, staggered bars, scale-in pies) plus
// smooth animated transitions on filter / live updates.
export const motion = {
  duration: 950,
  updateDuration: 550,
  easing: "cubicOut",
  updateEasing: "cubicOut",
};

export const enterAnimation = {
  animation: true,
  animationThreshold: 2000,
  animationDuration: 950,
  animationEasing: "cubicOut",
  animationDelay: 0,
  animationDurationUpdate: 550,
  animationEasingUpdate: "cubicOut",
};

// Staggered bar/line-point entrance: idx => ms, capped so large sets stay snappy.
export const staggerDelay = (step = 45, max = 600) => (idx) =>
  Math.min(idx * step, max);

export function withEnter(option = {}) {
  return { ...enterAnimation, ...option };
}

// Shared emphasis recipes — hover/tap feedback per chart family.
export const emphasisLine = { focus: "series", blurScope: "coordinateSystem" };
export const emphasisBar = {
  focus: "series",
  blurScope: "coordinateSystem",
  scale: true,
  scaleSize: 2,
};
export const emphasisPie = { focus: "self", scale: true, scaleSize: 6 };

export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
