import {
  LayoutDashboard,
  BellRing,
  SquarePen,
  Palette,
  ImageIcon,
  FileText,
  Clock,
  Users,
  MapPin,
  Map as MapIcon,
  Ticket,
  BadgeCheck,
  Package,
  CalendarClock,
  ShoppingBag,
  Receipt,
  ShieldAlert,
  Coins,
  TrendingUp,
  ClipboardList,
  MailCheck,
  SlidersHorizontal,
  Link2,
  Share2,
  CalendarCheck,
  Code,
  Languages,
  UserCog,
  Eye,
  Globe,
  Video,
  Repeat,
  Accessibility,
  ScanLine,
  DoorOpen,
  Timer,
  Heart,
  KeyRound,
  Armchair,
  Store,
  MessagesSquare,
  Mic,
  Handshake,
  Sparkles,
  HelpCircle,
  Info,
  PlayCircle,
  LayoutGrid,
  IdCard,
  MousePointerClick,
  Gem,
  MessageSquareWarning,
} from "lucide-react";

import {
  BasicsSection,
  RegistrationSettingsSection,
} from "./event_builder";
import {
  CoverMediaSection,
  RichDescriptionsSection,
  CustomQuestionsSection,
} from "./content_media";
import {
  LocationTimeSection,
  MapDirectionsSection,
  TimezoneSupportSection,
} from "./location_time";
import { VisibilitySection, CustomUrlSection } from "./publishing";
import {
  AddToCalendarSection,
  EmbeddableWidgetSection,
  SeoSharingSection,
  LocalizationSection,
  HybridModeSection,
} from "./distribution";
import { RecurringEventsSection } from "./recurring_clone";
import { HighlightsSection, FaqSection, OnDemandVideoSection } from "./event_content";
import { InfographicsSection } from "./infographics";
import { ScheduleSection } from "./schedule";
import { GuestsSection } from "./guests";
import { OfferingsSection } from "./offerings";
import { SlotsSection } from "./slots";
import { PurchasablesSection } from "./purchasables";
import { EventDiscountsSection } from "./event_discounts";
import { EventEarlybirdSection } from "./event_earlybird";
import { EventDonationSection } from "./event_donation";
import { EventAccessCodesSection } from "./event_access_codes";
import { EventReservedSection } from "./event_reserved";
import { EventSeatingSection } from "./event_seating";
import { TicketSelectionSection } from "./ticket_selection";
import { EventExpoSection } from "./event_expo";
import { EventGroupSection } from "./event_group";
import { EventBundlesSection } from "./event_bundles";
import { PaymentsSection } from "./payments";
import { RsvpOptionsSection } from "./rsvp";
import { CoHostsAdminsSection } from "./people";
import { OverviewSection } from "./overview";
import { AlertsSection } from "./alerts";
import { EventBadgeSection } from "./event_badge";
import { GuidelinesSection } from "./guidelines";
import { PageNotesSection } from "./page_notes";
import { PageDisclaimerSection } from "./page_disclaimer";
import { EventCtasSection } from "./event_ctas";
import { EventPackagesSection } from "./event_packages";
import { EventPackagesPageSection } from "./packages_page_editor";
import { PACKAGES_ADDON_ID } from "@/lib/events/packages";
import {
  EventCurrenciesSection,
  EventInvoicesSection,
  EventOrdersSection,
  EventPricingSection,
  EventResaleSection,
} from "../tickets/event_policies";
import { EventTicketsSection } from "../tickets/event_tickets";
import { TicketRulesSection } from "../tickets/event_ticket_rules";
import { EventMembershipsSection } from "./event_memberships";
import { EventCommunicationSection } from "./event_communication";
import {
  EventSpeakersSection,
  EventSponsorsSection,
} from "./event_conference";
import {
  CheckinOptionsSection,
  GatesZonesSection,
  SessionsSection,
  DoorKioskSection,
} from "./checkin_section";

