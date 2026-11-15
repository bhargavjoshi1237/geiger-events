"use client";

import { orderedBlocks } from "@/lib/workspace/portal/pages.js";
import { GRID } from "@/lib/workspace/portal/contracts.js";
import { cn } from "@/lib/utils";
import { BlockView } from "./block_view";
import { usePortalView } from "./portal_context";

// Column spans per allowed width; listed in full so Tailwind generates them.
const SPAN = {
  3: "@3xl/page:col-span-3", 4: "@3xl/page:col-span-4", 6: "@3xl/page:col-span-6",
  8: "@3xl/page:col-span-8", 9: "@3xl/page:col-span-9", 12: "@3xl/page:col-span-12",
};

function RowsLayout({ page }) {
  const blocks = page.body?.blocks ?? [];
  return (
    <div className="grid gap-4">
      {(page.body?.rows ?? []).map((row) => (
        <div key={row.id} className="grid grid-cols-1 gap-4 @3xl/page:grid-cols-12">
          {row.widths.map((width, col) => {
            const items = blocks.filter((block) => block.at?.row === row.id && block.at?.col === col).sort((a, b) => a.at.order - b.at.order);
            return (
              <div key={col} className={cn("grid min-w-0 content-start gap-4", SPAN[width], !items.length && "@max-3xl/page:hidden")}>
                {items.map((block) => <BlockView key={block.id} block={block} />)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Free placement on a 12-column grid on wide screens; on narrow screens the blocks stack in reading order.
function CanvasLayout({ page }) {
  const blocks = orderedBlocks(page);
  return (
    <div className="flex flex-col gap-4 @4xl/page:grid @4xl/page:grid-cols-12 @4xl/page:gap-x-4 @4xl/page:gap-y-0"
      style={{ gridAutoRows: `${GRID.rowHeight}px` }}>
      {blocks.map((block) => {
        const g = block.grid ?? { x: 0, y: 0, w: 12, h: 8 };
        return (
          <div key={block.id} className="min-w-0 @4xl/page:min-h-0 @4xl/page:pb-4 @4xl/page:[grid-column:var(--wp-col)] @4xl/page:[grid-row:var(--wp-row)]"
            style={{ "--wp-col": `${g.x + 1} / span ${g.w}`, "--wp-row": `${g.y + 1} / span ${g.h}` }}>
            <BlockView block={block} fill />
          </div>
        );
      })}
    </div>
  );
}

// A page body in its layout. Wrap it in a PortalViewProvider (and FileViewer) first.
export function PageView({ className }) {
  const { page } = usePortalView();
  if (!page) return null;
  return (
    <div className={cn("@container/page min-w-0", className)}>
      {page.layout === "canvas" ? <CanvasLayout page={page} /> : <RowsLayout page={page} />}
    </div>
  );
}
