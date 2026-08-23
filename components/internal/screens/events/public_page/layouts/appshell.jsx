"use client";

import { useMemo } from "react";
import { Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatDate } from "../../sample_data";
import { venueLine } from "../hero";
import {
  Anchored,
  blockAnchor,
  blockLabel,
  navBlocks,
  priceLabel,
  useScrollSpy,
} from "./shared";

// App shell — a fixed brand rail down the left carrying the logo, the section
// nav and the buy button, with the content filling everything to the right of
// it. Borrowed from product UI: the important controls never leave the screen,
// which suits a page someone will scroll for a while.
export function AppShellLayout({ ctx }) {
  const {
    event,
    sectionGapStyle,
    themed,
    brandBar,
    heroRegion,
    blocks,
    sidebarNodes,
    disclaimerSlot,
    cta,
  } = ctx;

  const nav = useMemo(() => navBlocks(blocks), [blocks]);
  const ids = useMemo(() => ["sec-top", ...nav.map(blockAnchor)], [nav]);
  const active = useScrollSpy(ids);

  const link = (href, label, id) => (
    <a
      key={href}
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm transition-colors",
        active === id
          ? "bg-surface-active font-medium text-foreground"
          : "text-text-secondary hover:bg-surface-active hover:text-foreground",
      )}
    >
      {label}
    </a>
  );

  return (
    <div className="relative z-10 lg:flex">
      <aside className="border-b border-border px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5">
        {brandBar}

        <div className="space-y-1 pb-6">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {event.name}
          </p>
          <p className="text-xs text-text-secondary">
            {formatDate(event.date)} · {event.time}
          </p>
          <p className="text-xs text-text-tertiary">{venueLine(event)}</p>
        </div>

        <Button
          style={cta.soldOut ? undefined : cta.primaryBtnStyle}
          disabled={cta.soldOut}
          className={cn(
            "w-full disabled:opacity-60",
            cta.soldOut || !cta.ctaHover ? "hover:opacity-90" : cta.ctaHover,
          )}
          onClick={() => cta.onCheckout(null)}
        >
          <Ticket className="h-4 w-4" />
          {cta.soldOut ? "Sold out" : "Get tickets"}
        </Button>
        <p className="mt-2 text-center text-xs text-text-secondary">
          {priceLabel(cta.tickets)}
        </p>

        <nav className="mt-6 hidden border-t border-border pt-4 lg:block">
          {link("#sec-top", "Overview", "sec-top")}
          {nav.map((b) => link(`#${blockAnchor(b)}`, blockLabel(b), blockAnchor(b)))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-6 py-10 lg:px-12 lg:py-12">
        {disclaimerSlot("top", "mb-8")}
        <div
          className={cn(
            "mx-auto min-w-0 max-w-4xl",
            themed ? "flex flex-col" : "space-y-10",
          )}
          style={sectionGapStyle}
        >
          <section id="sec-top" className="scroll-mt-6">
            {heroRegion}
          </section>
          {disclaimerSlot("hero")}
          {blocks.map((b) => (
            <Anchored key={b.id} block={b}>
              {b.node}
            </Anchored>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            {sidebarNodes.map((b) => (
              <div key={b.id} className="min-w-0">
                {b.node}
              </div>
            ))}
          </div>
          {disclaimerSlot("content")}
        </div>
      </div>
    </div>
  );
}
