"use client";

import React from "react";
import {
  Camera,
  Gift,
  Handshake,
  MapPin,
  Sparkles,
  Ticket,
  Armchair,
  UtensilsCrossed,
  DoorOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";

// The bits of a package that both the editor and the public page draw, kept in
// one place so a price never formats two different ways depending on where you
// happen to be looking at it.

const ICONS = {
  ticket: Ticket,
  seat: Armchair,
  location: MapPin,
  hospitality: UtensilsCrossed,
  photo: Camera,
  meet: Handshake,
  gift: Gift,
  access: DoorOpen,
  star: Sparkles,
};

export function InclusionIcon({ icon, className }) {
  const Icon = ICONS[icon] || Sparkles;
  return <Icon className={cn("h-4 w-4 shrink-0", className)} />;
}

/** "$1,000.00/pp" — the amount plus whatever unit the organizer typed. */
export function formatPackagePrice(pkg, currency = "USD") {
  const amount = Number(pkg?.price) || 0;
  let text;
  try {
    text = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    text = amount.toFixed(2);
  }
  return `${text}${pkg?.priceSuffix || ""}`;
}

export function PackagePrice({ pkg, currency, className }) {
  return (
    <span className={cn("font-semibold text-foreground", className)}>
      {formatPackagePrice(pkg, currency)}
    </span>
  );
}
