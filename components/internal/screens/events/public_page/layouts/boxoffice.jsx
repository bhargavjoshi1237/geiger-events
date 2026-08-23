"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CoverImage } from "../hero";
import { Shell, EventMetaLine, MetaRows } from "./shared";

function TierCard({ ticket, index, ctx }) {
  const { cta } = ctx;
  const active = cta.selected === index;
  const free = Number(ticket.price) === 0;

  return (
    <div
      style={active ? { borderColor: ctx.accent.color } : undefined}
      className={cn(
        "flex flex-col rounded-2xl border p-5",
        active ? "bg-surface-card" : "border-border bg-surface-subtle",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{ticket.name}</p>
      <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">
        {free ? "Free" : `$${ticket.price}`}
      </p>
      {ticket.note ? (
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {ticket.note}
        </p>
      ) : null}
      <Button
        style={cta.soldOut ? undefined : cta.primaryBtnStyle}
        disabled={cta.soldOut}
        className={cn(
          "mt-auto w-full disabled:opacity-60",
          cta.soldOut || !cta.ctaHover ? "hover:opacity-90" : cta.ctaHover,
        )}
        onClick={() => {
          cta.setSelected(index);
          cta.onCheckout(null);
        }}
      >
        {cta.soldOut ? (
          "Sold out"
        ) : active ? (
          <>
            <Check className="h-4 w-4" /> {free ? "Register" : "Continue"}
          </>
        ) : (
          <>{free ? "Register" : "Choose"}</>
        )}
      </Button>
    </div>
  );
}

// Box office — the tiers are laid out side by side to be compared at a glance,
// the way a venue's ticket window or a pricing page presents them, rather than
// stacked in a rail. The full panel stays underneath so access codes and the
// seating plan still have a home.
export function BoxOfficeLayout({ ctx }) {
  const {
    event,
    contentWidth,
    sectionGapStyle,
    themed,
    brandBar,
    blocks,
    register,
    sidebarRest,
    disclaimerSlot,
    meta,
    cta,
    parts,
    coverClass,
    coverStyle,
  } = ctx;

  const tiers = cta.tickets || [];
  const cols =
    tiers.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : tiers.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className="relative z-10">
      <Shell width={contentWidth} className="pt-8">
        {disclaimerSlot("top", "mb-8")}
        {brandBar}
      </Shell>

      <Shell width={contentWidth} className="py-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-tertiary">
              {meta.tags.join(" · ")}
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {event.name}
            </h1>
            {themed && ctx.theme.tagline ? (
              <p className="max-w-xl text-lg text-text-secondary">
                {ctx.theme.tagline}
              </p>
            ) : null}
            <EventMetaLine event={event} />
          </div>
          {event.coverUrl ? (
            <div
              className={cn(
                "aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border",
                coverClass,
              )}
              style={coverStyle}
            >
              <CoverImage event={event} />
            </div>
          ) : null}
        </div>
      </Shell>

      <section className="border-y border-border bg-surface-subtle/40 py-12">
        <Shell width={contentWidth}>
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            {cta.soldOut ? "Tickets" : "Choose your ticket"}
          </h2>
          <div className={cn("grid gap-4", cols)}>
            {tiers.map((t, i) => (
              <TierCard key={t.id || t.name} ticket={t} index={i} ctx={ctx} />
            ))}
          </div>
          {cta.showRemaining && Number.isFinite(cta.remaining) ? (
            <p className="mt-5 text-center text-sm text-text-secondary">
              {cta.soldOut
                ? "Sold out"
                : `${cta.remaining.toLocaleString("en-US")} tickets remaining`}
            </p>
          ) : null}
        </Shell>
      </section>

      <Shell width={contentWidth} className="py-12">
        {disclaimerSlot("hero", "mb-10")}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div
            className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
            style={sectionGapStyle}
          >
            {parts.hostsBlock}
            {parts.gallery}
            {blocks.map((b) => b.node)}
            {disclaimerSlot("content")}
          </div>
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {register}
            {sidebarRest.map((b) => b.node)}
            <MetaRows ctx={ctx} />
          </div>
        </div>
      </Shell>
    </div>
  );
}
