"use client";

import dynamic from "next/dynamic";
import { LogoLoading } from "@geiger/ui/logo-loading";

// Client-only: the playground swaps the data layer for an in-memory database, which only exists in the browser.
const EventsPlayground = dynamic(
  () => import("@/components/EventsPlayground").then((mod) => mod.EventsPlayground),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <LogoLoading size={80} />
      </div>
    ),
  },
);

export default EventsPlayground;
