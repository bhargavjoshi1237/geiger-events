import {
  BadgeDollarSign,
  Banknote,
  LayoutTemplate,
  Percent,
  Settings,
  Users,
} from "lucide-react";

import { defineAddon } from "../manifest_schema";

// Affiliates — an affiliate program for ticket sales.
//
// Identity is project-wide (one person, one portal login, one lifetime earnings
// view); each EVENT runs its own fully independent program, optionally created
// from a saved template. See docs/superpowers/specs/2026-07-29-affiliates-addon-design.md.
//
// Screen titles are deliberately qualified where the core registry already owns
// the plain word ("Affiliate Payouts", not "Payouts") — a clash throws at module
// load rather than silently shadowing a core screen.
export default defineAddon({
  id: "affiliates",
  name: "Affiliates",
  description:
    "Recruit affiliates, run a per-event commission program with tiers, attribute ticket sales to tracked links and codes, and settle payouts.",
  version: "1.0.0",
  category: "Revenue",
  icon: BadgeDollarSign,
  accent: "emerald",
  features: [
    "Project-wide affiliate roster with portal access and lifetime earnings",
    "Independent per-event programs, created from reusable templates",
    "Manual and automatic performance tiers with per-event overrides",
    "Last-touch link and code attribution with a configurable cookie window",
    "Commission ledger with manual approval, clawbacks and payout batches",
  ],
  nav: {
    title: "Affiliates",
    icon: BadgeDollarSign,
    insertAfter: "Orders",
  },
  screens: [
    {
      key: "roster",
      title: "Affiliates",
      icon: Users,
      load: () => import("./screens/affiliates_roster"),
    },
    {
      key: "programs",
      title: "Programs",
      icon: BadgeDollarSign,
      load: () => import("./screens/programs"),
    },
    {
      key: "commissions",
      title: "Commissions",
      icon: Percent,
      load: () => import("./screens/commissions"),
    },
    {
      key: "payouts",
      title: "Affiliate Payouts",
      icon: Banknote,
      load: () => import("./screens/affiliate_payouts"),
    },
    {
      key: "templates",
      title: "Program Templates",
      icon: LayoutTemplate,
      load: () => import("./screens/program_templates"),
    },
    {
      key: "settings",
      title: "Affiliate Settings",
      icon: Settings,
      load: () => import("./screens/affiliate_settings"),
    },
  ],
  permissions: [
    {
      key: "view.affiliates",
      label: "Affiliates",
      group: "Workspace views",
    },
    {
      key: "affiliates.manage",
      label: "Manage affiliate programs and payouts",
      group: "Administration",
    },
  ],
  defaultConfig: {
    attributionWindowDays: 30,
    selfReferralBlocked: true,
    commissionBase: "tickets",
    discountHandling: "post",
  },
});