export const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        desc: "A snapshot of this event — sales, preview, and publish controls.",
      },
      {
        key: "alerts",
        label: "Alerts",
        icon: BellRing,
        desc: "Get emailed when a milestone or threshold needs your attention.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "General",
    items: [
      {
        key: "basics",
        label: "Event details",
        icon: SquarePen,
        desc: "Name, organizer, summary, and format for this event.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Design",
    items: [
      {
        key: "design",
        label: "Page design",
        icon: Palette,
        desc: "Choose how your public page looks — standard, themed, or custom.",
      },
    ],
  },
  {
    group: "Page",
    items: [
      {
        key: "cover",
        label: "Cover Media",
        icon: ImageIcon,
        desc: "The hero image and gallery shown on your event page and in social shares.",
      },
      {
        key: "description",
        label: "Rich Description",
        icon: FileText,
        desc: "Tell attendees what to expect. Format with headings, lists, and links.",
      },
      {
        key: "highlights",
        label: "What to Expect",
        icon: Sparkles,
        desc: "The handful of things attendees get out of this event, shown as a highlights card on your page.",
        ownHeader: true,
      },
      {
        key: "schedule",
        label: "Schedule",
        icon: Clock,
        desc: "Lay out your event's running order — each item with a title, description, and image.",
        ownHeader: true,
      },
      {
        key: "faq",
        label: "FAQ",
        icon: HelpCircle,
        desc: "Answer the questions buyers ask before they commit — shown as an expandable list on your page.",
        ownHeader: true,
      },
      {
        key: "notes",
        label: "Section Notes",
        icon: Info,
        desc: "Attach a short note to any page section — it shows as an “i” next to the section's heading.",
      },
      {
        key: "disclaimer",
        label: "Disclaimer",
        icon: MessageSquareWarning,
        desc: "Clear fine print you can type out and place anywhere on the page or inside checkout — above the footer, under the pay button, and more.",
        ownHeader: true,
      },
      {
        key: "guests",
        label: "Guests",
        icon: Users,
        desc: "Feature speakers and special guests on your public event page.",
        ownHeader: true,
      },
      {
        key: "speakers",
        label: "Speakers",
        icon: Mic,
        desc: "Attach speakers from your Conference roster to this event's line-up.",
        ownHeader: true,
      },
      {
        key: "sponsors",
        label: "Sponsors",
        icon: Handshake,
        desc: "Attach the sponsors backing this event — shown on the page and in reporting.",
        ownHeader: true,
      },
      {
        key: "video",
        label: "On-demand Video",
        icon: PlayCircle,
        desc: "Add videos attendees can watch any time — replays, trailers, or walkthroughs, linked from YouTube, Vimeo, or a direct file.",
        ownHeader: true,
      },
      {
        key: "infographics",
        label: "Infographics",
        icon: LayoutGrid,
        desc: "Add infographic blocks to your page — carousels, split CTAs, quotes, footer bands, and info showcases with grid or flex layouts.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Location",
    items: [
      {
        key: "location",
        label: "Location & Time",
        icon: MapPin,
        desc: "Where and when your event happens — venue, doors, and start/end times.",
        ownHeader: true,
      },
      {
        key: "map",
        label: "Map & Directions",
        icon: MapIcon,
        desc: "Help attendees arrive — a pinned map, getting-there notes, and directions.",
        ownHeader: true,
      },
      {
        key: "guidelines",
        label: "Dietary & Accessibility",
        icon: Accessibility,
        desc: "Guidelines shown on your event page, plus the post-purchase request opt-in.",
      },
    ],
  },
  {
    group: "Tickets",
    items: [
      {
        key: "tickets",
        label: "Tickets",
        icon: Ticket,
        desc: "The tickets buyers can purchase for this event.",
        ownHeader: true,
      },
      {
        key: "seating",
        label: "Seating",
        icon: Armchair,
        desc: "Sell assigned seats from one of the venue's seat maps — sections, rows and chairs.",
        ownHeader: true,
      },
      {
        key: "expo",
        label: "Exhibitor Floor",
        icon: Store,
        desc: "Sell exhibitor booths from one of the venue's hall plans — stalls, zones and aisles.",
        ownHeader: true,
      },
      {
        key: "offerings",
        label: "Offerings",
        icon: Package,
        desc: "Add-ons and choices buyers pick at checkout — optionally priced and ticket-based.",
        ownHeader: true,
      },
      {
        key: "packages",
        label: "Packages",
        icon: Gem,
        desc: "Premium bundles — VIP tiers with their own inclusions and pricing, sold from this event's packages page.",
        ownHeader: true,
        showIf: (e, ctx) => !!ctx?.isEnabled?.(PACKAGES_ADDON_ID),
      },
      {
        key: "packagespage",
        label: "Packages Page",
        icon: Gem,
        desc: "The standalone page your packages sell from — its copy, its sections, and its own design.",
        ownHeader: true,
        showIf: (e, ctx) => !!ctx?.isEnabled?.(PACKAGES_ADDON_ID),
      },
      {
        key: "ctas",
        label: "Call to action",
        icon: MousePointerClick,
        desc: "The buttons on your tickets card — Get Tickets is always there; add your own beneath it for waitlists, enquiries, or sponsor packs.",
      },
      {
        key: "ticketselection",
        label: "Ticket Selection",
        icon: Armchair,
        desc: "Offer two routes on the tickets card — seat selection via the seating plan, or selection by price.",
      },
      {
        key: "slots",
        label: "Slots",
        icon: CalendarClock,
        desc: "Let buyers book a time slot at checkout — each with its own capacity, price, and rules.",
        ownHeader: true,
      },
      {
        key: "purchasables",
        label: "Purchasables",
        icon: ShoppingBag,
        desc: "Conditional add-ons shown after ticket details — surfaced only when your rules (slot, ticket, quantity…) match.",
        ownHeader: true,
      },
      {
        key: "ticketrules",
        label: "Ticket Rules",
        icon: SlidersHorizontal,
        desc: "Turn project-wide ticketing features (early-bird, donations, reserved seating…) on for this event.",
        ownHeader: true,
      },
      {
        key: "earlybird",
        label: "Early-bird",
        icon: Timer,
        desc: "Discount the ticket price during a limited window.",
        ownHeader: true,
        showIf: (e) => !!e.ticketRules?.earlybird,
      },
      {
        key: "donation",
        label: "Donations",
        icon: Heart,
        desc: "Ask buyers to add a donation at checkout.",
        ownHeader: true,
        showIf: (e) => !!e.ticketRules?.donation,
      },
      {
        key: "accesscode",
        label: "Access Codes",
        icon: KeyRound,
        desc: "Hide tickets behind a code buyers unlock on the page.",
        ownHeader: true,
        showIf: (e) => !!e.ticketRules?.accessCode,
      },
      {
        key: "reserved",
        label: "Reserved Seating",
        icon: Armchair,
        desc: "Hold back a block of tickets from public sale.",
        ownHeader: true,
        showIf: (e) => !!e.ticketRules?.reservedSeating,
      },
      {
        key: "group",
        label: "Group Orders",
        icon: Users,
        desc: "Buy a block and dispense a ticket to each attendee's email.",
        ownHeader: true,
        showIf: (e) => !!e.ticketRules?.groupPurchase,
      },
      {
        key: "memberships",
        label: "Memberships",
        icon: BadgeCheck,
        desc: "Enable membership plans for this event — members get the plan's discount here.",
        ownHeader: true,
      },
    ],
  },
  // Extracted out of Tickets and kept ungrouped on purpose: each of these is a
  // top-level entry in its own right, and bucketing them back under a heading
  // recreated the oversized Tickets list they were pulled out of.
  {
    group: null,
    items: [
      {
        key: "orders",
        label: "Orders & Attendees",
        icon: ShoppingBag,
        desc: "Who bought tickets, what they paid, and the order policy governing refunds and transfers.",
        ownHeader: true,
      },
    ],
  },
  {
    group: null,
    items: [
      {
        key: "invoices",
        label: "Invoices & Receipts",
        icon: Receipt,
        desc: "The invoice profile behind this event's tax documents and what prints on every receipt.",
        ownHeader: true,
      },
    ],
  },
  {
    group: null,
    items: [
      {
        key: "resale",
        label: "Anti-scalping & Resale",
        icon: ShieldAlert,
        desc: "Rules that curb scalping — name locks, ID checks, transfer policy, and resale caps.",
        ownHeader: true,
      },
    ],
  },
  {
    group: null,
    items: [
      {
        key: "currency",
        label: "Multi-currency",
        icon: Coins,
        desc: "Currencies buyers can pay in, with their conversion rates and settlement accounts.",
        ownHeader: true,
      },
    ],
  },
  {
    group: null,
    items: [
      {
        key: "pricing",
        label: "Dynamic Pricing",
        icon: TrendingUp,
        desc: "Demand-based rules that move the ticket price as the event sells through.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Registration",
    items: [
      {
        key: "rsvp",
        label: "RSVP Options",
        icon: MailCheck,
        desc: "Let attendees respond to your event — set how RSVPs are collected, capped, and confirmed.",
        ownHeader: true,
      },
      {
        key: "questions",
        label: "Custom Questions",
        icon: ClipboardList,
        desc: "Collect exactly what you need at registration.",
        ownHeader: true,
      },
      {
        key: "regsettings",
        label: "Registration Settings",
        icon: SlidersHorizontal,
        desc: "Approval, waitlist, and what attendees see while registering.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Check-in",
    items: [
      {
        key: "checkinoptions",
        label: "Check-in options",
        icon: ScanLine,
        desc: "QR on tickets, wallet passes, self check-in, and how staff admit attendees.",
        ownHeader: true,
      },
      {
        key: "gateszones",
        label: "Multi-gate & Zones",
        icon: MapIcon,
        desc: "Create the entrances and restricted areas for this event, turn them on or off, or remove them.",
        ownHeader: true,
      },
      {
        key: "sessions",
        label: "Sessions",
        icon: Clock,
        desc: "Break this event into sessions staff can check attendees into separately.",
        ownHeader: true,
      },
      {
        key: "doorkiosk",
        label: "Door Sales & Kiosk",
        icon: DoorOpen,
        desc: "On-site sales, self-service kiosk, and tap-to-enter for this event.",
        ownHeader: true,
      },
      {
        key: "badge",
        label: "Badge Printing",
        icon: IdCard,
        desc: "Print attendee passes for this event and choose the design they print on.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Communication",
    items: [
      {
        key: "communication",
        label: "Communication",
        icon: MessagesSquare,
        desc: "A group chat for this event's ticket buyers — opens when you publish and grows as tickets sell. Attendees use it from their members portal.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Sharing",
    items: [
      {
        key: "url",
        label: "Custom URL",
        icon: Link2,
        desc: "Give your event a clean, memorable link.",
        ownHeader: true,
      },
      {
        key: "seo",
        label: "SEO & Sharing",
        icon: Share2,
        desc: "How your event looks in search results and social shares.",
      },
      {
        key: "calendar",
        label: "Add to Calendar",
        icon: CalendarCheck,
        desc: "Let attendees save your event to their calendar with one tap.",
      },
      {
        key: "embed",
        label: "Embeddable Widget",
        icon: Code,
        desc: "Sell tickets and collect RSVPs from your own website.",
      },
      {
        key: "localization",
        label: "Localization",
        icon: Languages,
        desc: "Translate your event page and emails for a wider audience.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Team",
    items: [
      {
        key: "team",
        label: "Co-hosts & Admins",
        icon: UserCog,
        desc: "Invite teammates and assign roles to help run this event.",
        ownHeader: true,
      },
    ],
  },
  {
    group: "Settings",
    items: [
      {
        key: "visibility",
        label: "Visibility",
        icon: Eye,
        desc: "Control who can find and access your event.",
        ownHeader: true,
      },
      {
        key: "timezone",
        label: "Time-zone",
        icon: Globe,
        desc: "Show every attendee the right time.",
        ownHeader: true,
      },
      {
        key: "hybrid",
        label: "Hybrid Mode",
        icon: Video,
        desc: "Run in-person and online at once.",
        ownHeader: true,
      },
      {
        key: "recurring",
        label: "Recurring Events",
        icon: Repeat,
        desc: "Repeat this event on a schedule.",
      },
    ],
  },
];

export const SECTIONS = {
  overview: OverviewSection,
  alerts: AlertsSection,
  basics: BasicsSection,
  cover: CoverMediaSection,
  description: RichDescriptionsSection,
  highlights: HighlightsSection,
  schedule: ScheduleSection,
  faq: FaqSection,
  notes: PageNotesSection,
  disclaimer: PageDisclaimerSection,
  video: OnDemandVideoSection,
  infographics: InfographicsSection,
  guests: GuestsSection,
  speakers: EventSpeakersSection,
  sponsors: EventSponsorsSection,
  location: LocationTimeSection,
  map: MapDirectionsSection,
  guidelines: GuidelinesSection,
  tickets: EventTicketsSection,
  offerings: OfferingsSection,
  packages: EventPackagesSection,
  packagespage: EventPackagesPageSection,
  ctas: EventCtasSection,
  ticketselection: TicketSelectionSection,
  slots: SlotsSection,
  purchasables: PurchasablesSection,
  discounts: EventDiscountsSection,
  earlybird: EventEarlybirdSection,
  donation: EventDonationSection,
  accesscode: EventAccessCodesSection,
  reserved: EventReservedSection,
  seating: EventSeatingSection,
  expo: EventExpoSection,
  group: EventGroupSection,
  bundles: EventBundlesSection,
  payments: PaymentsSection,
  orders: EventOrdersSection,
  invoices: EventInvoicesSection,
  resale: EventResaleSection,
  currency: EventCurrenciesSection,
  pricing: EventPricingSection,
  ticketrules: TicketRulesSection,
  memberships: EventMembershipsSection,
  communication: EventCommunicationSection,
  rsvp: RsvpOptionsSection,
  questions: CustomQuestionsSection,
  regsettings: RegistrationSettingsSection,
  checkinoptions: CheckinOptionsSection,
  gateszones: GatesZonesSection,
  sessions: SessionsSection,
  doorkiosk: DoorKioskSection,
  badge: EventBadgeSection,
  url: CustomUrlSection,
  seo: SeoSharingSection,
  calendar: AddToCalendarSection,
  embed: EmbeddableWidgetSection,
  localization: LocalizationSection,
  team: CoHostsAdminsSection,
  visibility: VisibilitySection,
  timezone: TimezoneSupportSection,
  hybrid: HybridModeSection,
  recurring: RecurringEventsSection,
};
