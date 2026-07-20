import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Ticket,
  QrCode,
  BarChart3,
  Megaphone,
  Compass,
  MessagesSquare,
  Settings,
  LayoutTemplate,
  UserCheck,
  FileText,
  Clock,
  ListChecks,
  Percent,
  CreditCard,
  Banknote,
  ShoppingBag,
  TrendingUp,
  Coins,
  Timer,
  Armchair,
  RotateCcw,
  BadgeCheck,
  Scale,
  Layers,
  Newspaper,
  Bell,
  Mic,
  Handshake,
  Video,
  ShieldCheck,
  Webhook,
  Gauge,
  LayoutGrid,
  Zap,
  CalendarPlus,
  MapPin,
  Repeat,
  Copy,
  Globe,
  SquarePen,
  CalendarCheck,
  Map,
  Accessibility,
  KeyRound,
  CalendarClock,
  Sparkles,
  BookUser,
  ShieldAlert,
  History,
  Contact,
  Heart,
  Wallet,
  Package,
  ScanLine,
  DoorOpen,
  CloudOff,
  Monitor,
  Printer,
  Radio,
  Cpu,
  Search,
  Mail,
  Filter,
  PieChart,
  MessageSquare,
  MessageCircle,
  Send,
  Workflow,
  MailX,
  Tag,
  Store,
  Network,
  Music,
  Vote,
  HelpCircle,
  Clapperboard,
  MonitorPlay,
  Building2,
  Plane,
  Smartphone,
  Award,
  CirclePlay,
  Captions,
  Activity,
  Download,
  StickyNote,
  PencilRuler,
  Box,
  FileSearch,
  BadgeDollarSign,
  Link2,
  ArrowLeftRight,
  Receipt,
} from "lucide-react";

