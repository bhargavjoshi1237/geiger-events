import { defineNavConfig } from "@geiger/ui";

export default defineNavConfig({
  product: "events",

  locked: ["Overview", "Events", "All Events", "Settings", "Navigation"],

  hiddenByDefault: [],

  dependencies: [
    {
      screen: "Discovery",
      requires: ["Event Wall"],
      reason: "The organiser profile is rendered on the public Event Wall.",
    },

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

    {
      screen: "Venue Sourcing",
      requires: ["Venues"],
      reason: "Sourced venues are promoted into the Venues book.",
    },

    { screen: "Waitlist", requires: ["RSVPs"] },
    { screen: "Approval Gates", requires: ["RSVPs"] },
    { screen: "Capacity Limits", requires: ["RSVPs"] },
    {
      screen: "Dietary & Accessibility",
      requires: ["Registration Forms"],
      reason: "Dietary and access needs are collected on the registration form.",
    },

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

    { screen: "Stock Movements", requires: ["Items"] },
    { screen: "Event Allocations", requires: ["Items"] },
    { screen: "Suppliers & Purchase Orders", requires: ["Items"] },
    {
      screen: "Item Issuing",
      requires: ["Event Allocations"],
      reason: "The issuing desk hands out what an event allocation entitles.",
    },
    { screen: "Issuing Staff", requires: ["Item Issuing"] },

    {
      screen: "Memberships",
      requires: ["Tickets"],
      reason: "Membership plans are ticketing records that unlock pricing.",
    },
    { screen: "Members", requires: ["Membership Plans"] },
    { screen: "Membership Settings", requires: ["Membership Plans"] },

    {
      screen: "Check-in",
      requires: ["Tickets"],
      reason: "Check-in scans the tickets people bought.",
    },
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

    { screen: "Assign Agenda", requires: ["Agenda Builder"] },
    { screen: "CEU & Certificates", requires: ["Agenda Builder"] },
    {
      screen: "Call for Papers",
      requires: ["Agenda Builder"],
      reason: "Accepted submissions become sessions on the agenda.",
    },

    { screen: "Speaker Portal", requires: ["Speakers"] },
    { screen: "Speaker Backstage", requires: ["Speakers"] },

    { screen: "Sponsorship Packages", requires: ["Sponsors"] },
    { screen: "Sponsor Rooms", requires: ["Sponsors"] },
    { screen: "Expo Booths", requires: ["Sponsors"] },
    { screen: "Floor Plan & Booths", requires: ["Expo Booths"] },

    { screen: "Recordings & Replay", requires: ["Livestream Rooms"] },
    { screen: "Simulive & On-demand", requires: ["Recordings & Replay"] },
    { screen: "Captions & Transcription", requires: ["Recordings & Replay"] },

    {
      screen: "Segmentation",
      requires: ["Segments"],
      reason: "Campaign segmentation targets the audience segments in Guests.",
    },
    { screen: "Drip Sequences", requires: ["Email Invites"] },
    { screen: "Deliverability", requires: ["Email Invites"] },

    {
      screen: "Ad Campaigns",
      requires: ["Connections"],
      reason: "Ad campaigns run on a connected ad platform.",
    },
    { screen: "Budgets", requires: ["Ad Campaigns"] },
    { screen: "Insights", requires: ["Ad Campaigns"] },

    { screen: "Workflow Templates", requires: ["All Workflows"] },
    { screen: "Run History", requires: ["All Workflows"] },

    { screen: "Sales", requires: ["Tickets"] },
    { screen: "Attendance", requires: ["Check-in"] },
    { screen: "Email Performance", requires: ["Campaigns"] },
    { screen: "Sponsor ROI", requires: ["Sponsors"] },
  ],
});
