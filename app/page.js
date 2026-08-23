import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Ticket,
  Users,
  MapPin,
  BarChart3,
  Bell,
  ShieldCheck,
  LayoutGrid,
  LineChart,
  Quote,
} from "lucide-react";
import Footer from "@/components/ui/footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Header } from "@/components/header";
import EventsPlaygroundShowcase from "@/components/EventsPlaygroundShowcase";
import SpotlightShowcase from "@/components/landing/spotlight_showcase";
import PosterFieldCta from "@/components/landing/poster_field_cta";
import DeviceFrame from "@/components/landing/device_frame";
import {
  FunnelSpotlight,
  SegmentSpotlight,
  WorkflowSpotlight,
} from "@/components/landing/spotlight_demos";
import {
  ApprovalQueueDemo,
  DoorDemo,
  EventPageDemo,
  ExpoFloorDemo,
  LiveAttendanceDemo,
  PortalDemo,
  RegistrationFormDemo,
  SeatMapDemo,
  StaffDeskDemo,
  WaitlistDemo,
} from "@/components/landing/showcase_demos";
import {
  AgendaBuilderDemo,
  CallForPapersDemo,
  CampaignsAdvertisingDemo,
  CaptionsDemo,
  DiscoveryDemo,
  DisputesDemo,
  HousingTravelDemo,
  InstantBookDemo,
  LivestreamDemo,
  MeetingSchedulerDemo,
  OnDemandDemo,
  OrdersCockpitDemo,
  PollsDemo,
  QADemo,
  RefundsDemo,
  RunManyEventsDemo,
  SpeakersCEUDemo,
  VenueLibraryDemo,
  VenueSourcingDemo,
} from "@/components/landing/showcase_demos_more";

export const metadata = {
  title: "Events - Geiger Studio",
  description:
    "Plan, run, and relive every event. Build schedules, manage attendees, and keep your team aligned with Geiger Events.",
};

const showcaseBackgroundImages = [
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-00a586c62c8782e65c0a.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/internal-brand-023-3291bb4c.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-0ec1f3ba625f482c9dc3.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-85923e7fafe00c9c0d1f.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-8e2e88cff7f33224ddd7.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-0a66efa21dd4b7e6c526.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-cc24ca462279ca23250c.jpg",
];

function pickRandomShowcaseBackground() {
  return showcaseBackgroundImages[Math.floor(Math.random() * showcaseBackgroundImages.length)];
}

const utilityCards = [
  {
    title: "Ticketing & Registration",
    description:
      "Sell tickets, collect RSVPs, and manage capacity without leaving your workspace.",
    icon: Ticket,
  },
  {
    title: "Schedules & Agendas",
    description:
      "Build multi-track agendas, sessions, and timelines that update in real time.",
    icon: CalendarDays,
  },
  {
    title: "Attendee Management",
    description:
      "Track guests, check-ins, and communications from a single source of truth.",
    icon: Users,
  },
  {
    title: "Venues & Logistics",
    description:
      "Map rooms, resources, and vendors so nothing falls through the cracks.",
    icon: MapPin,
  },
  {
    title: "Live Insights",
    description:
      "Watch attendance, engagement, and revenue as your event unfolds.",
    icon: BarChart3,
  },
  {
    title: "Reminders & Updates",
    description:
      "Keep attendees and your team in sync with timely notifications.",
    icon: Bell,
  },
];

