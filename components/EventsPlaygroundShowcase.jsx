import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";

export default function EventsPlaygroundShowcase({
  ctaHref = "/home",
  ctaLabel = "Open the dashboard",
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#161616] p-3 sm:rounded-3xl sm:p-6 md:p-8 xl:p-10">
      <div className="flex flex-col gap-6 sm:gap-10">
        <div className="space-y-5">
          <div className="mx-auto mb-4 mt-4 flex w-[92%] flex-col items-start gap-4 sm:mb-6 sm:mt-6 sm:w-[90%]">
            <h3 className="text-3xl font-semibold leading-tight text-white">
              Design and run live with the full Geiger Events interface.
            </h3>

            <p className="max-w-sm text-zinc-400">
              An interactive playground will run right here on the page with the
              complete event builder, schedule, and attendee tools. No save and
              no load, just pure exploration.
            </p>

            <Link
              href={ctaHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-5 font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Playground placeholder — the interactive experience will be mounted here. */}
        <div className="relative rounded-2xl border border-zinc-700/80 bg-[#191919]/70 p-2 shadow-2xl backdrop-blur-md sm:p-3">
          <div className="flex h-[430px] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed border-zinc-800 bg-[#161616] text-center sm:h-[460px] lg:h-[600px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-[#202020] text-zinc-400">
              <CalendarClock className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-200">
                Interactive playground coming soon
              </span>
              <span className="text-xs text-zinc-500">
                Reserved space for the Geiger Events playground
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