// Sidebar navigation for Geiger Events.
// Top-level items map to the Feature Taxonomy parent areas in
// docs/competitive-feature-matrix.md. Every feature for an area is listed as a
// sub-item so the full scope is visible in the UI.
export const workspaceNav = [
  {
    title: "Overview",
    icon: LayoutDashboard,
  },

  {
    // Per-event features (cover media, tickets, visibility, sharing, etc.) live
    // as tabs inside the Event editor — opened by selecting an event in
    // All Events — so only workspace-level destinations appear here.
    title: "Events",
    icon: CalendarDays,
    subItems: [
      { title: "All Events", icon: CalendarDays },
      { title: "Templates", icon: LayoutTemplate },
      { title: "Event Series", icon: Layers },
      { title: "Event Wall", icon: LayoutGrid },
    ],
  },

  {
    // Reusable venues — created and maintained here, then picked when creating
    // an event (fills in location) and shown on the public event page. A single
    // workspace-level destination; per-venue detail lives in the venue editor.
    title: "Venues",
    icon: Building2,
  },

  {
    // Event diagramming (à la Cvent Event Diagramming / Social Tables): to-scale
    // floor plans, an object library, seating charts, setup-style capacity checks,
    // 3D walkthroughs and shareable diagrams. Per-diagram editing lives inside the
    // Floor Plans canvas — these are the workspace-level destinations.
    title: "Event Design",
    icon: PencilRuler,
    subItems: [
      { title: "Floor Plans", icon: Map },
      { title: "Object Library", icon: Armchair },
      { title: "Seating Charts", icon: Users },
      { title: "Setup Styles & Capacity", icon: LayoutGrid },
      { title: "3D Walkthrough", icon: Box },
      { title: "Room Templates", icon: LayoutTemplate },
      { title: "Collaboration & Sharing", icon: Handshake },
      { title: "Venue Diagram Library", icon: Building2 },
    ],
  },

  {
    // Venue/supplier sourcing (à la Cvent Supplier & Venue Solutions). Only the
    // features Geiger doesn't already cover: Smart Custom Proposals, Instant Book
    // and Advertising. 3D Virtual Tour → Event Design → 3D Walkthrough; Hotel RFP
    // → Conference → Venue Sourcing; Passkey → Conference → Housing & Travel.
    title: "Sourcing",
    icon: FileSearch,
    subItems: [
      { title: "Smart Custom Proposals", icon: FileText },
      { title: "Instant Book", icon: Zap },
    ],
  },

  {
    title: "Registrations",
    icon: ClipboardList,
    // Workspace-level surfaces only. Per-event config (plus-ones, token/member
    // gating, conditional questions, deadlines, confirmation page…) lives inside
    // these screens and the event editor — not as separate nav destinations.
    subItems: [
      { title: "RSVPs", icon: UserCheck },
      { title: "Registration Forms", icon: FileText },
      { title: "Waitlist", icon: Clock },
      { title: "Approval Gates", icon: ShieldCheck },
      { title: "Capacity Limits", icon: Gauge },
      { title: "Dietary & Accessibility", icon: Accessibility },
    ],
  },

  {
    // The contact/CRM layer. Contact Book is the hub — Import, Find duplicates
    // and Block-an-email are actions on it, and per-contact surfaces (profile,
    // consent, activity) are its drawer tabs. Guest List is the all-time roster;
    // Who's Going is the upcoming-only lens; Attendee Export builds exports many
    // ways; Segments/Tags manage audience grouping; Notes is the cross-contact
    // note feed. Only real destinations appear here.
    title: "Guests",
    icon: Users,
    subItems: [
      { title: "Contact Book", icon: BookUser },
      { title: "Guest List", icon: Users },
      { title: "Who's Going", icon: CalendarCheck },
      { title: "Attendee Export", icon: Download },
      { title: "Segments", icon: ListChecks },
      { title: "Tags", icon: Tag },
      { title: "Notes", icon: StickyNote },
      { title: "Data Requests", icon: ShieldAlert },
    ],
  },

  {
    // Ticket Types is a reusable-records screen (create a ticket, attach to
    // events). The rest are GLOBAL, project-level records: create/manage
    // reusable coupons, rules, methods, policies and profiles here (each with
    // its own edit page), then attach them to an event from the event
    // editor's Ticketing section. See components/internal/screens/tickets/
    // and lib/supabase/ticketing.js.
    title: "Tickets",
    icon: Ticket,
    subItems: [
      { title: "Ticket Types", icon: Ticket },
      { title: "Ticket Tiers", icon: Layers },
      { title: "Discounts & Codes", icon: Percent },
      { title: "Bundles", icon: Package },
      { title: "Early-bird Sales", icon: Timer },
      { title: "Donations", icon: Heart },
      { title: "Group Purchasing", icon: Users },
      { title: "Access-code Tickets", icon: KeyRound },
      { title: "Reserved Seating", icon: Armchair },
      { title: "Anti-scalping & Resale", icon: ShieldAlert },
      { title: "Multi-currency", icon: Coins },
      { title: "Payments & Methods", icon: CreditCard },
      { title: "Payment Plans", icon: CalendarClock },
      { title: "Payouts", icon: Banknote },
      { title: "Dynamic Pricing", icon: TrendingUp },
      { title: "Refunds", icon: RotateCcw },
      { title: "Transfers", icon: Repeat },
      { title: "Taxes", icon: Scale },
      { title: "Orders & Attendees", icon: ShoppingBag },
      { title: "Invoices & Receipts", icon: FileText },
    ],
  },

  {
    // Orders — the operational cockpit for everything after checkout: viewing
    // orders, issuing full/partial refunds, cancellations, the money ledger,
    // receipts/invoices, and disputes. The Tickets area keeps the refund/order
    // *policy* config; this is the ops surface. Backed by events.event_orders +
    // order_refunds / order_events / order_disputes. Refunds record-only for now
    // (Stripe-ready hook in events.issue_order_refund).
    title: "Orders",
    icon: ShoppingBag,
    subItems: [
      { title: "All Orders", icon: ShoppingBag },
      { title: "Refunds & Cancellations", icon: RotateCcw },
      { title: "Transactions", icon: ArrowLeftRight },
      { title: "Billing & Receipts", icon: Receipt },
      { title: "Disputes & Chargebacks", icon: Scale },
      { title: "Order Settings", icon: Settings },
    ],
  },

  {
    // Memberships — recurring plans that unlock special pricing/access. Enabled
    // from Membership Settings (events.ticketing_settings, module 'membership');
    // plans are reusable records (ticketing_records module 'membership') that
    // attach to events. Members is the enrollment roster.
    title: "Memberships",
    icon: BadgeCheck,
    subItems: [
      { title: "Membership Plans", icon: BadgeCheck },
      { title: "Members", icon: Users },
      { title: "Membership Settings", icon: Settings },
    ],
  },

  {
    title: "Check-in",
    icon: QrCode,
    subItems: [
      { title: "QR Tickets", icon: QrCode },
      { title: "Wallet Passes", icon: Wallet },
      { title: "Check-in App", icon: ScanLine },
      { title: "Door Sales", icon: DoorOpen },
      { title: "Offline Check-in", icon: CloudOff },
      { title: "Kiosk Mode", icon: Monitor },
      { title: "Badge Printing", icon: Printer },
      { title: "Session Check-in", icon: Clock },
      { title: "Capacity Control", icon: Gauge },
      { title: "RFID / NFC", icon: Radio },
      { title: "Smart Badges", icon: Cpu },
      { title: "Self Check-in", icon: UserCheck },
      { title: "Multi-gate & Zones", icon: Map },
      { title: "Real-time Attendance", icon: Activity },
      { title: "Staff Scanning Roles", icon: Users },
      { title: "Lead Retrieval", icon: Contact },
      { title: "Name-search Lookup", icon: Search },
    ],
  },

  {
    title: "Analytics",
    icon: BarChart3,
    subItems: [
      { title: "Sales", icon: TrendingUp },
      { title: "Attendance", icon: UserCheck },
      { title: "Cross-event Reporting", icon: Layers },
      { title: "Traffic & Sources", icon: Activity },
      { title: "Email Performance", icon: Mail },
      { title: "Engagement", icon: Sparkles },
      { title: "Sponsor ROI", icon: Handshake },
      { title: "Real-time Dashboards", icon: Gauge },
      { title: "Scheduled Reports", icon: CalendarClock },
      { title: "Conversion Funnels", icon: Filter },
      { title: "Revenue Forecasting", icon: TrendingUp },
      { title: "Surveys & NPS", icon: ClipboardList },
      { title: "Demographics", icon: PieChart },
    ],
  },

  {
    title: "Campaigns",
    icon: Megaphone,
    subItems: [
      { title: "Newsletters", icon: Newspaper },
      { title: "Automated Reminders", icon: Bell },
      { title: "Email Invites", icon: Mail },
      { title: "Segmentation", icon: ListChecks },
      { title: "Email Template Builder", icon: LayoutTemplate },
      { title: "Drip Sequences", icon: Workflow },
      { title: "Send Scheduling", icon: Clock },
      { title: "Deliverability", icon: MailX },
    ],
  },

  {
    // Paid-ads wrapper — a layman-friendly control surface over the ad platforms
    // (Google AdSense, Facebook Marketplace, Google Ads, Meta Ads). Connections
    // links the platforms; Ad Campaigns / Budgets are reusable records; Insights
    // aggregates their performance. Backed by events.advertising_records.
    title: "Advertising",
    icon: BadgeDollarSign,
    subItems: [
      { title: "Connections", icon: Link2 },
      { title: "Ad Campaigns", icon: Megaphone },
      { title: "Budgets", icon: Wallet },
      { title: "Insights", icon: BarChart3 },
    ],
  },

  {
    // Automation engine. The builder (linear step list + drag-drop node canvas)
    // opens by selecting a workflow in All Workflows. Workflow Templates is a
    // curated starter gallery; Run History logs each workflow execution.
    title: "Workflows",
    icon: Workflow,
    subItems: [
      { title: "All Workflows", icon: Workflow },
      { title: "Workflow Templates", icon: LayoutTemplate },
      { title: "Run History", icon: History },
    ],
  },

  {
    // A single destination: the project's public organiser profile (rendered on
    // the /w/<slug> Event Wall) that buyers can follow for new-event updates.
    title: "Discovery",
    icon: Compass,
  },

  {
    title: "Community",
    icon: MessagesSquare,
    subItems: [
      { title: "Event Chat", icon: MessageSquare },
      { title: "Messages", icon: Send },
      { title: "Polls", icon: Vote },
      { title: "Surveys", icon: ClipboardList },
      { title: "Q&A", icon: HelpCircle },
      { title: "Meeting Scheduler", icon: CalendarClock },
      { title: "Announcements", icon: Megaphone },
      { title: "Discussion Boards", icon: MessageCircle },
    ],
  },

  {
    // The Conference domain, split into five focused areas (was one 21-item
    // group). All screens/data/permissions are unchanged — titles still match
    // SCREEN_REGISTRY keys exactly; only the sidebar grouping differs.
    // Program — the "what's on" layer: the schedule, the submissions that feed
    // it, each attendee's personal itinerary, and the credits earned.
    title: "Program",
    icon: CalendarClock,
    subItems: [
      { title: "Agenda Builder", icon: ClipboardList },
      { title: "Call for Papers", icon: FileText },
      { title: "Assign Agenda", icon: CalendarCheck },
      { title: "CEU & Certificates", icon: Award },
    ],
  },

  {
    // Speakers — the roster, their self-service submission portal, and the
    // green-room / run-of-show ops.
    title: "Speakers",
    icon: Mic,
    subItems: [
      { title: "Speakers", icon: Mic },
      { title: "Speaker Portal", icon: Contact },
      { title: "Speaker Backstage", icon: Clapperboard },
    ],
  },

  {
    // Sponsors & Expo — the commercial + exhibitor floor: who's paying, what
    // they get, and where they sit (virtual rooms and the physical booth map).
    title: "Sponsors & Expo",
    icon: Handshake,
    subItems: [
      { title: "Sponsors", icon: Handshake },
      { title: "Sponsorship Packages", icon: Package },
      { title: "Sponsor Rooms", icon: Building2 },
      { title: "Expo Booths", icon: Store },
      { title: "Floor Plan & Booths", icon: LayoutGrid },
    ],
  },

  {
    // Broadcast & On-demand — online delivery: live/virtual rooms, replays,
    // accessibility, and the app that surfaces it all.
    title: "Broadcast & On-demand",
    icon: Radio,
    subItems: [
      { title: "Livestream Rooms", icon: Radio },
      { title: "Webinar Rooms", icon: MonitorPlay },
      { title: "Breakout Rooms", icon: Network },
      { title: "Simulive & On-demand", icon: CirclePlay },
      { title: "Recordings & Replay", icon: Video },
      { title: "Captions & Transcription", icon: Captions },
      { title: "Mobile Event App", icon: Smartphone },
    ],
  },

  {
    // Logistics — physical-event operations kept out of the digital areas above.
    title: "Logistics",
    icon: Plane,
    subItems: [
      { title: "Venue Sourcing", icon: MapPin },
      { title: "Housing & Travel", icon: Plane },
    ],
  },

  {
    title: "Settings",
    icon: Settings,
    subItems: [
      { title: "Team & Members", icon: Users },
      { title: "Roles & Permissions", icon: ShieldCheck },
      { title: "API & Webhooks", icon: Webhook },
      { title: "Usage", icon: Gauge },
      { title: "Custom Domains", icon: Globe },
    ],
  },
];
