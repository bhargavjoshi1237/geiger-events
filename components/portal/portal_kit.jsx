"use client";
/* eslint-disable @next/next/no-img-element -- portal renders remote Supabase cover URLs; next/image adds no value here */

import React, { useEffect, useState } from "react";
import { CalendarPlus, MapPin, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildEventICS, directionsUrl, downloadICS } from "@/lib/portal/calendar";

// ---- formatters -----------------------------------------------------------
export const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

export const fmtDay = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

export function initials(name, email) {
  const src = (name || "").trim() || (email || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function firstName(name, email) {
  const n = (name || "").trim();
  if (n) return n.split(/\s+/)[0];
  const e = (email || "").trim();
  return e ? e.split("@")[0] : "there";
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// event_date is a plain date; treat the whole day (and grace to end of day) as
// upcoming so a same-day event still counts.
export function isUpcoming(dateStr) {
  if (!dateStr) return true;
  const d = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now();
}

// ---- countdown ------------------------------------------------------------
function diffParts(target) {
  const t = new Date(`${target}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  let ms = t - Date.now();
  const done = ms <= 0;
  ms = Math.max(0, ms);
  const days = Math.floor(ms / 864e5);
  const hours = Math.floor((ms % 864e5) / 36e5);
  const minutes = Math.floor((ms % 36e5) / 6e4);
  const seconds = Math.floor((ms % 6e4) / 1e3);
  return { days, hours, minutes, seconds, done };
}

export function useCountdown(dateStr) {
  // Tick a counter each second; derive the parts at render time so the effect
  // never calls setState with a computed value (avoids cascading renders).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!dateStr) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  return dateStr ? diffParts(dateStr) : null;
}

export function Countdown({ dateStr, className = "" }) {
  const p = useCountdown(dateStr);
  if (!p) return null;
  if (p.done) {
    return (
      <span className={`text-sm font-medium text-emerald-400 ${className}`}>
        Happening now
      </span>
    );
  }
  const cells = [
    { v: p.days, l: "days" },
    { v: p.hours, l: "hrs" },
    { v: p.minutes, l: "min" },
    { v: p.seconds, l: "sec" },
  ];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {cells.map((c) => (
        <div key={c.l} className="text-center">
          <div className="min-w-[2.5rem] rounded-md border border-border bg-surface-card px-2 py-1 text-lg font-semibold tabular-nums text-foreground">
            {String(c.v).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-text-tertiary">
            {c.l}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- primitives -----------------------------------------------------------
export function Card({ children, className = "", onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`rounded-xl border border-border bg-surface-card p-4 ${
        clickable
          ? "cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-hover"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Torn-ticket stub, a 1:1 port of the event editor's TicketStub: a body (icon
// chip, name, description, pipe-separated meta line, optional menu), a perforated
// divider with punched notch cut-outs, and a right-hand price stub. Clicking
// anywhere fires onClick. `image` shows a cover thumbnail in the chip; otherwise
// the ticket icon. `meta` is [{ label, muted? }].
export function TicketStubRow({
  image,
  icon: Icon = Ticket,
  name,
  description,
  meta = [],
  menu,
  stubValue,
  stubLabel = "price",
  onClick,
  className = "",
}) {
  const clickable = typeof onClick === "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`group relative flex overflow-hidden rounded-xl bg-surface-card text-left transition-colors ${
        clickable ? "cursor-pointer hover:bg-surface-active" : ""
      } ${className}`}
    >
      {/* Main body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-subtle text-muted-foreground">
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{name || "Untitled"}</p>
            {description ? (
              <p className="mt-0.5 truncate text-xs text-text-secondary">{description}</p>
            ) : null}
          </div>
          {menu ? (
            <div onClick={(e) => e.stopPropagation()} className="-mr-1 -mt-1 shrink-0">
              {menu}
            </div>
          ) : null}
        </div>
        {meta.length ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-text-secondary">
            {meta.map((item, idx) => (
              <React.Fragment key={`${item.label}-${idx}`}>
                {idx > 0 ? (
                  <span aria-hidden className="text-text-tertiary/40">|</span>
                ) : null}
                <span className={item.muted ? "text-text-tertiary" : undefined}>
                  {item.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>

      {/* Perforation with notch cut-outs punched to the canvas colour */}
      <div className="relative w-px shrink-0 self-stretch">
        <div className="absolute inset-y-4 left-0 border-l border-dashed border-border" />
        <span className="absolute -top-1.5 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-background" />
        <span className="absolute -bottom-1.5 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-background" />
      </div>

      {/* Price stub */}
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 p-3">
        <span className="text-lg font-semibold tabular-nums text-foreground">{stubValue}</span>
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{stubLabel}</span>
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

// Event cover thumbnail with a gradient fallback keyed off the name.
export function Cover({ url, name, className = "" }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`object-cover ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-surface-strong to-surface-card text-sm font-semibold text-text-secondary ${className}`}
    >
      {(name || "E").slice(0, 1).toUpperCase()}
    </div>
  );
}

// ---- ticket actions -------------------------------------------------------
export function TicketQr({ orderId }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-xl bg-white p-3">
      <img
        src={`${base}/api/portal/ticket/${orderId}/qr`}
        alt="Ticket QR code"
        width={240}
        height={240}
        className="h-auto w-full"
      />
    </div>
  );
}

export function CalendarButton({ order, className = "" }) {
  if (!buildEventICS(order)) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => downloadICS(order)}
      className={`border-border bg-surface-card text-foreground hover:bg-surface-hover ${className}`}
    >
      <CalendarPlus className="h-4 w-4" /> Add to calendar
    </Button>
  );
}

export function DirectionsButton({ order, className = "" }) {
  const url = directionsUrl(order);
  if (!url) return null;
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={`border-border bg-surface-card text-foreground hover:bg-surface-hover ${className}`}
    >
      <a href={url} target="_blank" rel="noreferrer">
        <MapPin className="h-4 w-4" /> Directions
      </a>
    </Button>
  );
}
