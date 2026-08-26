"use client";

import React, { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "../sample_data";
import { usePageTheme } from "../public_page/use_page_theme";
import { InclusionIcon, formatPackagePrice } from "../packages_shared";
import {
  normalizePackages,
  normalizePackagesPage,
  packageSoldOut,
  sellablePackages,
} from "@/lib/events/packages";
import { ctaHref } from "@/lib/events/ctas";
import { PackagesLeadForm } from "./lead_form";

const GRID_ID = "packages";

function PackageCard({ pkg, primaryBtnStyle, ctaHover, onBuy, onEnquire }) {
  const [open, setOpen] = useState(false);
  const soldOut = packageSoldOut(pkg);
  const inclusions = pkg.inclusions.filter((i) => i.text.trim());
  const details = String(pkg.details || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      {pkg.image ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-surface-card">
          <img
            src={pkg.image}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="border-b border-border px-4 py-4 text-center">
        <h3 className="text-base font-semibold uppercase tracking-wide text-foreground">
          {pkg.name}
        </h3>
        {pkg.tagline ? (
          <p className="mt-0.5 text-sm italic text-text-secondary">
            {pkg.tagline}
          </p>
        ) : null}
      </div>

      {inclusions.length ? (
        <ul className="flex-1 space-y-2.5 px-4 py-4">
          {inclusions.map((inc) => (
            <li key={inc.id} className="flex items-start gap-2.5">
              <InclusionIcon
                icon={inc.icon}
                className="mt-0.5 text-text-tertiary"
              />
              <span className="text-sm leading-snug text-text-secondary">
                {inc.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1" />
      )}

      {details.length ? (
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:text-foreground"
          >
            More details
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
          {open ? (
            <div className="space-y-2 px-4 pb-4">
              {details.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-text-secondary">
                  {p}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-border px-4 py-4 text-center">
        <div>
          <p className="text-xs text-text-secondary">Starting at</p>
          <p className="text-xl font-bold text-foreground">
            {formatPackagePrice(pkg)}
          </p>
        </div>
        <Button
          disabled={soldOut}
          style={soldOut ? undefined : primaryBtnStyle}
          className={cn(
            "w-full disabled:opacity-60",
            soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
          )}
          onClick={() => (pkg.mode === "enquire" ? onEnquire(pkg) : onBuy(pkg))}
        >
          {soldOut
            ? "Sold out"
            : pkg.ctaLabel ||
              (pkg.mode === "enquire" ? "Enquire" : "Buy package")}
        </Button>
      </div>
    </div>
  );
}

export function PackagesPublicPage({ event, live = false, onBuy }) {
  const page = normalizePackagesPage(event?.packagesPage);
  const { intro } = normalizePackages(event?.packages);
  const packages = sellablePackages(event);
  const [enquiryFor, setEnquiryFor] = useState(null);

  const {
    themed,
    fontClass,
    wrapperStyle,
    contentWidth,
    coverClass,
    coverStyle,
    primaryBtnStyle,
    ctaHover,
  } = usePageTheme({ design: event?.packagesDesign, live });

  const introLink = ctaHref(page.introLinkUrl);
  const scrollToGrid = () => {
    document.getElementById(GRID_ID)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={cn("min-h-[100dvh] bg-background text-foreground", fontClass)}
      style={wrapperStyle}
    >
      <div
        className={cn("relative w-full", coverClass)}
        style={
          event?.coverUrl
            ? {
                backgroundImage: `url(${event.coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : coverStyle
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
        <div
          className="relative mx-auto flex min-h-[18rem] flex-col justify-end px-6 py-10"
          style={{ maxWidth: contentWidth }}
        >
          <h1 className="text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            {page.title || event?.name || "Packages"}
          </h1>
          {page.subtitle ? (
            <p className="mt-2 text-sm text-white/85">{page.subtitle}</p>
          ) : null}
          {event?.date ? (
            <p className="mt-1 text-sm text-white/70">{formatDate(event.date)}</p>
          ) : null}
        </div>
      </div>

      {page.introHeading || page.introBody || intro ? (
        <div
          className="mx-auto px-6 py-12 text-center"
          style={{ maxWidth: contentWidth }}
        >
          {page.introHeading ? (
            <h2 className="mb-3 text-xl font-semibold text-foreground">
              {page.introHeading}
            </h2>
          ) : null}
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-text-secondary">
            {page.introBody || intro}
          </p>
          {introLink && page.introLinkLabel ? (
            <a
              href={introLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm underline"
              style={{ color: primaryBtnStyle?.backgroundColor }}
            >
              {page.introLinkLabel}
            </a>
          ) : null}
        </div>
      ) : null}

      <div id={GRID_ID} className={cn("py-12", themed ? "" : "bg-surface-subtle/40")}>
        <div className="mx-auto px-6" style={{ maxWidth: contentWidth }}>
          {page.gridHeading ? (
            <h2 className="mb-8 text-center text-lg font-semibold uppercase tracking-wide text-foreground">
              {page.gridHeading}
            </h2>
          ) : null}

          {packages.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  primaryBtnStyle={primaryBtnStyle}
                  ctaHover={ctaHover}
                  onBuy={onBuy}
                  onEnquire={setEnquiryFor}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-text-secondary">
              Packages for this event aren&apos;t on sale yet.
            </p>
          )}
        </div>
      </div>

      {page.pitchEnabled && (page.pitchHeading || page.pitchBody) ? (
        <div className="mx-auto px-6 py-14" style={{ maxWidth: contentWidth }}>
          <div className="grid items-center gap-8 lg:grid-cols-2">
            {page.pitchImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.pitchImage}
                alt=""
                className="w-full rounded-2xl border border-border object-cover"
              />
            ) : null}
            <div className={cn(!page.pitchImage && "lg:col-span-2 text-center")}>
              {page.pitchHeading ? (
                <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground">
                  {page.pitchHeading}
                </h2>
              ) : null}
              {page.pitchBody ? (
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {page.pitchBody}
                </p>
              ) : null}
              {page.pitchCtaLabel ? (
                <Button
                  variant="outline"
                  onClick={scrollToGrid}
                  className="mt-5 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  {page.pitchCtaLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {page.leadsEnabled ? (
        <div
          className="mx-auto px-6 pb-16"
          style={{ maxWidth: contentWidth }}
          id="enquire"
        >
          <PackagesLeadForm
            event={event}
            page={page}
            packages={packages}
            selected={enquiryFor}
            onSelected={setEnquiryFor}
            primaryBtnStyle={primaryBtnStyle}
            live={live}
          />
        </div>
      ) : null}
    </div>
  );
}

export default PackagesPublicPage;
