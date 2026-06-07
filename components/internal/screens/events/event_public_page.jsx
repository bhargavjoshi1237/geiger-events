"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Clock,
  CalendarCheck,
  Share2,
  Check,
  ImageIcon,
  Users,
  Globe,
  Video,
  Ticket,
  ChevronRight,
  Eye,
  ClipboardList,
  Languages,
  Gauge,
  Image as ImgIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_MAP, formatDate, initials } from "./sample_data";
import { defaultPageDesign, resolveAccent, resolveFont } from "./page_design";
import { PageBlock } from "./page_blocks";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const CO_HOSTS = ["Marco Reyes", "Priya Shah"];
const REG_QUESTIONS = ["Full name", "Dietary requirements", "T-shirt size"];
const TYPE_ICON = { "In-person": MapPin, Online: Video, Hybrid: Globe };

function eventBase(event) {
  if (event.sold > 0 && event.revenue > 0) {
    return Math.max(5, Math.round(event.revenue / event.sold / 5) * 5);
  }
  return 25;
}

function buildTickets(event) {
  if (event.type === "Online" && event.revenue === 0) {
    return [{ name: "Free registration", price: 0, note: "Online access link sent on registration" }];
  }
  const base = eventBase(event);
  return [
    { name: "Early Bird", price: Math.max(0, Math.round(base * 0.7)), note: "Limited availability" },
    { name: "General Admission", price: base, note: "Standard entry" },
    { name: "VIP", price: Math.round(base * 2.2), note: "Front row + after-party" },
  ];
}

