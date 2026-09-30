"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarX2,
  Check,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { ctaHref } from "@/lib/events/ctas";
import {
  formatSpotPrice,
  hasContactMethod,
  listedSpots,
  normalizeSponsorshipPage,
  whatsappHref,
} from "@/lib/events/sponsorship";
import { formatDate } from "../../sample_data";
import { usePageTheme } from "../../public_page/use_page_theme";
import { SponsorInterestForm } from "./interest_form";

const FORM_ID = "register-interest";

function Unavailable({ eventId }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle text-text-secondary">
        <CalendarX2 className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Sponsorship isn&apos;t open</h1>
        <p className="max-w-sm text-sm text-text-secondary">
          This event has no sponsorship page, or it hasn&apos;t been published yet.
        </p>
      </div>
      {eventId ? (
        <Button
          asChild
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Link href={`/e/${eventId}`}>
            <ArrowLeft className="h-4 w-4" /> Back to the event
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function SpotCard({ spot, showPrice, canRequest, onRequest, buttonStyle }) {
  const taken = spot.left <= 0;
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-surface-subtle", taken && "opacity-70")}>
      <div className="space-y-2 border-b border-border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{spot.name}</h3>
          {spot.tier && spot.tier.toLowerCase() !== spot.name.trim().toLowerCase() ? (
            <Badge variant="neutral">{spot.tier}</Badge>
          ) : null}
        </div>
        <p className="text-xl font-bold text-foreground">{showPrice ? formatSpotPrice(spot) : "On request"}</p>
        <p className="text-xs text-text-secondary">
          {taken ? "Taken" : spot.quantity > 1 ? `${spot.left} of ${spot.quantity} available` : "Available"}
        </p>
      </div>

      <div className="flex-1 space-y-3 p-5">
        {spot.description ? <p className="text-sm leading-relaxed text-text-secondary">{spot.description}</p> : null}
        {spot.benefits.length ? (
          <ul className="space-y-2">
            {spot.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                {b}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {canRequest ? (
        <div className="p-5 pt-0">
          <Button disabled={taken} style={taken ? undefined : buttonStyle} onClick={() => onRequest(spot)} className="w-full hover:opacity-90">
            {taken ? "Taken" : "Request this spot"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ContactCard({ page, buttonStyle }) {
  const whatsapp = whatsappHref(page.contactWhatsapp);
  const booking = ctaHref(page.bookingUrl);
  const rows = [
    page.contactEmail ? { icon: Mail, label: page.contactEmail, href: `mailto:${page.contactEmail}` } : null,
    page.contactPhone ? { icon: Phone, label: page.contactPhone, href: `tel:${page.contactPhone.replace(/\s+/g, "")}` } : null,
    whatsapp ? { icon: MessageCircle, label: `WhatsApp ${page.contactWhatsapp}`, href: whatsapp, external: true } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface-subtle px-6 py-8">
      <h2 className="text-lg font-semibold text-foreground">{page.contactHeading || "Talk to us"}</h2>
      {page.contactNote ? <p className="whitespace-pre-line text-sm text-text-secondary">{page.contactNote}</p> : null}
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map(({ icon: Icon, label, href, external }) => (
            <li key={href}>
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-2.5 text-sm text-foreground underline-offset-4 hover:underline"
              >
                <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <span className="break-all">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {booking ? (
        <Button asChild style={buttonStyle} className="hover:opacity-90">
          <a href={booking} target="_blank" rel="noopener noreferrer">
            <CalendarDays className="h-4 w-4" /> {page.bookingLabel || "Book a call"}
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export function SponsorProspectusPage({ event }) {
  const page = normalizeSponsorshipPage(event?.sponsorshipPage);
  const spots = listedSpots(event);
  const [spotId, setSpotId] = useState(null);

  const { themed, fontClass, wrapperStyle, contentWidth, coverClass, coverStyle, primaryBtnStyle } = usePageTheme({
    design: event?.pageDesign,
    live: true,
  });

  if (!event || !page.enabled) return <Unavailable eventId={event?.id} />;

  const showContact = hasContactMethod(page);
  const canRequest = page.formEnabled || !!page.contactEmail;

  // With the form on, requesting preselects the spot there; without it, the request becomes an email.
  const request = (spot) => {
    if (page.formEnabled) {
      setSpotId(spot.id);
      document.getElementById(FORM_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const subject = encodeURIComponent(`Sponsoring ${event.name}: ${spot.name}`);
    window.location.href = `mailto:${page.contactEmail}?subject=${subject}`;
  };

  return (
    <div className={cn("min-h-[100dvh] bg-background text-foreground", fontClass)} style={wrapperStyle}>
      <div
        className={cn("relative w-full", coverClass)}
        style={
          event.coverUrl
            ? { backgroundImage: `url(${event.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : coverStyle
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
        <div className="relative mx-auto flex min-h-[16rem] flex-col justify-end px-4 py-10 sm:px-6" style={{ maxWidth: contentWidth }}>
          <Link href={`/e/${event.id}`} className="mb-auto inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> {event.name}
          </Link>
          <h1 className="mt-10 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {page.title || `Sponsor ${event.name}`}
          </h1>
          {page.subtitle ? <p className="mt-2 text-sm text-white/85">{page.subtitle}</p> : null}
          {event.date ? <p className="mt-1 text-sm text-white/70">{formatDate(event.date)}</p> : null}
        </div>
      </div>

      {page.intro ? (
        <div className="mx-auto px-4 py-12 sm:px-6" style={{ maxWidth: contentWidth }}>
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-text-secondary">{page.intro}</p>
        </div>
      ) : null}

      {spots.length ? (
        <div className={cn("py-12", themed ? "" : "bg-surface-subtle/40")}>
          <div className="mx-auto px-4 sm:px-6" style={{ maxWidth: contentWidth }}>
            <h2 className="mb-6 text-lg font-semibold text-foreground">Sponsorship opportunities</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  showPrice={page.showPrices}
                  canRequest={canRequest}
                  onRequest={request}
                  buttonStyle={primaryBtnStyle}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showContact || page.formEnabled ? (
        <div className="mx-auto px-4 py-12 sm:px-6" style={{ maxWidth: contentWidth }}>
          <div className={cn("grid items-start gap-6", showContact && page.formEnabled && "lg:grid-cols-[1fr_1.6fr]")}>
            {showContact ? <ContactCard page={page} buttonStyle={primaryBtnStyle} /> : null}
            {page.formEnabled ? (
              <div id={FORM_ID} className="scroll-mt-6">
                <SponsorInterestForm
                  event={event}
                  page={page}
                  spots={spots}
                  spotId={spotId}
                  onSpotChange={setSpotId}
                  buttonStyle={primaryBtnStyle}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SponsorProspectusPage;
