import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Ticket,
  Users,
  MapPin,
  BarChart3,
  Bell,
  Workflow,
  QrCode,
  ShieldCheck,
  LayoutGrid,
  LineChart,
  Sparkles,
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
    title: "Ticketing & registration",
    description:
      "Sell tickets, collect RSVPs, and manage capacity without leaving your workspace.",
    icon: Ticket,
  },
  {
    title: "Schedules & agendas",
    description:
      "Build multi-track agendas, sessions, and timelines that update in real time.",
    icon: CalendarDays,
  },
  {
    title: "Attendee management",
    description:
      "Track guests, check-ins, and communications from a single source of truth.",
    icon: Users,
  },
  {
    title: "Venues & logistics",
    description:
      "Map rooms, resources, and vendors so nothing falls through the cracks.",
    icon: MapPin,
  },
  {
    title: "Live insights",
    description:
      "Watch attendance, engagement, and revenue as your event unfolds.",
    icon: BarChart3,
  },
  {
    title: "Reminders & updates",
    description:
      "Keep attendees and your team in sync with timely notifications.",
    icon: Bell,
  },
];

// Big-number credibility band (concept from the reference, in our style).
const stats = [
  { value: "12K+", label: "Events run" },
  { value: "40+", label: "Countries" },
  { value: "500K+", label: "Tickets sold" },
  { value: "3M+", label: "Attendees hosted" },
  { value: "98%", label: "On-time check-ins" },
];

// Alternating text/visual spotlights that tell the end-to-end story.
const spotlights = [
  {
    eyebrow: "Operations",
    title: "The operational backbone for every event",
    body: "Bring registration, ticketing, agendas, and staffing into one connected workspace. Every change flows through instantly, so your team plans from a single source of truth instead of ten spreadsheets.",
    icon: Workflow,
  },
  {
    eyebrow: "Live day",
    title: "Streamlined execution on the day it matters",
    body: "Check guests in, scan tickets, and swap sessions on the fly. Geiger Events keeps front-of-house, staff, and the schedule in sync while doors are open — no scramble, no manual reconciliation.",
    icon: QrCode,
  },
  {
    eyebrow: "For your team",
    title: "Less admin. More moments.",
    body: "Attendees register, update, and self-serve without a queue at the desk. Organizers spend less time chasing logistics and more time on the experience your guests actually came for.",
    icon: Sparkles,
  },
];

// Category-led capability grids (concept from the reference, in our style).
const capabilityGroups = [
  {
    kicker: "Real-time visibility",
    heading: "Understand how your event is performing in real time",
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
    heading: "Infrastructure that makes scale feel simple",
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

// Neutral visual panel standing in for a product screenshot in each spotlight.
function SpotlightVisual({ icon: Icon }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border border-border bg-[#191919]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808020_1px,transparent_1px),linear-gradient(to_bottom,#80808020_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="absolute left-5 top-5 flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-background">
          <Icon className="h-9 w-9 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

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
              Plan, run, and relive every event in one place.
            </h1>
            <p className="mb-6 max-w-xl text-sm text-muted-foreground sm:text-base">
              Geiger Events combines planning, ticketing, and live operations
              with practical team workflows. Build schedules, manage attendees,
              and keep everyone aligned from first idea to final wrap-up.
            </p>
            <Link
              href={dashboardHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:text-base"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto my-10 w-[100%] sm:my-20 md:w-[100%]">
          <EventsPlaygroundShowcase backgroundImage={showcaseBg} />
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3">
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

        {/* Stats band — concept from the reference, in our palette. */}
        <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:mt-20 sm:px-6">
          <div className="grid grid-cols-2 gap-y-8 rounded-sm border border-border bg-[#191919] px-6 py-8 sm:grid-cols-3 sm:px-10 lg:grid-cols-5">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center sm:text-left">
                <div className="text-2xl font-semibold text-white sm:text-3xl">
                  {value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alternating spotlights — the end-to-end narrative. */}
        <section className="mx-auto mt-14 flex w-full max-w-6xl flex-col gap-14 px-4 sm:mt-20 sm:gap-20 sm:px-6">
          {spotlights.map(({ eyebrow, title, body, icon }, index) => (
            <div
              key={title}
              className={`flex flex-col items-center gap-8 md:gap-12 ${
                index % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
              }`}
            >
              <div className="w-full md:w-1/2">
                <SpotlightVisual icon={icon} />
              </div>
              <div className="w-full md:w-1/2">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {eyebrow}
                </span>
                <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-4 text-sm text-muted-foreground sm:text-base">
                  {body}
                </p>
                <Link
                  href={dashboardHref}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-white"
                >
                  Learn more
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
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

        {/* Testimonial — concept from the reference, in our palette. */}
        <section className="mx-auto mt-16 w-full max-w-4xl px-4 sm:mt-24 sm:px-6">
          <figure className="rounded-sm border border-border bg-[#191919] p-8 sm:p-12">
            <Quote className="h-8 w-8 text-muted-foreground" />
            <blockquote className="mt-5 text-lg font-medium leading-relaxed text-white sm:text-xl">
              &ldquo;We moved four tools and a wall of spreadsheets into Geiger
              Events. Check-in that used to jam every morning now just works, and
              the whole team finally plans from the same page.&rdquo;
            </blockquote>
            <figcaption className="mt-6 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Jordan Rivera</span>{" "}
              · Head of Events, Northwind Collective
            </figcaption>
          </figure>
        </section>

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

        <section className="relative z-20 overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="container mx-auto relative z-10 flex flex-col items-center text-center">
            <h3 className="mb-4 text-xs font-semibold tracking-widest text-foreground0 uppercase sm:text-sm">
              Open source from day one
            </h3>
            <h2 className="mb-8 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-3xl font-black tracking-tighter text-transparent drop-shadow-lg sm:mb-10 sm:text-5xl lg:text-6xl">
              TRY GEIGER NOW
            </h2>
            <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href={dashboardHref}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:w-auto"
              >
                Studio
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:w-auto"
              >
                Contact Sales
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
