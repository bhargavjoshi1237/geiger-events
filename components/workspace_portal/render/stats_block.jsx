"use client";

import { RollingNumber } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading } from "./block_frame";
import { usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";

function format(tile, field) {
  if (tile.value === null || tile.value === undefined) return "—";
  if (tile.fn === "percent") return `${tile.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  if (tile.fn === "count") return Math.round(tile.value).toLocaleString();
  if (field?.type === "currency") return new Intl.NumberFormat(undefined, { style: "currency", currency: field.config?.currency || "USD" }).format(tile.value);
  if (field?.type === "percent") return `${tile.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return tile.value.toLocaleString(undefined, { maximumFractionDigits: tile.fn === "avg" ? 1 : 2 });
}

const LABELS = { sum: "Total", avg: "Average", min: "Lowest", max: "Highest", percent: "Share" };

// Counts, totals and averages over the records the viewer can see, as one divided card, like the dashboard's StatsBar.
export function StatsBlock({ block, fill }) {
  const config = block.config;
  const { lists } = usePortalView();
  const { data, error, loading, reload } = useBlockData(block, {});
  const tiles = data?.tiles ?? [];

  let body;
  if (loading) body = <BlockLoading label="Loading numbers" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else {
    body = (
      <div className="@container/block overflow-hidden rounded-xl border border-border bg-surface-subtle">
        {/* Two per row on narrow blocks, one row when there's room; dividers follow whichever layout is showing. */}
        <div className="grid w-full grid-cols-2 @lg/block:auto-cols-fr @lg/block:grid-flow-col @lg/block:grid-cols-none">
          {tiles.map((tile, index) => {
            const field = tile.fieldId ? lists[tile.objectId]?.fields.find((item) => item.id === tile.fieldId) : null;
            return (
              <div key={index} className={cn("flex min-w-0 flex-col p-4 border-border", index % 2 === 1 && "border-l", index >= 2 && "border-t",
                "@lg/block:border-t-0", index > 0 ? "@lg/block:border-l" : "@lg/block:border-l-0")}>
                <span className="max-w-full truncate text-[11px] font-medium uppercase tracking-wider text-text-secondary">{tile.label}</span>
                <RollingNumber value={format(tile, field)} className="mt-1 text-2xl font-bold leading-none tabular-nums text-foreground dark:text-white" />
                <span className="mt-1.5 max-w-full truncate text-[11px] text-text-tertiary">{LABELS[tile.fn] && field ? `${LABELS[tile.fn]} of ${field.name.toLowerCase()}` : " "}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return <BlockFrame bare title={config.title} fill={fill}>{body}</BlockFrame>;
}
