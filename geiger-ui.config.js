import { defineNavConfig } from "@geiger/ui";

// The @geiger/ui config for Geiger Events.
//
// Users curate their own sidebar in Settings → Navigation. This file is where
// the product declares the rules around that: what may never be hidden, and
// which nav entries can't function without another. @geiger/ui reads the rules
// and enforces them — a switch that would break the invariant is disabled and
// explains itself, so nothing is hidden or shown behind the user's back.
//
// Titles must match `components/internal/sidebar/sidebar_nav.jsx` exactly, and
// address top-level sections and sub-items alike. Add-on nav is merged in before
// this config is applied, so an add-on's entries are curatable too — it just
// doesn't declare rules here (its manifest owns its own enablement).

export default defineNavConfig({
  product: "events",

  // The spine of the workspace, plus the screen that unhides everything else.
  locked: ["Overview", "Events", "All Events", "Settings", "Navigation"],

  hiddenByDefault: [],

  dependencies: [
    // Discovery is the organiser profile rendered on the public Event Wall.
    {
      screen: "Discovery",
      requires: ["Event Wall"],
      reason: "The organiser profile is rendered on the public Event Wall.",
    },

    // Event Design — every diagram surface is built on a floor plan, and floor
    // plans are drawn against a venue.
    {
      screen: "Floor Plans",
      requires: ["Venues"],
      reason: "Floor plans are drawn to scale against a venue.",
    },
    { screen: "Seating Charts", requires: ["Floor Plans"] },
    { screen: "Setup Styles & Capacity", requires: ["Floor Plans"] },
    { screen: "3D Walkthrough", requires: ["Floor Plans"] },
    { screen: "Room Templates", requires: ["Floor Plans"] },
    { screen: "Venue Diagram Library", requires: ["Floor Plans"] },

    // Sourcing feeds the venue book.
    {
      screen: "Venue Sourcing",
      requires: ["Venues"],
      reason: "Sourced venues are promoted into the Venues book.",
    },

    // Registrations — the RSVP roster is what the gates and limits act on.
    { screen: "Waitlist", requires: ["RSVPs"] },
    { screen: "Approval Gates", requires: ["RSVPs"] },
    { screen: "Capacity Limits", requires: ["RSVPs"] },
    {
      screen: "Dietary & Accessibility",
      requires: ["Registration Forms"],
      reason: "Dietary and access needs are collected on the registration form.",
    },

    // Guests — Contact Book is the hub; the rest are lenses and actions on it.
    {
      screen: "Guest List",
      requires: ["Contact Book"],
      reason: "The guest roster is built from the Contact Book.",
    },
    { screen: "Who's Going", requires: ["Guest List"] },
    { screen: "Attendee Export", requires: ["Guest List"] },
    { screen: "Segments", requires: ["Contact Book"] },
    { screen: "Tags", requires: ["Contact Book"] },
    { screen: "Notes", requires: ["Contact Book"] },
    { screen: "Data Requests", requires: ["Contact Book"] },

    // Tickets — everything priced or gated hangs off a ticket type.
    { screen: "Ticket Tiers", requires: ["Ticket Types"] },
    { screen: "Bundles", requires: ["Ticket Types"] },
    { screen: "Early-bird Sales", requires: ["Ticket Types"] },
    { screen: "Access-code Tickets", requires: ["Ticket Types"] },
    { screen: "Group Purchasing", requires: ["Ticket Types"] },
    { screen: "Dynamic Pricing", requires: ["Ticket Types"] },
    { screen: "Reserved Seating", requires: ["Ticket Types"] },
    { screen: "Anti-scalping & Resale", requires: ["Ticket Types"] },
    { screen: "Payment Plans", requires: ["Payments & Methods"] },
    { screen: "Payouts", requires: ["Payments & Methods"] },
    { screen: "Multi-currency", requires: ["Payments & Methods"] },

    // Orders is the operational surface over sold tickets; Tickets keeps the
    // refund/order policy those ops run against.
    {
      screen: "Orders",
      requires: ["Tickets"],
      reason: "Orders are the operational surface over sold tickets.",
    },
    { screen: "Transactions", requires: ["All Orders"] },
    { screen: "Billing & Receipts", requires: ["All Orders"] },
    { screen: "Disputes & Chargebacks", requires: ["All Orders"] },
    { screen: "Order Settings", requires: ["All Orders"] },
    {
      screen: "Refunds & Cancellations",
      requires: ["All Orders", "Refunds"],
      reason: "Refund ops run against the refund policy configured in Tickets.",
    },

    // Inventory — on-hand is derived from the movement ledger over items, and
    // issuance is configured on an allocation.
    { screen: "Stock Movements", requires: ["Items"] },
    { screen: "Event Allocations", requires: ["Items"] },
    { screen: "Suppliers & Purchase Orders", requires: ["Items"] },
    {
      screen: "Item Issuing",
      requires: ["Event Allocations"],
      reason: "The issuing desk hands out what an event allocation entitles.",
    },
    { screen: "Issuing Staff", requires: ["Item Issuing"] },

    // Memberships are reusable ticketing records that unlock special pricing.
    {
      screen: "Memberships",
      requires: ["Tickets"],
      reason: "Membership plans are ticketing records that unlock pricing.",
    },
    { screen: "Members", requires: ["Membership Plans"] },
    { screen: "Membership Settings", requires: ["Membership Plans"] },

    // Check-in scans issued tickets; the door surfaces are modes of the app.
    {
      screen: "Check-in",
      requires: ["Tickets"],
      reason: "Check-in scans the tickets people bought.",
    },
    { screen: "Wallet Passes", requires: ["QR Tickets"] },
    { screen: "Check-in App", requires: ["QR Tickets"] },
    { screen: "Offline Check-in", requires: ["Check-in App"] },
    { screen: "Kiosk Mode", requires: ["Check-in App"] },
    { screen: "Self Check-in", requires: ["Check-in App"] },
    { screen: "Multi-gate & Zones", requires: ["Check-in App"] },
    { screen: "Staff Scanning Roles", requires: ["Check-in App"] },
    { screen: "Name-search Lookup", requires: ["Check-in App"] },
    { screen: "Real-time Attendance", requires: ["Check-in App"] },
    {
      screen: "Session Check-in",
      requires: ["Check-in App", "Agenda Builder"],
      reason: "Session check-in scans against the sessions on the agenda.",
    },

    // Program — the agenda is the schedule everything else reads.
    { screen: "Assign Agenda", requires: ["Agenda Builder"] },
    { screen: "CEU & Certificates", requires: ["Agenda Builder"] },
    {
      screen: "Call for Papers",
      requires: ["Agenda Builder"],
      reason: "Accepted submissions become sessions on the agenda.",
    },

    // Speakers — the portal and green room are surfaces on the roster.
    { screen: "Speaker Portal", requires: ["Speakers"] },
    { screen: "Speaker Backstage", requires: ["Speakers"] },

    // Sponsors & Expo — packages, rooms and booths all belong to a sponsor.
    { screen: "Sponsorship Packages", requires: ["Sponsors"] },
    { screen: "Sponsor Rooms", requires: ["Sponsors"] },
    { screen: "Expo Booths", requires: ["Sponsors"] },
    { screen: "Floor Plan & Booths", requires: ["Expo Booths"] },

    // Broadcast — replays and captions are produced from a live room.
    { screen: "Recordings & Replay", requires: ["Livestream Rooms"] },
    { screen: "Simulive & On-demand", requires: ["Recordings & Replay"] },
    { screen: "Captions & Transcription", requires: ["Recordings & Replay"] },

    // Campaigns reuse the Guests segmentation.
    {
      screen: "Segmentation",
      requires: ["Segments"],
      reason: "Campaign segmentation targets the audience segments in Guests.",
    },
    { screen: "Drip Sequences", requires: ["Email Invites"] },
    { screen: "Deliverability", requires: ["Email Invites"] },

    // Advertising is a wrapper over connected ad platforms.
    {
      screen: "Ad Campaigns",
      requires: ["Connections"],
      reason: "Ad campaigns run on a connected ad platform.",
    },
    { screen: "Budgets", requires: ["Ad Campaigns"] },
    { screen: "Insights", requires: ["Ad Campaigns"] },

    // Workflows — templates and run history are surfaces on the workflow list.
    { screen: "Workflow Templates", requires: ["All Workflows"] },
    { screen: "Run History", requires: ["All Workflows"] },

    // Analytics reports on the areas that produce the numbers.
    { screen: "Sales", requires: ["Tickets"] },
    { screen: "Attendance", requires: ["Check-in"] },
    { screen: "Email Performance", requires: ["Campaigns"] },
    { screen: "Sponsor ROI", requires: ["Sponsors"] },
  ],
});
