// Right-hand editor navigation + section registry for the event editor.
//
// Split out of event_detail.jsx so the editor shell stays lean: this file owns
// the per-event topic list (NAV_GROUPS) and the title → component map (SECTIONS).
// Each section component lives in its own file; add a topic by importing its
// component, adding a NAV_GROUPS entry, and mapping it here by `key`.

import {
  LayoutDashboard,
  SquarePen,
  Palette,
  ImageIcon,
  FileText,
  Clock,
  Users,
  MapPin,
  Map as MapIcon,
  Ticket,
  Package,
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
} from "lucide-react";

import {
  BasicsSection,
  TicketsSection,
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
import { ScheduleSection } from "./schedule";
import { GuestsSection } from "./guests";
import { OfferingsSection } from "./offerings";
import { RsvpOptionsSection } from "./rsvp";
import { CoHostsAdminsSection } from "./people";
import { OverviewSection } from "./overview";

// Per-event topics, grouped the way the original sidebar grouped them. `key`
// must match a SECTIONS entry; `ownHeader` sections render their own title row.
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
    ],
  },
  {
    group: "General",
    items: [
      {
        key: "basics",
        label: "Event details",
        icon: SquarePen,
        desc: "Name, summary, and format for this event.",
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
        key: "schedule",
        label: "Schedule",
        icon: Clock,
        desc: "Lay out your event's running order — each item with a title, description, and image.",
        ownHeader: true,
      },
      {
        key: "guests",
        label: "Guests",
        icon: Users,
        desc: "Feature speakers and special guests on your public event page.",
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
        // Renders its own header so the location-mode tabs can sit beside the title.
        ownHeader: true,
      },
      {
        key: "map",
        label: "Map & Directions",
        icon: MapIcon,
        desc: "Help attendees arrive — a pinned map, getting-there notes, and directions.",
        // Renders its own header so the Re-detect action can sit beside the title.
        ownHeader: true,
      },
    ],
  },
  {
    group: "Tickets",
    items: [
      {
        key: "tickets",
        label: "Ticket Types",
        icon: Ticket,
        desc: "The ticket tiers attendees can buy.",
        // Renders its own header so the tier stats can sit beside the title.
        ownHeader: true,
      },
      {
        key: "offerings",
        label: "Offerings",
        icon: Package,
        desc: "Add-ons and choices buyers pick at checkout — optionally priced and ticket-based.",
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

// title key → section component. Unmapped keys fall back to Overview.
export const SECTIONS = {
  overview: OverviewSection,
  basics: BasicsSection,
  cover: CoverMediaSection,
  description: RichDescriptionsSection,
  schedule: ScheduleSection,
  guests: GuestsSection,
  location: LocationTimeSection,
  map: MapDirectionsSection,
  tickets: TicketsSection,
  offerings: OfferingsSection,
  rsvp: RsvpOptionsSection,
  questions: CustomQuestionsSection,
  regsettings: RegistrationSettingsSection,
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
