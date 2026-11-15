"use client";

import { ChevronRight, Clock } from "lucide-react";
import { Card, ScreenHeader } from "@geiger/ui";
import { formatDateTime } from "@/components/internal/screens/workspace/state/format";
import { eventShortName } from "./event_info";

const DAY = 86_400_000;
const daysLeft = (iso) => Math.ceil((Date.parse(iso) - Date.now()) / DAY);

// The first form on the page that is still open and has a closing time, for the "Closes …" note beside the heading.
function closingForm(page) {
  const now = Date.now();
  return (page?.body?.blocks ?? []).find((block) => block.kind === "form" && block.config?.closesAt && Date.parse(block.config.closesAt) > now
    && (!block.config.opensAt || Date.parse(block.config.opensAt) <= now)) ?? null;
}

// A portal page's heading: "Event › Page", the title, its description and, for a form page, when submissions close.
export function PortalPageHeader({ page, eventName, timeZone = "UTC" }) {
  const header = page?.body?.header ?? {};
  if (!page || page.kind === "record" || header.hidden) return null;
  const title = header.title || page.title;
  const form = closingForm(page);
  const closesAt = form?.config.closesAt;
  const left = closesAt ? daysLeft(closesAt) : null;
  return (
    <header className="mb-7 grid gap-2.5">
      {eventName ? (
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          {eventShortName(eventName)}<ChevronRight className="h-3 w-3 text-text-tertiary" />{page.title}
        </span>
      ) : null}
      <ScreenHeader className="pb-3.5" title={title} description={header.description ? <span className="whitespace-pre-line">{header.description}</span> : null}
        actions={closesAt ? (
          <Card className="flex-row items-center gap-3 bg-surface-subtle px-3.5 py-2.5 shadow-none">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="grid gap-px">
              <span className="text-sm font-medium text-foreground">Closes {formatDateTime(closesAt, timeZone)}</span>
              <span className="text-xs text-text-secondary">{left <= 1 ? "Closes within a day" : `${left} days left`}</span>
            </span>
          </Card>
        ) : null} />
    </header>
  );
}
