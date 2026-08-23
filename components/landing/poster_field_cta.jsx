"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { EVENT_POSTERS } from "./event_posters";

// Closing call to action, set against a scattered field of coded event posters.
// The scatter is hand-authored rather than randomised so SSR and the client
// agree, and so the middle of the band stays clear for the copy.
//
// `d` is the depth layer: 1 is furthest (small, blurred, faint), 3 is nearest.
// `m` keeps the card on mobile, where only the top and bottom bands have room.
const POSITIONS = [
  // Left flank
  { x: 8, y: 12, d: 2, r: -7, m: true },
  { x: 19, y: 27, d: 3, r: 5, m: false },
  { x: 4, y: 45, d: 1, r: 9, m: false },
  { x: 14, y: 63, d: 3, r: -4, m: false },
  { x: 24, y: 82, d: 2, r: 7, m: true },
  { x: 4, y: 89, d: 1, r: -6, m: false },
  // Right flank
  { x: 92, y: 14, d: 2, r: 6, m: true },
  { x: 80, y: 29, d: 3, r: -5, m: false },
  { x: 96, y: 47, d: 1, r: -9, m: false },
  { x: 86, y: 64, d: 3, r: 4, m: false },
  { x: 75, y: 84, d: 2, r: -7, m: true },
  { x: 96, y: 90, d: 1, r: 5, m: false },
  // Top band — free to cross the centre column, the copy starts below it
  { x: 38, y: 6, d: 1, r: 4, m: true },
  { x: 55, y: 4, d: 2, r: -6, m: true },
  { x: 68, y: 10, d: 1, r: 8, m: false },
  // Bottom band
  { x: 40, y: 94, d: 2, r: -5, m: true },
  { x: 58, y: 96, d: 1, r: 7, m: false },
  { x: 66, y: 90, d: 1, r: -3, m: false },
];

// Per-layer size, parallax travel, and atmosphere. Far cards move least and sit
// furthest back, which is what sells the depth.
const LAYERS = {
  1: {
    width: "clamp(4.5rem, 7vw, 7rem)",
    travel: 4,
    className: "opacity-40 blur-[1.5px]",
  },
  2: {
    width: "clamp(5.5rem, 9vw, 9.5rem)",
    travel: 10,
    className: "opacity-70 blur-[0.4px]",
  },
  3: {
    width: "clamp(6.5rem, 11vw, 12rem)",
    travel: 18,
    className: "opacity-100",
  },
};

// The physical-card treatment from the reference: a light outer ring holding a
// rounded inner tile, so a flat gradient reads as an object on the dark page.
function PosterCard({ children }) {
  return (
    <div className="rounded-[14%] bg-white/[0.07] p-[3.5%] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.08]">
      {/* Poster type is authored in % of the card, so one set of designs holds
          its proportions at every layer size. The container query turns the
          card's own width into that reference. */}
      <div className="aspect-square overflow-hidden rounded-[11%] [container-type:inline-size]">
        <div className="h-full w-full" style={{ fontSize: "100cqw" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function PosterFieldCta({ dashboardHref = "/org" }) {
  const fieldRef = useRef(null);

  // Cursor parallax. One listener writes two custom properties on the section
  // and the layers consume them in CSS, so moving the mouse never re-renders.
  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    if (!window.matchMedia?.("(pointer: fine)").matches) return undefined;

    let frame = 0;
    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height) return;
        node.style.setProperty(
          "--px",
          String(((e.clientX - box.left) / box.width - 0.5) * 2),
        );
        node.style.setProperty(
          "--py",
          String(((e.clientY - box.top) / box.height - 0.5) * 2),
        );
      });
    };
    const onLeave = () => {
      node.style.setProperty("--px", "0");
      node.style.setProperty("--py", "0");
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      ref={fieldRef}
      className="relative isolate overflow-hidden px-4 py-28 sm:px-6 sm:py-36"
      style={{ "--px": "0", "--py": "0" }}
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        {POSITIONS.map((pos, i) => {
          const layer = LAYERS[pos.d];
          const { Art, key } = EVENT_POSTERS[i % EVENT_POSTERS.length];
          return (
            <div
              key={key}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                !pos.m && "hidden sm:block",
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: layer.width }}
            >
              <div
                className={layer.className}
                style={{
                  transform: `translate3d(calc(var(--px) * ${layer.travel}px), calc(var(--py) * ${layer.travel}px), 0)`,
                  transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div
                  className="ev-poster-drift"
                  style={{
                    rotate: `${pos.r}deg`,
                    animationDelay: `${(i % 7) * -1.9}s`,
                    animationDuration: `${16 + (i % 5) * 3}s`,
                  }}
                >
                  <PosterCard>
                    <Art />
                  </PosterCard>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Holds the headline's contrast whatever poster lands behind it. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_46%_54%_at_50%_50%,#080808_38%,#080808cc_58%,transparent_78%)]"
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Every kind of event
          <span className="mt-1 block bg-gradient-to-r from-[#ee6b3b] via-[#f0913b] to-[#ffd166] bg-clip-text text-transparent">
            starts here
          </span>
        </h2>
        <p className="mt-6 max-w-lg text-balance text-sm text-muted-foreground sm:text-base">
          From run clubs to launch parties and conference floors, Geiger makes
          every event feel effortless.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href={dashboardHref}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-zinc-100 px-7 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Create your first event
          </Link>
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Discover events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PosterFieldCta;