// Alternating text/playground spotlights that tell the end-to-end story. Each
// carries a live, focused 1:1 preview of the real app surface it describes.
const spotlights = [
  {
    background: showcaseBackgroundImages[2],
    ctaLabel: "Checkout Workflows",
    title: "Events turn orders into follow-through",
    body: "Chain a trigger to the work it should kick off — welcome the VIPs, wait three days, tag the buyer, ping the crew channel. Build it once from the trigger, condition, and action catalog, then let it run on every order without anyone remembering to.",
    playground: WorkflowSpotlight,
  },
  {
    background: showcaseBackgroundImages[4],
    ctaLabel: "Checkout Segments",
    title: "Segment your audience down to the person",
    body: "Stack rules over ticket type, attendance history, spend, and tags, and watch the matching audience resolve as you go. No exports, no guesswork — the segment you just built is the list your campaign sends to.",
    playground: SegmentSpotlight,
  },
  {
    background: showcaseBackgroundImages[6],
    ctaLabel: "Checkout Analytics",
    title: "See exactly where your sales come from",
    body: "Follow every visitor from page view to paid ticket, split by the channel that brought them. The drop-off between two steps is the difference between a sold-out show and a half-empty room — so we make it impossible to miss.",
    playground: FunnelSpotlight,
  },
];

// Surface showcase — the four places an event actually happens. Each carries a
// hands-on miniature in the device chrome of that surface, so the frame says
// "browser / door tablet / phone / staff workstation" before the copy does.
const surfaces = [
  {
    title: "Event page",
    description: "One link that sells: tiers, add-ons, discounts, and checkout.",
    cta: "Explore event pages",
    frame: "browser",
    chrome: "geiger.events/e/nightshift-2026",
    demo: EventPageDemo,
  },
  {
    title: "The door",
    description:
      "Scan QR and wallet passes, sell at the door, keep going offline.",
    cta: "See check-in",
    frame: "tablet",
    demo: DoorDemo,
  },
  {
    title: "Attendee pocket",
    description:
      "A members portal and branded event app — agenda, tickets, live rooms.",
    cta: "Open the portal",
    frame: "phone",
    demo: PortalDemo,
  },
  {
    title: "Staff desk",
    description:
      "Hand out merch, badges, and perks — with double-collect blocked.",
    cta: "See issuing",
    frame: "window",
    chrome: "Issuing desk",
    demo: StaffDeskDemo,
  },
];

// Registrations showcase — the apply-to-attend path, for the events where a
// ticket isn't the thing standing between someone and the door.
const registrationFeatures = [
  {
    title: "Registration forms",
    description:
      "Ask what you actually need to decide. Fields, types, and what's required — no separate form tool to reconcile later.",
    cta: "Build a form",
    demo: RegistrationFormDemo,
  },
  {
    title: "Approval gates",
    description:
      "Every application lands in one queue with the answers attached. Approve, decline, and the invite goes out on the same click.",
    cta: "See approvals",
    demo: ApprovalQueueDemo,
  },
  {
    title: "Waitlist & capacity",
    description:
      "Set the ceiling once and let the room police itself. A refund frees a seat and the next person in line is invited automatically.",
    cta: "See the waitlist",
    demo: WaitlistDemo,
  },
];

// Sourcing showcase — the decision that comes before the ticket: where the
// event happens, how it's booked, and how everyone gets there.
const sourcingFeatures = [
  {
    title: "Venue sourcing",
    description:
      "Filter by city, capacity, and budget over a map that's already live — then shortlist without a single email.",
    cta: "See sourcing",
    demo: VenueSourcingDemo,
  },
  {
    title: "Instant Book",
    description:
      "Real availability, one confirmed rate, and a booking that's done before the intro call would have started.",
    cta: "Book a venue",
    demo: InstantBookDemo,
  },
  {
    title: "Housing & travel",
    description:
      "Room blocks release with the ticket, and the airport shuttle sells right beside them.",
    cta: "See room blocks",
    demo: HousingTravelDemo,
  },
  {
    title: "Venue library",
    description:
      "Venues live once as reusable records — any event can pick one and the location fills itself in.",
    cta: "Open the library",
    demo: VenueLibraryDemo,
  },
];

