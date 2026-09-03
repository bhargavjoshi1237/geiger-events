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
