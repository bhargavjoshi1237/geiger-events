"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Rocket,
  Ticket,
  Wallet,
  Users,
  Clock,
  MapPin,
  Map as MapIcon,
  ImageIcon,
  FileText,
  ClipboardList,
  SlidersHorizontal,
  Link2,
  Share2,
  CalendarCheck,
  Code,
  Languages,
  UserCog,
  Globe,
  Video,
  Repeat,
  LayoutDashboard,
  SquarePen,
  Palette,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  EVENT_STATUS_MAP,
  EVENT_TYPE_MAP,
  currency,
  formatDate,
} from "./sample_data";
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
import { CoHostsAdminsSection } from "./people";
import { EventPublicPage } from "./event_public_page";
import { PageDesignSection, defaultPageDesign } from "./page_design";

// Right-hand editor navigation — every per-event topic is its own entry,
// grouped the way the original sidebar grouped them.
const NAV_GROUPS = [
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
      },
      {
        key: "map",
        label: "Map & Directions",
        icon: MapIcon,
        desc: "Help attendees arrive — a pinned map, getting-there notes, and directions.",
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
      },
    ],
  },
  {
    group: "Registration",
    items: [
      {
        key: "questions",
        label: "Custom Questions",
        icon: ClipboardList,
        desc: "Collect exactly what you need at registration.",
      },
      {
        key: "regsettings",
        label: "Registration Settings",
        icon: SlidersHorizontal,
        desc: "Approval, waitlist, and what attendees see while registering.",
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
      },
      {
        key: "timezone",
        label: "Time-zone",
        icon: Globe,
        desc: "Show every attendee the right time.",
      },
      {
        key: "hybrid",
        label: "Hybrid Mode",
        icon: Video,
        desc: "Run in-person and online at once.",
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

function OverviewSection({ event, onPreview }) {
  const pct = event.capacity
    ? Math.min(100, Math.round((event.sold / event.capacity) * 100))
    : 0;

  const stats = [
    { label: "Tickets sold", value: event.sold.toLocaleString(), icon: Ticket, hint: `of ${event.capacity.toLocaleString()} capacity` },
    { label: "Revenue", value: currency(event.revenue), icon: Wallet, hint: "Gross, before fees" },
    { label: "Sell-through", value: `${pct}%`, icon: Users, hint: "Seats filled" },
    { label: "Visibility", value: event.visibility, icon: Eye, hint: "Who can find it" },
  ];

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <SectionCard title="Event page preview" bodyPadding={false}>
          <div className="p-4">
            <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border bg-surface-card text-text-tertiary">
              <ImageIcon className="h-8 w-8" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={EVENT_TYPE_MAP[event.type]?.variant || "neutral"}>
                  {event.type}
                </Badge>
                <StatusPill status={event.status} map={EVENT_STATUS_MAP} />
              </div>
              <h3 className="text-lg font-semibold text-white">{event.name}</h3>
              <div className="space-y-1.5 pt-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-text-secondary" />
                  {formatDate(event.date)} · {event.time}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-text-secondary" />
                  {event.venue}
                  {event.city && event.city !== "Remote" ? `, ${event.city}` : ""}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Publish">
          <p className="text-sm text-text-secondary">
            {event.status === "Draft"
              ? "This event is a draft. Publish it to start selling tickets."
              : "This event is live. Changes save instantly."}
          </p>
          <div className="mt-4 space-y-2">
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => toast.success(`"${event.name}" published.`)}
            >
              <Rocket className="h-4 w-4" /> Publish event
            </Button>
            <Button
              variant="outline"
              className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={onPreview}
            >
              <Eye className="h-4 w-4" /> Preview page
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

const SECTIONS = {
  overview: OverviewSection,
  basics: BasicsSection,
  cover: CoverMediaSection,
  description: RichDescriptionsSection,
  location: LocationTimeSection,
  map: MapDirectionsSection,
  tickets: TicketsSection,
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

export function EventDetailScreen({ event, onBack }) {
  const [active, setActive] = useState("overview");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [design, setDesign] = useState(defaultPageDesign);

  const activeItem = useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === active) ||
      NAV_GROUPS[0].items[0],
    [active],
  );

  if (!event) return null;

  const ActiveSection = SECTIONS[active] || OverviewSection;

  return (
    <MainScreenWrapper>
      {/* Editor header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mt-0.5 shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {event.name}
              </h1>
              <StatusPill status={event.status} map={EVENT_STATUS_MAP} />
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {formatDate(event.date)} · {event.time} · {event.venue}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Changes saved.")}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Content (left) + section nav (right) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              {activeItem.label}
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
          </div>
          {active === "design" ? (
            <PageDesignSection
              design={design}
              onChange={setDesign}
              onPreview={() => setPreviewOpen(true)}
            />
          ) : (
            <ActiveSection
              event={event}
              onPreview={() => setPreviewOpen(true)}
            />
          )}
        </div>

        <aside className="order-1 lg:order-2">
          <nav className="space-y-5 lg:sticky lg:top-4">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.group || `g${gi}`}>
                {group.group ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {group.group}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActive(item.key)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-surface-card font-medium text-white"
                            : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-white" : "text-text-secondary",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>

      {previewOpen ? (
        <EventPublicPage
          event={event}
          design={design}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default EventDetailScreen;