// Program showcase — the conference story after ticketing: the agenda that
// carries the content, the papers that feed it, and the credits it earns.
const programFeatures = [
  {
    title: "Agenda builder",
    description:
      "Sessions, speakers, and tracks on one grid — with double-bookings flagged the moment they happen.",
    cta: "Build an agenda",
    demo: AgendaBuilderDemo,
  },
  {
    title: "Call for papers",
    description:
      "Submissions land in one review queue with the speaker and track attached. Accept, and it's on the agenda.",
    cta: "Open submissions",
    demo: CallForPapersDemo,
  },
  {
    title: "Speakers & CEU",
    description:
      "The roster, the green room, and the credits attendees earn — speakers folded into the program, not stranded beside it.",
    cta: "See the run of show",
    demo: SpeakersCEUDemo,
  },
];

// Community showcase — the engagement that keeps an event alive between
// sessions: questions, polls, and the meetings that would otherwise wait.
const communityFeatures = [
  {
    title: "Q&A upvoting",
    description:
      "The room votes questions to the top, and answered ones carry the check so nothing gets asked twice.",
    cta: "Join the Q&A",
    demo: QADemo,
  },
  {
    title: "Live poll results",
    description:
      "Ask once and render as the votes land — the whole audience sees the same numbers on stage and in the app.",
    cta: "Run a poll",
    demo: PollsDemo,
  },
  {
    title: "Meeting scheduler",
    description:
      "Speakers publish office hours, attendees take a slot, and both sides get the calendar invite.",
    cta: "Book a meeting",
    demo: MeetingSchedulerDemo,
  },
];

// Broadcast showcase — the online delivery that makes an event hybrid without
// a second vendor: live rooms, replays, and captions under one roof.
const broadcastFeatures = [
  {
    title: "Livestream rooms",
    description:
      "Stage, sponsor, and breakout rooms live in the same place as the tickets — presence and chat included.",
    cta: "Open a room",
    demo: LivestreamDemo,
  },
  {
    title: "On-demand library",
    description:
      "Every session stays watchable after the room empties, gated however you like.",
    cta: "Browse replays",
    demo: OnDemandDemo,
  },
  {
    title: "Captions & transcription",
    description:
      "Auto-captions and a searchable transcript from the moment the talk starts speaking.",
    cta: "See captions",
    demo: CaptionsDemo,
  },
];

// Orders showcase — the operations that answer "what happens after money
// moves": the cockpit, the refund path, and the disputes.
const ordersFeatures = [
  {
    title: "Order cockpit",
    description:
      "Every order and its state in one list — paid, partial, refunded, disputed — with the money visible beside it.",
    cta: "Open the cockpit",
    demo: OrdersCockpitDemo,
  },
  {
    title: "Refunds & cancellations",
    description:
      "Full or partial, with the policy attached and the refund path visible before you click.",
    cta: "Issue a refund",
    demo: RefundsDemo,
  },
  {
    title: "Disputes & chargebacks",
    description:
      "Evidence windows are real, so the queue shows the deadline — and auto-defends from your ticket policy.",
    cta: "See disputes",
    demo: DisputesDemo,
  },
];

// Distribution & growth showcase — the single cards that get the word out and
// get found: campaigns with advertising folded in, and the wall buyers follow.
const growthFeatures = [
  {
    title: "Campaigns & advertising",
    description:
      "Newsletters, reminders, and paid ads under one roof — with the ad budget you can actually see.",
    cta: "See campaigns",
    demo: CampaignsAdvertisingDemo,
  },
  {
    title: "Discovery & distribution",
    description:
      "An organizer profile and a public event wall buyers follow, so the next event sells before you announce it.",
    cta: "See the wall",
    demo: DiscoveryDemo,
  },
];

// Feature-detail card: the same copy block as ShowcaseCard, but the preview sits
// on a bare shelf with no device chrome — these are a detail of one feature, not
// a whole surface, and the flatter treatment keeps them from competing with the
// framed miniatures above.
function FeatureCard({ title, description, cta, href, backgroundImage, children }) {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-sm border border-border bg-[#191919] bg-cover bg-center bg-no-repeat"
      style={backgroundImage ? { backgroundImage: `url('${backgroundImage}')` } : undefined}
    >
      {backgroundImage ? <div className="absolute inset-0 bg-[#080808]/80" /> : null}
      <div className="relative z-10 p-5">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#ee6b3b] transition-colors hover:text-[#ff8052]"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="relative z-10 mx-5 mb-5 mt-auto h-[300px] overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.05] backdrop-blur-sm">
        {children}
      </div>
    </article>
  );
}

