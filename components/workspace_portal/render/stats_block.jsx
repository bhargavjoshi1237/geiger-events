"use client";

import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading } from "./block_frame";
import { usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";

const COLUMNS = { 1: "", 2: "@md/block:grid-cols-2", 3: "@md/block:grid-cols-3", 4: "@md/block:grid-cols-2 @3xl/block:grid-cols-4" };

function format(tile, field) {
  if (tile.value === null || tile.value === undefined) return "—";
  if (tile.fn === "percent") return `${tile.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  if (tile.fn === "count") return Math.round(tile.value).toLocaleString();
  if (field?.type === "currency") return new Intl.NumberFormat(undefined, { style: "currency", currency: field.config?.currency || "USD" }).format(tile.value);
  if (field?.type === "percent") return `${tile.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return tile.value.toLocaleString(undefined, { maximumFractionDigits: tile.fn === "avg" ? 1 : 2 });
}

const LABELS = { sum: "Total", avg: "Average", min: "Lowest", max: "Highest", percent: "Share" };

// Counts, totals and averages over the records the viewer can see.
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
      <div className="@container/block">
        <div className={cn("grid grid-cols-1 gap-px overflow-hidden bg-border", COLUMNS[Math.min(4, tiles.length)] ?? COLUMNS[4])}>
          {tiles.map((tile, index) => {
            const field = tile.fieldId ? lists[tile.objectId]?.fields.find((item) => item.id === tile.fieldId) : null;
            return (
              <div key={index} className="grid gap-1 bg-surface-card px-4 py-4">
                <p className="truncate text-sm text-text-secondary">{tile.label}</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{format(tile, field)}</p>
                {LABELS[tile.fn] && field ? <p className="truncate text-xs text-text-tertiary">{LABELS[tile.fn]} of {field.name.toLowerCase()}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return <BlockFrame title={config.title} fill={fill} className="overflow-hidden">{body}</BlockFrame>;
}
