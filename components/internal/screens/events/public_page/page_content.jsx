"use client";

import React from "react";

import { PageBlock } from "../page_blocks";
import { PageTree } from "../page_render";
import { PageFooter } from "../page_footer";
import {
  resolveFooterSurface,
  pageBackgroundVideo,
} from "@/lib/events/theme";
import { cn } from "@/lib/utils";

import { typeIconFor } from "./constants";
import { usePageData } from "./use_page_data";
import { usePageTheme } from "./use_page_theme";
import { BrandBar } from "./brand_bar";
import { BannerHero, HeroRegion } from "./hero";
import {
  RegisterCard,
  GoodToKnowCard,
  AtRegistrationCard,
  GuidelinesCard,
} from "./sidebar_cards";
import { VenueDetailsDialog } from "./venue_dialog";
import { TicketCheckout } from "./checkout/ticket_checkout";

export function EventPublicPageContent({
  event,
  design,
  live = false,
  onShare = null,
  themeOverride = null,
}) {
  const data = usePageData({ event, live });
  const page = usePageTheme({ design, live, themeOverride });

  const {
    gatedIds,
    codeInput,
    setCodeInput,
    codeBusy,
    applyAccessCode,
    now,
    wallLogo,
    tickets,
    ticketGroups,
    selected,
    setSelected,
    checkoutOpen,
    setCheckoutOpen,
    soldOverride,
    setSoldOverride,
    resumeResult,
    setResumeResult,
    approvedResume,
    setApprovedResume,
    venueOpen,
    setVenueOpen,
    daConfig,
    guidelines,
  } = data;

  const {
    effective,
    themed,
    built,
    theme,
    accent,
    fontClass,
    wrapperStyle,
    contentWidth,
    coverClass,
    coverStyle,
    orderedBlocks,
    sidebarBlocks,
    hero,
    sidebarLeft,
    primaryBtnStyle,
    ctaHover,
    sectionGapStyle,
    bannerOverlay,
    barLogo,
    footerLogo,
    webfonts,
    headerCfg,
    fontFaceCss,
  } = page;

  // A CSS background-image can't play a video, so a video background renders as
  // a fixed layer under the content (the same overlay scrim a background image
  // would get). Content siblings are raised above it with `relative z-10`.
  const bgVideo = themed ? pageBackgroundVideo(theme) : null;

  const soldCount = soldOverride ?? event.sold;
  const selectedTicket = tickets[selected] || tickets[0] || null;
  const tierSold =
    event.ticketSold && typeof event.ticketSold === "object"
      ? event.ticketSold
      : {};
  const eventRemaining =
    event.capacity > 0 ? Math.max(0, event.capacity - soldCount) : Infinity;
  const tierQty = Number(selectedTicket?.qty) || 0;
  const tierRemaining =
    tierQty > 0
      ? Math.max(0, tierQty - (Number(tierSold[selectedTicket?.id]) || 0))
      : Infinity;
  const remaining = Math.min(eventRemaining, tierRemaining);
  const soldOut = Number.isFinite(remaining) && remaining <= 0;
  const checkoutRemaining = Number.isFinite(remaining) ? remaining : 9999;
  const showRemaining = event.regSettings?.showRemaining !== false;

  const regQuestions = Array.isArray(event.questions)
    ? event.questions.map((q) => q.label).filter(Boolean)
    : [];
  const TypeIcon = typeIconFor(event.type);
  const tags =
    Array.isArray(event.tags) && event.tags.length ? event.tags : [event.type];
  const coHosts = Array.isArray(event.team)
    ? event.team
        .filter((m) => ["Owner", "Admin", "Co-host"].includes(m.role))
        .map((m) => m.name)
        .filter(Boolean)
    : [];
  const teamAvatars = new Map(
    (Array.isArray(event.team) ? event.team : [])
      .filter((m) => m?.name && m.avatarUrl)
      .map((m) => [m.name, m.avatarUrl]),
  );
  const hosts = [event.organizer, ...coHosts]
    .filter((h, i, arr) => h && arr.indexOf(h) === i)
    .map((name, i) => ({
      name,
      avatarUrl:
        (i === 0 ? event.organizerAvatar || wallLogo : "") ||
        teamAvatars.get(name) ||
        "",
    }));
  const language =
    Array.isArray(event.languages) && event.languages.length
      ? (event.languages.find((l) => l.isDefault) || event.languages[0]).name
      : "English";

  const sidebarCards = {
    register: (
      <RegisterCard
        event={event}
        now={now}
        accent={accent}
        gatedIds={gatedIds}
        codeInput={codeInput}
        setCodeInput={setCodeInput}
        codeBusy={codeBusy}
        applyAccessCode={applyAccessCode}
        tickets={tickets}
        ticketGroups={ticketGroups}
        selected={selected}
        setSelected={setSelected}
        soldOut={soldOut}
        remaining={remaining}
        showRemaining={showRemaining}
        primaryBtnStyle={primaryBtnStyle}
        ctaHover={ctaHover}
        onCheckout={() => setCheckoutOpen(true)}
      />
    ),
    goodtoknow: (
      <GoodToKnowCard event={event} TypeIcon={TypeIcon} language={language} />
    ),
    atregistration: regQuestions.length ? (
      <AtRegistrationCard questions={regQuestions} />
    ) : null,
    guidelines: guidelines.length ? (
      <GuidelinesCard guidelines={guidelines} />
    ) : null,
  };

  const heroRegion = (
    <HeroRegion
      event={event}
      effective={effective}
      hero={hero}
      themed={themed}
      theme={theme}
      tags={tags}
      TypeIcon={TypeIcon}
      hosts={hosts}
      onVenueClick={() => setVenueOpen(true)}
    />
  );

  // Infographics authored in the editor's Page → Infographics screen render at
  // the foot of the main column (after venue/location), the natural spot for a
  // footer band. A virtual block keeps them out of the page design — they're
  // event content, not layout — while still flowing through PageBlock.
  const contentBlocks = [
    ...orderedBlocks,
    ...(Array.isArray(event.infographics) && event.infographics.length
      ? [{ id: "infographics", type: "infographics" }]
      : []),
  ];

  const brandBar = (
    <BrandBar
      headerCfg={headerCfg}
      barLogo={barLogo}
      primaryBtnStyle={primaryBtnStyle}
      ctaHover={ctaHover}
      onShare={onShare}
    />
  );

  return (
    <div
      className={cn(
        "text-foreground",
        themed ? "ev-themed min-h-screen bg-background" : fontClass,
      )}
      style={wrapperStyle}
    >
      {webfonts.map((w) => (
        <link key={w.css} rel="stylesheet" href={w.css} precedence="default" />
      ))}
      {fontFaceCss ? (
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />
      ) : null}

      {bgVideo ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
        >
          <video
            src={bgVideo.url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
          />
          {bgVideo.scrim ? (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: bgVideo.scrim }}
            />
          ) : null}
        </div>
      ) : null}

      {built && hero === "none" && !headerCfg ? null : (
        <div
          className={cn(
            "relative z-10 mx-auto px-4 sm:px-6 lg:px-8",
            built ? "pt-12" : "py-16",
          )}
          style={{ maxWidth: contentWidth }}
        >
          {brandBar}
          {hero === "banner" ? (
            <BannerHero
              event={event}
              tags={tags}
              coverClass={coverClass}
              coverStyle={coverStyle}
              bannerOverlay={bannerOverlay}
            />
          ) : null}
          {built ? (
            <div
              className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
              style={sectionGapStyle}
            >
              {heroRegion}
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 gap-10 lg:gap-16",
                sidebarLeft
                  ? "lg:grid-cols-[380px_1fr]"
                  : "lg:grid-cols-[1fr_380px]",
              )}
            >
              <div
                className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
                style={sectionGapStyle}
              >
                {heroRegion}
                {contentBlocks.map((b) => (
                  <PageBlock key={b.id} block={b} event={event} accent={accent} />
                ))}
              </div>

              <div
                className={cn(
                  "space-y-4 lg:sticky lg:top-20 lg:self-start",
                  sidebarLeft && "lg:order-first",
                )}
              >
                {sidebarBlocks.map((b) =>
                  b.type in sidebarCards ? (
                    <React.Fragment key={b.id}>{sidebarCards[b.type]}</React.Fragment>
                  ) : (
                    <PageBlock key={b.id} block={b} event={event} accent={accent} />
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {built ? (
        <div className="relative z-10">
          <PageTree
            tree={effective.tree}
            event={event}
            accent={accent}
            slots={sidebarCards}
            runScripts={live}
            brand={{
              logo: theme?.logo?.url || "",
              siteName: theme?.source?.siteName || "",
              accent: accent.color,
            }}
          />
        </div>
      ) : null}

      <div className="relative z-10">
        <PageFooter
          footer={effective.footer}
          accent={accent}
          logo={footerLogo}
          surface={themed ? resolveFooterSurface(theme) : null}
          contentWidth={contentWidth}
        />
      </div>

      <TicketCheckout
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setResumeResult(null);
          setApprovedResume(null);
        }}
        event={event}
        ticket={tickets[selected]}
        remaining={checkoutRemaining}
        live={live}
        accent={accent}
        resumeResult={resumeResult}
        approvedResume={approvedResume}
        daConfig={daConfig}
        onPurchased={(res) => {
          if (typeof res.sold === "number") setSoldOverride(res.sold);
        }}
      />

      <VenueDetailsDialog
        open={venueOpen}
        onClose={() => setVenueOpen(false)}
        venueId={event.venueId}
        accent={accent}
        fallback={{
          name: event.venue,
          address: event.address,
          city: event.city,
        }}
      />
    </div>
  );
}
