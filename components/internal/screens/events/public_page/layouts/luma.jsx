"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Globe,
  Instagram,
  Linkedin,
  Lock,
  MapPin,
  Music2,
  Twitter,
  UserCheck,
  Youtube,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { accessCodesEnabled } from "@/lib/events/access_codes";
import { eventTimezoneLabel, eventWeekday } from "@/lib/events/schedule";
import { FollowButton } from "@/components/internal/screens/discovery/public_follow";

import { formatDate, initials } from "../../sample_data";
import { MONTHS } from "../constants";
import { CoverImage } from "../hero";
import { Shell } from "./shared";

const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SOCIALS = [Instagram, Twitter, Youtube, Music2, Linkedin, Globe];

function parseYmd(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function fmtPrice(n) {
  const v = Number(n) || 0;
  if (v === 0) return "Free";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function LumaTicketCard({ ctx }) {
  const { event, accent, cta } = ctx;
  const { tickets, selected, setSelected, soldOut, onCheckout, primaryBtnStyle, ctaHover } = cta;
  const list = Array.isArray(tickets) && tickets.length ? tickets : [];
  const current = list[selected] || list[0] || null;
  const price = current ? Number(current.price) || 0 : 0;
  const requireApproval = !!event?.regSettings?.requireApproval;
  const codesOn = accessCodesEnabled(event);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <p className="border-b border-border bg-surface-card px-4 py-2.5 text-sm font-semibold text-foreground">
        Get Tickets
      </p>

      <div className="divide-y divide-border">
        {requireApproval ? (
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-text-secondary">
              <UserCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                Approval Required
              </span>
              <span className="block text-sm text-text-secondary">
                Your registration is subject to host approval.
              </span>
            </span>
          </div>
        ) : null}

        <div className="space-y-2 px-4 py-3.5">
          {list.length > 1 ? (
            <>
              <p className="text-xs font-medium text-text-secondary">Select ticket</p>
              <div className="space-y-2">
                {list.map((t, i) => {
                  const isActive = (selected ?? 0) === i;
                  return (
                    <button
                      key={t.id || t.name || i}
                      type="button"
                      onClick={() => setSelected(i)}
                      style={isActive ? { borderColor: accent.color } : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-surface-card"
                          : "border-border bg-transparent hover:bg-surface-card",
                      )}
                    >
                      <span
                        style={
                          isActive
                            ? { backgroundColor: accent.color, borderColor: accent.color }
                            : undefined
                        }
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          isActive ? "" : "border-border-strong",
                        )}
                      >
                        {isActive ? (
                          <Check className="h-3 w-3" style={{ color: accent.text }} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {t.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {fmtPrice(t.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-text-secondary">Ticket Price</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {fmtPrice(price)}
              </p>
            </>
          )}
        </div>

        <div className="space-y-3 px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">
            Welcome! To join the event, please get your ticket below.
          </p>
          <Button
            style={soldOut ? undefined : primaryBtnStyle}
            disabled={soldOut}
            className={cn(
              "w-full rounded-lg disabled:opacity-60",
              soldOut || !ctaHover ? "hover:opacity-90" : ctaHover,
            )}
            onClick={() => onCheckout(null)}
          >
            {soldOut
              ? "Sold out"
              : requireApproval
                ? "Request to Join"
                : price === 0
                  ? "Register"
                  : "Get Tickets"}
          </Button>
          {codesOn ? (
            <p className="flex items-start gap-1.5 text-xs text-text-secondary">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Have an access code? You can enter it{" "}
                <span className="underline underline-offset-2">here</span>.
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LumaLayout({ ctx }) {
  const {
    event,
    contentWidth,
    brandBar,
    blocks,
    sidebarRest,
    disclaimerSlot,
    meta,
    coverClass,
    coverStyle,
  } = ctx;

  const hosts = meta?.hosts || [];
  const primaryHost = hosts[0] || null;
  const tags = Array.isArray(event.tags) && event.tags.length
    ? event.tags
    : event.type
      ? [event.type]
      : [];

  const ymd = parseYmd(event.date);
  const weekdayLong = eventWeekday(event, { long: true });
  const dateHead = ymd ? `${weekdayLong}, ${LONG_MONTHS[ymd.m - 1]} ${ymd.d}` : formatDate(event.date);
  const timeLine = [event.time, eventTimezoneLabel(event)].filter(Boolean).join(" ");
  const city = event.city && event.city !== "Remote" ? event.city : "";
  const locSub = [city, event.address && event.address !== city ? event.address : ""]
    .filter(Boolean)
    .join(" · ") || (city ? `${city}, United States` : event.address || "");

  const description = event.summary || event.description || "";

  return (
    <Shell width={contentWidth} className="relative z-10 py-10 sm:py-14">
      {disclaimerSlot("top", "mb-8")}
      {brandBar}

      <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
        {/* Left rail — cover, presenter, hosts */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
            <div
              className={cn(
                "relative aspect-[4/5] w-full overflow-hidden",
                event.coverUrl ? "" : coverClass,
              )}
              style={event.coverUrl ? undefined : coverStyle}
            >
              <CoverImage event={event} />
            </div>
          </div>

          {primaryHost ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0 border border-border">
                  {primaryHost.avatarUrl ? (
                    <AvatarImage src={primaryHost.avatarUrl} alt="" className="object-contain p-1" />
                  ) : null}
                  <AvatarFallback className="bg-surface-card text-xs text-muted-foreground">
                    {initials(primaryHost.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-tight text-text-tertiary">Presented by</p>
                  <p className="flex min-w-0 items-center gap-0.5 text-sm font-semibold text-foreground">
                    <span className="truncate">{primaryHost.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  </p>
                </div>
                {event.projectId ? (
                  <FollowButton
                    projectId={event.projectId}
                    organiserName={primaryHost.name}
                    subtle
                  />
                ) : null}
              </div>
              <p className="text-xs text-text-tertiary">
                Events managed by {event.organizer || primaryHost.name}
              </p>
              <div className="flex items-center gap-3 text-text-tertiary">
                {SOCIALS.map((Icon, i) => (
                  <Icon key={i} className="h-4 w-4" />
                ))}
              </div>
            </div>
          ) : null}

          {hosts.length ? (
            <div>
              <p className="text-sm font-semibold text-foreground">Hosted By</p>
              <div className="mt-2 space-y-3 border-t border-border pt-3">
                {hosts.map((h) => (
                  <div key={h.name} className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0 border border-border">
                      {h.avatarUrl ? (
                        <AvatarImage src={h.avatarUrl} alt="" className="object-contain p-1" />
                      ) : null}
                      <AvatarFallback className="bg-surface-card text-[11px] text-muted-foreground">
                        {initials(h.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {h.name}
                    </p>
                    <span className="flex shrink-0 items-center gap-2.5 text-text-tertiary">
                      <Instagram className="h-4 w-4" />
                      <Twitter className="h-4 w-4" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            {["Contact the Host", "Refund Policy", "Report Event"].map((label) => (
              <button
                key={label}
                type="button"
                className="block text-left text-sm text-text-secondary transition-colors hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>

          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary"
                >
                  # {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right column — title, facts, tickets, content */}
        <div className="min-w-0">
          {city ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-card px-2.5 py-1 text-xs text-text-secondary">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-orange-500/20 text-orange-400">
                <CalendarDays className="h-3 w-3" />
              </span>
              Featured in <span className="font-semibold text-foreground">{city}</span>
              <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
            </span>
          ) : null}

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.05]">
            {event.name}
          </h1>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface-card leading-none">
                <span className="text-[9px] font-semibold tracking-wide text-muted-foreground">
                  {ymd ? MONTHS[ymd.m - 1] : ""}
                </span>
                <span className="text-base font-bold text-foreground">{ymd ? ymd.d : ""}</span>
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-[15px] font-semibold text-foreground">{dateHead}</span>
                {timeLine ? (
                  <span className="block text-sm text-text-secondary">{timeLine}</span>
                ) : null}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="flex items-center gap-1 text-[15px] font-semibold text-foreground">
                  {event.venue || "Venue to be announced"}
                  <ArrowUpRight className="h-4 w-4 text-text-tertiary" />
                </span>
                {locSub ? (
                  <span className="block text-sm text-text-secondary">{locSub}</span>
                ) : null}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <LumaTicketCard ctx={ctx} />
          </div>

          <div className="mt-8">
            <p className="border-b border-border pb-2 text-sm font-semibold text-foreground">
              About Event
            </p>
            <div className="space-y-4 pt-4 text-[15px] leading-relaxed text-foreground/90">
              {description ? <p>{description}</p> : null}
              {disclaimerSlot("hero")}
              {blocks.map((b) => b.node)}
              {sidebarRest.map((b) => b.node)}
              {disclaimerSlot("content")}
            </div>
          </div>

          <div className="mt-8">
            <p className="border-b border-border pb-2 text-sm font-semibold text-foreground">
              Location
            </p>
            <p className="pt-3 text-sm font-medium text-foreground">
              {event.venue || "Venue to be announced"}
            </p>
            {event.address ? (
              <p className="text-sm text-text-secondary">{event.address}</p>
            ) : null}
            {city ? <p className="text-sm text-text-secondary">{city}</p> : null}
          </div>
        </div>
      </div>
    </Shell>
  );
}
