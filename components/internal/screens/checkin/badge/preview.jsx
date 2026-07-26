"use client";

import React, { useMemo } from "react";

import { passSvg } from "@/lib/passes/render";
import { stockSize } from "@/lib/passes/stock";
import { cn } from "@/lib/utils";

// Live preview of a single pass. Renders the exact SVG that prints and exports,
// scaled to the column width — the mm width/height attributes are presentation
// attributes, so the CSS below overrides them without touching the viewBox.
export function PassPreview({ template, event, attendee, qrSettings, className }) {
  const svg = useMemo(
    () =>
      passSvg(template || {}, {
        event: event || {},
        attendee: attendee || {},
        qrSettings: qrSettings || {},
        logoHref: template?.logoUrl || "",
      }),
    [template, event, attendee, qrSettings],
  );

  const { wMm, hMm } = stockSize(template?.stock);

  return (
    <div className={cn("w-full", className)}>
      <div
        className="mx-auto overflow-hidden rounded-lg shadow-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        style={{ maxWidth: hMm > wMm ? "220px" : "320px" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-3 text-center text-xs text-text-tertiary">
        {wMm} × {hMm} mm
      </p>
    </div>
  );
}

export default PassPreview;