// Depth showcase — the capabilities large-format organizers shop for, which
// smaller events never need to touch.
const scaleFeatures = [
  {
    title: "Assigned Seating",
    description:
      "Draw the bowl once, then sell it seat by seat. Every pick takes a timed hold, so two buyers can never land on the same chair.",
    cta: "See seating",
    frame: "window",
    chrome: "Seat map · Lower bowl",
    demo: SeatMapDemo,
  },
  {
    title: "Expo & Sponsors",
    description:
      "Sell the floor like inventory. Booths, packages, and sponsor rooms priced by size, held on a clock, and tracked to floor value.",
    cta: "See the expo floor",
    frame: "window",
    chrome: "Floor plan · Hall 2",
    demo: ExpoFloorDemo,
  },
  {
    title: "Live Operations",
    description:
      "Watch the room fill in real time. Gates, zones, and session capacity update as the scans land, so you move staff before a queue forms.",
    cta: "See live ops",
    frame: "window",
    chrome: "Live ops",
    demo: LiveAttendanceDemo,
  },
  {
    title: "Run Events",
    description:
      "Templates, series, and a public event wall — spin up the next date from the last one, and let buyers follow your whole season.",
    cta: "See templates",
    frame: "window",
    chrome: "Templates · Series · Wall",
    demo: RunManyEventsDemo,
  },
];

// Card chrome shared by both showcases: copy on top, then the miniature on a
// lighter shelf inside its device frame. The shelf and the frame are what make
// the preview read as a screenshot of a surface rather than a second live panel,
// and the accent CTA keeps the action the only saturated thing in the copy.
function ShowcaseCard({
  title,
  description,
  cta,
  href,
  frame,
  chrome,
  wellClassName,
  backgroundImage,
  children,
}) {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-sm border border-border bg-[#191919] bg-cover bg-center bg-no-repeat"
      style={backgroundImage ? { backgroundImage: `url('${backgroundImage}')` } : undefined}
    >
      {backgroundImage ? <div className="absolute inset-0 bg-[#080808]/80" /> : null}
      <div className="relative z-10 p-5">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#ee6b3b] transition-colors hover:text-[#ff8052]"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {/* The shelf stays translucent so the photo reads through it as texture,
          while the device frame on top is opaque and keeps the preview legible. */}
      <div
        className={`relative z-10 mt-auto flex flex-col overflow-hidden border-t border-white/[0.06] bg-white/[0.05] px-5 pt-5 backdrop-blur-sm ${wellClassName}`}
      >
        <DeviceFrame variant={frame} label={chrome} className="flex-1">
          {children}
        </DeviceFrame>
      </div>
    </article>
  );
}

// Category-led capability grids (concept from the reference, in our style).
const capabilityGroups = [
  {
    kicker: "Real-time visibility",
    heading: "Understand How Your Event Is Performing In Real Time",
    cta: { label: "Book a demo", href: "#" },
    cards: [
      {
        icon: LineChart,
        title: "Live attendance & revenue",
        points: [
          "Watch check-ins, sales, and no-shows as they happen",
          "Compare against capacity and targets at a glance",
          "Drill into any session, tier, or ticket type",
        ],
      },
      {
        icon: Users,
        title: "Attendee intelligence",
        points: [
          "One profile per guest across every event",
          "Segment by ticket, RSVP status, and history",
          "Trigger reminders and updates that reach people",
        ],
      },
      {
        icon: LayoutGrid,
        title: "Program-wide reporting",
        points: [
          "Roll up a series or a whole season in one view",
          "Export clean data for finance and stakeholders",
          "A single source of truth for every activation",
        ],
      },
    ],
  },
  {
    kicker: "Built for scale",
    heading: "Infrastructure That Makes Scale Feel Simple",
    cta: { label: "Talk to our team", href: "#" },
    cards: [
      {
        icon: CalendarDays,
        title: "Reusable event frameworks",
        points: [
          "Templates for formats, dates, and structures",
          "Spin up a new event in minutes, not days",
          "Consistent setup across regions and organizers",
        ],
      },
      {
        icon: Ticket,
        title: "End-to-end ticketing",
        points: [
          "Tiers, capacity, and registration in one place",
          "Collect RSVPs without leaving the workspace",
          "Handle changes and refunds without the chaos",
        ],
      },
      {
        icon: ShieldCheck,
        title: "Operational confidence",
        points: [
          "Project-based access keeps events private",
          "Fewer manual steps means fewer mistakes",
          "Scale operations without scaling headcount",
        ],
      },
    ],
  },
];

