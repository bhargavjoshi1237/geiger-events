"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  RadarChart,
  TreemapChart,
  GaugeChart,
  FunnelChart,
  SankeyChart,
  HeatmapChart,
  EffectScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  RadarComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  DatasetComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { cn } from "@/lib/utils";
import { enterAnimation } from "./theme";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  RadarChart,
  TreemapChart,
  GaugeChart,
  FunnelChart,
  SankeyChart,
  HeatmapChart,
  EffectScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  RadarComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  DatasetComponent,
  CanvasRenderer,
]);

export function EChart({ option, height = 320, className, onInit, replayKey }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const replayRef = useRef(replayKey);

  const withMotion = (raw) => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      return { ...raw, animation: false, animationDurationUpdate: 0 };
    }
    // Screen options win; wrapper only backfills the shared enter motion.
    return { ...enterAnimation, ...raw };
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, null, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(withMotion(option), { notMerge: true });
    if (onInit) onInit(chart);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => chart.resize())
        : null;
    observer?.observe(host);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // A replayKey change means "re-run the load animation" (e.g. event scope
    // switched) — full replace. Otherwise diff-merge so values morph smoothly.
    if (replayRef.current !== replayKey) {
      replayRef.current = replayKey;
      chart.setOption(withMotion(option), { notMerge: true, lazyUpdate: true });
    } else {
      chart.setOption(withMotion(option), { notMerge: false, lazyUpdate: true });
    }
  }, [option, replayKey]);

  return (
    <div
      ref={hostRef}
      className={cn("w-full", className)}
      style={{ height, minHeight: height }}
      role="img"
    />
  );
}

export default EChart;
