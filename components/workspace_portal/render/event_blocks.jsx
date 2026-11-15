"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge, Button, Card, LucideIcon } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { BlockFrame } from "./block_frame";
import { RICH_TEXT } from "./content_blocks";
import { daysUntil, relativeDay } from "./event_info";
import { fillVariables, usePortalView } from "./portal_context";

const personOf = (session) => session?.person ?? (session?.member ? { name: session.member.name } : null);
// Plain text (rendered as text, so React escapes it); fillVariables is for HTML.
const fill = (text, session) => String(text ?? "")
  .replace(/\{\{\s*event\.name\s*\}\}/g, session?.event?.name ?? "")
  .replace(/\{\{\s*person\.name\s*\}\}/g, personOf(session)?.name ?? "");

function countdown(event) {
  const days = daysUntil(event?.date, event?.timeZone);
  if (days === null || days < 0) return null;
  if (days === 0) return "Happening today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

// Page or website buttons; the first primary one leads with an arrow.
function Buttons({ items }) {
  const { api } = usePortalView();
  return items.map((item, index) => {
    const outline = item.style === "outline";
    const cls = cn("h-10 rounded-lg px-4", outline && "bg-surface-card");
    if (item.kind === "url") {
      const mail = item.target?.startsWith("mailto:");
      return (
        <Button key={index} variant={outline ? "outline" : "default"} className={cls} asChild>
          <a href={item.target || "#"} target={mail ? undefined : "_blank"} rel="noopener noreferrer">{item.label}{mail ? null : <ArrowUpRight className="h-4 w-4" />}</a>
        </Button>
      );
    }
    return (
      <Button key={index} variant={outline ? "outline" : "default"} className={cls} onClick={() => item.target && api.navigate?.(item.target)}>
        {item.label}{!outline && index === 0 ? <ArrowRight className="h-4 w-4" /> : null}
      </Button>
    );
  });
}

// Icon rows of a caption and a value ("When · Mon 8 – Wed 10 December").
function FactRows({ items, session }) {
  return items.map((item, index) => (
    <div key={index} className={cn("flex gap-3 px-4 py-3.5", index && "border-t border-border")}>
      <LucideIcon name={item.icon || "info"} className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
      <span className="grid min-w-0 gap-0.5">
        {item.label ? <span className="text-xs text-text-secondary">{item.label}</span> : null}
        {item.value ? <span className="text-sm text-foreground">{fill(item.value, session)}</span> : null}
      </span>
    </div>
  ));
}

// The welcome that opens a home page: optional cover, a countdown, heading, text, buttons and the key facts.
export function HeroBlock({ block }) {
  const { session } = usePortalView();
  const { image, badge, heading, text, buttons = [], facts = [] } = block.config;
  const soon = badge === "countdown" ? countdown(session?.event) : null;
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl bg-surface-subtle py-0 shadow-none">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- organiser-provided https image
        <img src={image} alt="" className="h-40 w-full border-b border-border object-cover sm:h-52" />
      ) : null}
      <div className="flex flex-wrap gap-x-10 gap-y-7 p-[clamp(22px,3vw,36px)]">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col items-start gap-4">
          {soon ? <Badge variant="outline" className="h-[26px] gap-2 rounded-full px-2.5 text-foreground"><span className="h-[7px] w-[7px] rounded-full bg-primary" />{soon}</Badge> : null}
          {heading ? <h1 className="text-balance text-[clamp(28px,3.2vw,38px)] font-semibold leading-[1.1] tracking-tight text-foreground">{fill(heading, session)}</h1> : null}
          {text ? <p className="max-w-[600px] whitespace-pre-line text-pretty text-[15.5px] leading-relaxed text-muted-foreground">{fill(text, session)}</p> : null}
          {buttons.length ? <div className="mt-1.5 flex flex-wrap gap-2.5"><Buttons items={buttons} /></div> : null}
        </div>
        {facts.length ? (
          <Card className="min-w-0 flex-[1_1_260px] gap-0 self-start bg-background py-0 shadow-none">
            <FactRows items={facts} session={session} />
          </Card>
        ) : null}
      </div>
    </Card>
  );
}

// A one-line announcement with an icon.
export function NoticeBlock({ block }) {
  const { session } = usePortalView();
  return (
    <Card className="flex-row items-center gap-3 bg-surface-subtle px-4 py-3 shadow-none">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <LucideIcon name={block.config.icon || "megaphone"} className="h-4 w-4" />
      </span>
      <div className={cn(RICH_TEXT, "min-w-0 [&_p]:text-sm [&_p]:text-muted-foreground")}
        dangerouslySetInnerHTML={{ __html: fillVariables(block.config.html, { event: session?.event, person: personOf(session) }) }} />
    </Card>
  );
}

// Details with icons: where a session is, who to contact, what to bring.
export function FactsBlock({ block, fill: fillCell }) {
  const { session } = usePortalView();
  return <BlockFrame title={block.config.title} fill={fillCell}><FactRows items={block.config.items ?? []} session={session} /></BlockFrame>;
}

// Deadlines and milestones; the next one is highlighted and each shows how far away it is.
export function DatesBlock({ block, fill: fillCell }) {
  const { session } = usePortalView();
  const timeZone = session?.event?.timeZone;
  const items = [...(block.config.items ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const next = items.find((item) => daysUntil(item.date, timeZone) >= 0);
  const label = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <BlockFrame title={block.config.title} fill={fillCell}>
      {items.map((item, index) => {
        const days = daysUntil(item.date, timeZone);
        return (
          <div key={`${item.date}-${index}`} className={cn("flex items-start gap-3.5 px-5 py-3.5", index && "border-t border-border", days < 0 && "opacity-60")}>
            <span className={cn("w-[52px] shrink-0 font-mono text-[12.5px] font-medium leading-5", item === next ? "text-primary" : "text-muted-foreground")}>{label(item.date)}</span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[13.5px] text-foreground">{item.label}</span>
              <span className="text-xs text-text-secondary">{item.note || relativeDay(days)}</span>
            </span>
          </div>
        );
      })}
      {!items.length ? <p className="px-5 py-6 text-sm text-text-secondary">No dates yet.</p> : null}
    </BlockFrame>
  );
}