const faqs = [
  {
    value: "item-1",
    question: "How does Geiger Events keep my data secure?",
    answer:
      "Geiger Events uses secure authentication, controlled access paths, and project-based visibility to keep your events private.",
  },
  {
    value: "item-2",
    question: "Do you use my attendee data for ads?",
    answer: "No. Your workspace content is not used for ad personalization.",
  },
  {
    value: "item-3",
    question: "Can I collaborate with my team in real time?",
    answer:
      "Yes. You can plan together, assign tasks, and keep everyone aligned while your event comes together.",
  },
  {
    value: "item-4",
    question: "Can Geiger Events be used for client or business events?",
    answer:
      "Yes. Teams use it for conferences, workshops, internal meetings, and client-facing experiences.",
  },
];

export default function EventsLandingPage() {
  const dashboardHref = "/org";
  const showcaseBg = pickRandomShowcaseBackground();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground selection:bg-indigo-500/30 font-sans">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808030_1px,transparent_1px),linear-gradient(to_bottom,#80808030_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <Header dashboardHref={dashboardHref} />

      <main className="relative z-10 flex flex-1 flex-col pt-16 sm:pt-20">
        <section className="mx-auto mb-10 mt-10 flex w-full max-w-6xl items-start justify-start px-4 sm:mt-16 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="mb-4 text-2xl font-semibold text-white sm:text-3xl">
              Sell Out Your Next Event.
            </h1>
            <p className="mb-6 w-2xl text-sm text-muted-foreground sm:text-base">
              Geiger Events gives creators and small teams a beautiful event
              page, fast ticketing, and reliable check-in — the power of an
              enterprise platform, without the price. Launch in minutes and
              start selling today.
            </p>
            <Link
              href={dashboardHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:text-base"
            >
              Create your first event
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto my-10 w-[100%] sm:my-20 md:w-[100%]">
          <EventsPlaygroundShowcase backgroundImage={showcaseBg} />
        </section>

        {/* Surface showcase — one platform, every place the event happens. It
            opens the feature story because the device-framed miniatures are the
            fastest way to answer "what is this?". */}
        <section className="mx-auto w-full max-w-[88rem] px-4 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Everywhere your event happens
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            One platform on every surface.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {surfaces.map(({ title, description, cta, frame, chrome, demo: Demo }, index) => (
              <ShowcaseCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                frame={frame}
                chrome={chrome}
                backgroundImage={
                  showcaseBackgroundImages[index % showcaseBackgroundImages.length]
                }
                wellClassName="h-[420px]"
              >
                <Demo />
              </ShowcaseCard>
            ))}
          </div>
        </section>

        {/* Capability tiles — a quick summary of the surfaces above, before the
            feature detail starts. */}
        <section className="mx-auto mt-16 grid w-full max-w-6xl gap-4 px-4 sm:mt-24 sm:px-6 md:grid-cols-3">
          {utilityCards.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-sm border border-border bg-[#191919] p-5"
            >
              <Icon className="mb-3 h-5 w-5 text-muted-foreground" />
              <h2 className="font-medium text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>

        {/* Registrations — the apply-to-attend path beside the buy-a-ticket one. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Not every event just sells a ticket
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Some you have to apply to get into.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {registrationFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + surfaces.length + scaleFeatures.length) %
                      showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Orders — what happens after money moves. Sits beside Registrations so
            the whole money story reads in one pass. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            What happens after money moves
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Orders, refunds, and disputes — without the chase.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {ordersFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 4) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Alternating spotlights — the suite's landing showcase frame. Placed
            mid-page so the identical feature grids never run more than three
            deep without a change of treatment. */}
        <div className="mx-auto my-10 w-full max-w-7xl space-y-8 px-4 sm:my-20 sm:space-y-20 sm:px-6">
          {spotlights.map(
            ({ title, body, background, ctaLabel, playground: Playground }, index) => (
              <SpotlightShowcase
                key={title}
                backgroundImage={background}
                title={title}
                body={body}
                ctaHref={dashboardHref}
                ctaLabel={ctaLabel}
                reverse={index % 2 === 1}
              >
                <Playground />
              </SpotlightShowcase>
            ),
          )}
        </div>

        {/* Program — what a conference buyer diligences after ticketing. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Run the content, not just the door
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            The agenda, the papers, and the credits behind it.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {programFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 2) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Community — the engagement that outlives any single session. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            The event doesn&apos;t stop between sessions
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Q&A, polls, and meetings while the room is full.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {communityFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 6) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Broadcast & on-demand — the online half of a hybrid event. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Hybrid without a second vendor
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Livestream, replays, and captions under one roof.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {broadcastFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 1) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Depth showcase — what large-format organizers actually shop for. */}
        <section className="mx-auto mt-16 w-full max-w-[88rem] px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Runs the whole floor
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Seats, booths, gates — and the whole season after them.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {scaleFeatures.map(({ title, description, cta, frame, chrome, demo: Demo }, index) => (
              <ShowcaseCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                frame={frame}
                chrome={chrome}
                // Offset so the depth grid doesn't repeat the surface grid's photos.
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + surfaces.length) % showcaseBackgroundImages.length
                  ]
                }
                wellClassName="h-[452px]"
              >
                <Demo />
              </ShowcaseCard>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 w-full max-w-[88rem] px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Find the room before you sell it
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Sourcing, instant booking, and housing — all on the map.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sourcingFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 5) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Distribution & growth — campaigns, ads, and a wall buyers follow.
            The two-up grid closes the feature story on a different rhythm. */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Get the word out, get found
          </h2>
          <p className="mt-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">
            Campaigns, advertising, and the wall buyers follow.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {growthFeatures.map(({ title, description, cta, demo: Demo }, index) => (
              <FeatureCard
                key={title}
                title={title}
                description={description}
                cta={cta}
                href={dashboardHref}
                backgroundImage={
                  showcaseBackgroundImages[
                    (index + 3) % showcaseBackgroundImages.length
                  ]
                }
              >
                <Demo />
              </FeatureCard>
            ))}
          </div>
        </section>

        {/* Category-led capability grids. */}
        {capabilityGroups.map(({ kicker, heading, cta, cards }) => (
          <section
            key={heading}
            className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6"
          >
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {kicker}
              </span>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                {heading}
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {cards.map(({ icon: Icon, title, points }) => (
                <article
                  key={title}
                  className="rounded-sm border border-border bg-[#191919] p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <ul className="mt-3 space-y-2">
                    {points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link
                href={cta.href}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
              >
                {cta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ))}

        <section className="mx-auto mt-16 flex w-full max-w-6xl flex-col gap-6 px-4 sm:mt-24 sm:px-6 md:flex-row">
          <div className="md:w-[35%]">
            <h2 className="text-3xl font-semibold text-white">Questions & Answers</h2>
          </div>
          <div className="md:w-[65%]">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.value}
                  value={faq.value}
                  className="border-border"
                >
                  <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Closing CTA, set in a scattered field of event posters — the breadth
            of what the platform runs, shown rather than listed. */}
        <div className="relative z-20 mt-16 sm:mt-24">
          <PosterFieldCta dashboardHref={dashboardHref} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