export function EventPublicPage({ event, onClose, design }) {
  const tickets = buildTickets(event);
  const [selected, setSelected] = useState(Math.min(1, tickets.length - 1));

  if (!event) return null;

  // Standard mode always renders the tuned default look, regardless of any
  // saved theme tweaks. Themed/Custom honor the saved design.
  const cfg = design || defaultPageDesign();
  const effective = cfg.mode === "standard" ? defaultPageDesign() : cfg;
  const accent = resolveAccent(effective.accent);
  const fontClass = resolveFont(effective.font).className;
  const accentStyle = { backgroundColor: accent.color, color: accent.text };

  const [y, m, d] = event.date.split("-").map(Number);
  const remaining = Math.max(0, event.capacity - event.sold);
  const TypeIcon = TYPE_ICON[event.type] || MapPin;
  const tags = [event.type, "Community", "Networking"];
  const hosts = [event.organizer, ...CO_HOSTS];

  // Cover surface honors the chosen cover style.
  let coverClass = "bg-gradient-to-br from-[#242424] to-[#1a1a1a]";
  let coverStyle;
  if (effective.cover === "solid") {
    coverClass = "";
    coverStyle = { backgroundColor: "#202020" };
  } else if (effective.cover === "accent") {
    coverClass = "";
    coverStyle = {
      backgroundImage: `linear-gradient(135deg, ${accent.color}33, #1a1a1a)`,
    };
  }

  const orderedBlocks = effective.blocks.filter((b) => b.visible);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto bg-[#161616] text-[#ededed]",
        fontClass,
      )}
    >
      {/* Preview chrome */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#2a2a2a] bg-[#161616]/80 px-4 py-3 backdrop-blur sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-[#a3a3a3] hover:bg-[#252525] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-xs font-medium text-[#a3a3a3]">
          <Eye className="h-3.5 w-3.5" /> Public page preview
          {effective.mode !== "standard" ? (
            <span className="capitalize text-[#525252]">· {cfg.mode}</span>
          ) : null}
        </span>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
          {/* Main column */}
          <div className="min-w-0 space-y-10">
            {/* Cover + gallery */}
            <div className="space-y-3">
              <div
                className={cn(
                  "relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border border-[#2a2a2a] text-[#3a3a3a]",
                  coverClass,
                )}
                style={coverStyle}
              >
                <ImageIcon className="h-12 w-12" />
                <div className="absolute left-4 top-4 flex gap-2">
                  <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
                    <TypeIcon className="h-3 w-3" />
                    {event.type}
                  </Badge>
                </div>
              </div>
              {effective.showGallery ? (
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="flex aspect-[4/3] items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#202020] text-[#3a3a3a]"
                    >
                      <ImgIcon className="h-5 w-5" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Title + meta + tags (core) */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {event.name}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#d4d4d4]">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#737373]" />
                  {formatDate(event.date)} · {event.time}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#737373]" />
                  {event.venue}
                  {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
                </span>
              </div>
            </div>

            {/* Hosts (core) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-[#2a2a2a] py-5">
              {hosts.map((h, i) => (
                <div key={h} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-[#2a2a2a]">
                    <AvatarFallback className="bg-[#202020] text-sm text-[#d4d4d4]">
                      {initials(h)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-[#737373]">
                      {i === 0 ? "Hosted by" : "Co-host"}
                    </p>
                    <p className="text-sm font-medium text-[#ededed]">{h}</p>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white sm:ml-auto"
                onClick={() => toast.success(`Following ${event.organizer}.`)}
              >
                Follow
              </Button>
            </div>

            {/* Ordered, toggleable content blocks */}
            {orderedBlocks.map((b) => (
              <PageBlock key={b.id} block={b} event={event} accent={accent} />
            ))}
          </div>

          {/* Registration sidebar */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]">
              <div className="flex items-center gap-3 border-b border-[#2a2a2a] p-4">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#202020]">
                  <span className="text-[10px] font-semibold text-[#a3a3a3]">
                    {MONTHS[m - 1]}
                  </span>
                  <span className="text-lg font-bold leading-none text-white">
                    {d}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ededed]">
                    {formatDate(event.date)}
                  </p>
                  <p className="text-xs text-[#737373]">
                    {event.time} · {y}
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[#737373]">
                  Select ticket
                </p>
                {tickets.map((t, i) => {
                  const isActive = selected === i;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelected(i)}
                      style={isActive ? { borderColor: accent.color } : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        isActive
                          ? "bg-[#202020]"
                          : "border-[#2a2a2a] bg-transparent hover:bg-[#1f1f1f]",
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
                          isActive ? "" : "border-[#444]",
                        )}
                      >
                        {isActive ? (
                          <Check className="h-3 w-3" style={{ color: accent.text }} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#ededed]">
                          {t.name}
                        </span>
                        {t.note ? (
                          <span className="block text-xs text-[#737373]">
                            {t.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                        {t.price === 0 ? "Free" : `$${t.price}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-[#2a2a2a] p-4">
                <Button
                  style={accentStyle}
                  className="w-full hover:opacity-90"
                  onClick={() =>
                    toast.success(`Reserved a ${tickets[selected].name} ticket.`)
                  }
                >
                  {tickets[selected].price === 0 ? "Register" : "Get tickets"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-[#737373]">
                  <Ticket className="h-3.5 w-3.5" />
                  {remaining > 0
                    ? `${remaining.toLocaleString()} tickets remaining`
                    : "Sold out"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
                    onClick={() => toast.success("Added to calendar.")}
                  >
                    <CalendarCheck className="h-4 w-4" /> Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
                    onClick={() => toast.success("Share link copied.")}
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Good to know */}
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
              <p className="mb-3 text-sm font-semibold text-[#ededed]">
                Good to know
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[#737373]">
                    <TypeIcon className="h-4 w-4" /> Format
                  </span>
                  <span className="text-[#d4d4d4]">{event.type}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[#737373]">
                    <Gauge className="h-4 w-4" /> Capacity
                  </span>
                  <span className="text-[#d4d4d4]">
                    {event.capacity.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[#737373]">
                    <Languages className="h-4 w-4" /> Language
                  </span>
                  <span className="text-[#d4d4d4]">English</span>
                </div>
              </div>
            </div>

            {/* What you'll be asked */}
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#ededed]">
                <ClipboardList className="h-4 w-4 text-[#a3a3a3]" /> At registration
              </p>
              <ul className="space-y-2">
                {REG_QUESTIONS.map((q) => (
                  <li
                    key={q}
                    className="flex items-center gap-2 text-sm text-[#a3a3a3]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#525252]" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[#525252]">
              <Users className="h-3.5 w-3.5" />
              Powered by Geiger Events
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventPublicPage;
