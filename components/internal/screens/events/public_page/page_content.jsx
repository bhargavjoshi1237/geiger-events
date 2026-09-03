"use client";

import React, { useState } from "react";

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
import { BannerHero, HeroRegion, HostsBlock, galleryStripOf } from "./hero";
import { PageLayout } from "./layouts";
import {
  RegisterCard,
  GoodToKnowCard,
  AtRegistrationCard,
  GuidelinesCard,
} from "./sidebar_cards";
import { VenueDetailsDialog } from "./venue_dialog";
import { TicketCheckout } from "./checkout/ticket_checkout";
import { makeDisclaimerSlot } from "./disclaimer";
import { getSectionNote } from "./section_note";

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
    layout,
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
  // Batched releases cap the buyable qty to the unlocked tranches (FIFO).
  const releaseRemaining = selectedTicket?.releaseState?.hasReleases
    ? (Number.isFinite(selectedTicket.releaseState.remaining)
        ? selectedTicket.releaseState.remaining
        : Infinity)
    : Infinity;
  const remaining = Math.min(eventRemaining, tierRemaining, releaseRemaining);
  const soldOut = Number.isFinite(remaining) && remaining <= 0;
  const checkoutRemaining = Number.isFinite(remaining) ? remaining : 9999;
  const showRemaining = event.regSettings?.showRemaining !== false;

  const [checkoutEntry, setCheckoutEntry] = useState(null);
  const openCheckout = (entry) => {
    setCheckoutEntry(entry || null);
    setCheckoutOpen(true);
  };

  const disclaimerSlot = makeDisclaimerSlot(event);

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
        note={getSectionNote(event, "register")}
        onCheckout={openCheckout}
      />
    ),
    goodtoknow: (
      <GoodToKnowCard
        event={event}
        TypeIcon={TypeIcon}
        language={language}
        note={getSectionNote(event, "goodtoknow")}
      />
    ),
    atregistration: regQuestions.length ? (
      <AtRegistrationCard
        questions={regQuestions}
        note={getSectionNote(event, "atregistration")}
      />
    ) : null,
    guidelines: guidelines.length ? (
      <GuidelinesCard
        guidelines={guidelines}
        note={getSectionNote(event, "guidelines")}
      />
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

  const contentBlocks = [
    ...orderedBlocks,
    ...(Array.isArray(event.infographics) && event.infographics.length
      ? [{ id: "infographics", type: "infographics" }]
      : []),
  ];

  const sidebarNodes = sidebarBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    node:
      b.type in sidebarCards ? (
        <React.Fragment key={b.id}>{sidebarCards[b.type]}</React.Fragment>
      ) : (
        <PageBlock key={b.id} block={b} event={event} accent={accent} />
      ),
  }));

  const brandBar = (
    <BrandBar
      headerCfg={headerCfg}
      barLogo={barLogo}
      primaryBtnStyle={primaryBtnStyle}
      ctaHover={ctaHover}
      onShare={onShare}
    />
  );

  const layoutCtx = {
    event,
    theme,
    themed,
    accent,
    contentWidth,
    sectionGapStyle,
    coverClass,
    coverStyle,
    bannerOverlay,
    hero,
    sidebarLeft,
    brandBar,
    heroRegion,
    disclaimerSlot,
    parts: {
      gallery: galleryStripOf(event, effective),
      hostsBlock: <HostsBlock event={event} hosts={hosts} />,
    },
    blocks: contentBlocks.map((b) => ({
      ...b,
      node: <PageBlock key={b.id} block={b} event={event} accent={accent} />,
    })),
    sidebarNodes,
    sidebarRest: sidebarNodes.filter((b) => b.type !== "register"),
    register: sidebarCards.register,
    meta: { tags, TypeIcon, hosts, language },
    cta: {
      tickets,
      selected,
      setSelected,
      soldOut,
      remaining,
      showRemaining,
      primaryBtnStyle,
      ctaHover,
      onCheckout: openCheckout,
    },
  };

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

      {built ? (
        hero === "none" && !headerCfg ? null : (
          <div
            className="relative z-10 mx-auto px-4 pt-12 sm:px-6 lg:px-8"
            style={{ maxWidth: contentWidth }}
          >
            {disclaimerSlot("top", "mb-8")}
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
            <div
              className={cn("min-w-0", themed ? "flex flex-col" : "space-y-10")}
              style={sectionGapStyle}
            >
              {heroRegion}
              {disclaimerSlot("hero")}
            </div>
          </div>
        )
      ) : (
        <PageLayout layout={layout} ctx={layoutCtx} />
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

      {disclaimerSlot(
        "above-footer",
        "relative z-10 mx-auto w-full px-4 pb-8 sm:px-6 lg:px-8",
        { maxWidth: contentWidth },
      )}

      <div className="relative z-10">
        <PageFooter
          footer={effective.footer}
          accent={accent}
          logo={footerLogo}
          surface={themed ? resolveFooterSurface(theme) : null}
          contentWidth={contentWidth}
        />
      </div>

      {disclaimerSlot(
        "below-footer",
        "relative z-10 mx-auto w-full px-4 pt-8 sm:px-6 lg:px-8",
        { maxWidth: contentWidth },
      )}

      <TicketCheckout
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setCheckoutEntry(null);
          setResumeResult(null);
          setApprovedResume(null);
        }}
        entry={checkoutEntry}
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
