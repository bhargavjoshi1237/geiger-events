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
  Presentation,
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
  Plug,
  Webhook,
  Palette,
  Lock,
  Gauge,
  LayoutGrid,
  Zap,
  CalendarPlus,
  Image as ImageIcon,
  MapPin,
  Eye,
  Repeat,
  Copy,
  Link2,
  Globe,
  SquarePen,
  CalendarCheck,
  Map,
  Share2,
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
  FlaskConical,
  MailX,
  Tag,
  BellRing,
  Store,
  Network,
  Music,
  Vote,
  HelpCircle,
  Trophy,
  Clapperboard,
  SlidersHorizontal,
  MonitorPlay,
  MonitorUp,
  Building2,
  Plane,
  Smartphone,
  Award,
  CirclePlay,
  Captions,
  LifeBuoy,
  ScrollText,
  Activity,
  Download,
  StickyNote,
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
      { title: "Custom Report Builder", icon: FileText },
      { title: "Scheduled Reports", icon: CalendarClock },
      { title: "UTM Attribution", icon: Link2 },
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
      { title: "SMS Invites", icon: MessageSquare },
      { title: "WhatsApp Invites", icon: MessageCircle },
      { title: "Text Blasts", icon: Send },
      { title: "Segmentation", icon: ListChecks },
      { title: "Email Template Builder", icon: LayoutTemplate },
      { title: "Drip Sequences", icon: Workflow },
      { title: "A/B Testing", icon: FlaskConical },
      { title: "Send Scheduling", icon: Clock },
      { title: "Deliverability", icon: MailX },
      { title: "Personalization", icon: Tag },
      { title: "Push Notifications", icon: BellRing },
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
      { title: "Activity Feed", icon: Activity },
      { title: "Event Chat", icon: MessageSquare },
      { title: "Attendee Profiles", icon: Users },
      { title: "Photo Album", icon: ImageIcon },
      { title: "Shared Playlist", icon: Music },
      { title: "Polls", icon: Vote },
      { title: "Q&A", icon: HelpCircle },
      { title: "AI Matchmaking", icon: Sparkles },
      { title: "Visible Attendee List", icon: Eye },
      { title: "Mutual Connections", icon: Share2 },
      { title: "Meeting Scheduler", icon: CalendarClock },
      { title: "Direct Messaging", icon: Send },
      { title: "Live Reactions", icon: Heart },
      { title: "Moderation Tools", icon: ShieldCheck },
      { title: "Announcements", icon: Megaphone },
      { title: "Gamification", icon: Trophy },
      { title: "Discussion Boards", icon: MessageCircle },
    ],
  },

  {
    title: "Conference",
    icon: Presentation,
    subItems: [
      { title: "Agenda Builder", icon: ClipboardList },
      { title: "Speakers", icon: Mic },
      { title: "Sponsors", icon: Handshake },
      { title: "Recordings & Replay", icon: Video },
      { title: "Multi-track Sessions", icon: Layers },
      { title: "Speaker Backstage", icon: Clapperboard },
      { title: "Producer Controls", icon: SlidersHorizontal },
      { title: "Livestream Rooms", icon: Radio },
      { title: "Webinar Rooms", icon: MonitorPlay },
      { title: "Screen Sharing", icon: MonitorUp },
      { title: "Breakout Rooms", icon: Network },
      { title: "Expo Booths", icon: Store },
      { title: "Sponsor Rooms", icon: Building2 },
      { title: "Attendee Networking", icon: Users },
      { title: "Session Access Control", icon: Lock },
      { title: "Lead Capture", icon: ScanLine },
      { title: "Exhibitor QR Scanning", icon: QrCode },
      { title: "Venue Sourcing", icon: MapPin },
      { title: "Housing & Travel", icon: Plane },
      { title: "Call for Papers", icon: FileText },
      { title: "Speaker Portal", icon: Contact },
      { title: "Sponsorship Packages", icon: Package },
      { title: "Floor Plan & Booths", icon: LayoutGrid },
      { title: "My Agenda", icon: CalendarCheck },
      { title: "Mobile Event App", icon: Smartphone },
      { title: "CEU & Certificates", icon: Award },
      { title: "Simulive & On-demand", icon: CirclePlay },
      { title: "Captions & Transcription", icon: Captions },
      { title: "Gamification Passport", icon: Trophy },
    ],
  },

  {
    title: "Settings",
    icon: Settings,
    subItems: [
      { title: "Team & Members", icon: Users },
      { title: "Roles & Permissions", icon: ShieldCheck },
      { title: "Integrations", icon: Plug },
      { title: "API & Webhooks", icon: Webhook },
      { title: "Branding", icon: Palette },
      { title: "Security", icon: Lock },
      { title: "Billing & Plans", icon: CreditCard },
      { title: "Usage", icon: Gauge },
      { title: "Multi-event Dashboard", icon: LayoutGrid },
      { title: "SSO", icon: KeyRound },
      { title: "Support & SLA", icon: LifeBuoy },
      { title: "Audit Logs", icon: ScrollText },
      { title: "Custom Domains", icon: Globe },
    ],
  },
];
