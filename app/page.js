import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Ticket,
  Users,
  MapPin,
  BarChart3,
  Bell,
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
  const dashboardHref = "/home";

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 font-sans">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808030_1px,transparent_1px),linear-gradient(to_bottom,#80808030_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <Header dashboardHref={dashboardHref} />

      <main className="relative z-10 flex flex-1 flex-col pt-16 sm:pt-20">
        <section className="mx-auto mb-10 mt-10 flex w-full max-w-6xl items-start justify-start px-4 sm:mt-16 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="mb-4 text-2xl font-semibold text-white sm:text-3xl">
              Plan, run, and relive every event in one place.
            </h1>
            <p className="mb-6 max-w-xl text-sm text-zinc-400 sm:text-base">
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
          <EventsPlaygroundShowcase />
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3">
          {utilityCards.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-sm border border-zinc-800 bg-[#191919] p-5"
            >
              <Icon className="mb-3 h-5 w-5 text-zinc-300" />
              <h2 className="font-medium text-zinc-100">{title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{description}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 md:mt-16 md:flex-row">
          <div className="md:w-[35%]">
            <h2 className="text-3xl font-semibold text-white">Questions & Answers</h2>
          </div>
          <div className="md:w-[65%]">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.value}
                  value={faq.value}
                  className="border-zinc-800"
                >
                  <AccordionTrigger className="text-zinc-200 hover:text-white hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="relative z-20 overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="container mx-auto relative z-10 flex flex-col items-center text-center">
            <h3 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase sm:text-sm">
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
