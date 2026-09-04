"use client";

import { useMemo, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { BREAKPOINTS } from "@/lib/events/page_tree";
import { themeAccent, themeStyle } from "@/lib/events/theme";
import { cn } from "@/lib/utils";

import { BuilderCanvas } from "./builder/builder_canvas";
import { useFitZoom } from "./builder/use_fit_zoom";
import { PageTree } from "./page_render";

const DEVICE_ICON = { lg: Monitor, md: Tablet, sm: Smartphone };

export function LayoutPreviewDialog({ open, onOpenChange, layout, event, theme }) {
  const [bp, setBp] = useState("lg");
  const device = BREAKPOINTS.find((b) => b.key === bp) || BREAKPOINTS[0];
  const { attach, fit } = useFitZoom(device.width, 8);

  const accent = useMemo(() => themeAccent(theme), [theme]);
  const style = useMemo(() => themeStyle(theme), [theme]);
  const tree = layout?.tree;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-6xl flex-col gap-4 overflow-hidden">
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{layout?.name || "Layout preview"}</DialogTitle>
              <DialogDescription>
                {layout?.description ||
                  "Your event's own content, arranged the way this layout arranges it."}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5">
              {BREAKPOINTS.map((b) => {
                const Icon = DEVICE_ICON[b.key];
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBp(b.key)}
                    aria-label={b.label}
                    aria-pressed={bp === b.key}
                    title={`${b.label} · ${b.width}px`}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 transition-colors",
                      bp === b.key
                        ? "bg-surface-active text-foreground"
                        : "text-text-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <div
          ref={attach}
          className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-strong"
        >
          {tree ? (
            <BuilderCanvas
              width={device.width}
              zoom={fit}
              className="h-full"
              bodyClassName="ev-themed"
              bodyStyle={style}
            >
              <PageTree
                tree={tree}
                event={event}
                accent={accent}
                runScripts={false}
                brand={{ logo: theme?.logo?.url, siteName: theme?.source?.siteName }}
              />
            </BuilderCanvas>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
              This layout has nothing to show yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LayoutPreviewDialog;
