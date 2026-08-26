"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  Shell,
  Anchored,
  blockAnchor,
  blockLabel,
  navBlocks,
  useScrollSpy,
} from "./shared";

export function AnchoredLayout({ ctx }) {
  const {
    contentWidth,
    sectionGapStyle,
    themed,
    brandBar,
    heroRegion,
    blocks,
    sidebarNodes,
    disclaimerSlot,
  } = ctx;

  const nav = useMemo(() => navBlocks(blocks), [blocks]);
  const ids = useMemo(() => ["sec-top", ...nav.map(blockAnchor)], [nav]);
  const active = useScrollSpy(ids);

  return (
    <Shell width="90rem" className="relative z-10 py-12">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}

      <div className="grid gap-10 pt-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_340px] xl:gap-12">
        <nav className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            On this page
          </p>
          <ul className="space-y-1 border-l border-border">
            <li>
              <a
                href="#sec-top"
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors",
                  active === "sec-top"
                    ? "border-current font-medium text-foreground"
                    : "border-transparent text-text-secondary hover:text-foreground",
                )}
              >
                Overview
              </a>
            </li>
            {nav.map((b) => (
              <li key={b.id}>
                <a
                  href={`#${blockAnchor(b)}`}
                  className={cn(
                    "-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors",
                    active === blockAnchor(b)
                      ? "border-current font-medium text-foreground"
                      : "border-transparent text-text-secondary hover:text-foreground",
                  )}
                >
                  {blockLabel(b)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
          style={sectionGapStyle}
        >
          <section id="sec-top" className="scroll-mt-24">
            {heroRegion}
          </section>
          {disclaimerSlot("hero")}
          {blocks.map((b) => (
            <Anchored key={b.id} block={b}>
              {b.node}
            </Anchored>
          ))}
          {disclaimerSlot("content")}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {sidebarNodes.map((b) => b.node)}
        </div>
      </div>
    </Shell>
  );
}
