"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LogoLoading } from "@geiger/ui/logo-loading";
import styles from "./landing.module.css";

// The scenes are display-only, so one lazily loaded player covers every preview.
const AutoplayPreview = dynamic(() => import("./previews/autoplay"), {
  ssr: false,
  loading: () => <div className={styles.demoLoading}><LogoLoading size={40} /></div>,
});

const surfaces = [
  { label: "The event page", title: "Sell tickets from a page you design", description: "Ticket tiers, add-ons, discount codes and checkout sit on one public page with your branding. Share a single link.", points: ["Ticket tiers and capacity", "Add-ons and discount codes", "Checkout on the same page"], demo: "page" },
  { label: "At the door", title: "Scan guests in at the door", description: "Door staff scan QR tickets, look a guest up by name, and see how many people have arrived.", points: ["QR ticket scanning", "Search by name or order", "Live arrival count"], demo: "door" },
  { label: "In their pocket", title: "Give attendees their tickets and live rooms", description: "The attendee portal holds each guest's tickets, orders and memberships, plus the event's live rooms and chat.", points: ["Tickets with QR codes", "Orders and memberships", "Live rooms and chat"], demo: "portal" },
  { label: "Behind the scenes", title: "Hand out badges and merch without double-issuing", description: "The staff desk shows what each guest is owed, records what they collect, and blocks a second collection.", points: ["Shared issuing desk", "Collection status per guest", "Duplicate collection checks"], demo: "desk" },
];

const automation = [
  { label: "Workflows", title: "Plan the follow-up in a workflow builder", description: "Lay out triggers, conditions and actions for what should happen after a sale. The builder is ready; automatic runs are still being built.", points: ["Triggers, conditions and actions", "One canvas per workflow", "Shared with your team"], demo: "workflows" },
  { label: "Audience segments", title: "Build audiences from tickets, spend and tags", description: "Combine rules on ticket type, attendance, spend and tags. The list of matching guests updates as you edit.", points: ["Combine audience rules", "Preview who matches", "Save segments to reuse"], demo: "segments" },
];

const categories = [
  { label: "Registration", items: [
    { label: "Registration forms", demo: "forms", description: "Add custom questions to registration and choose which ones are required." },
    { label: "Approval gates", demo: "approvals", description: "Review applications with their answers attached, then approve or decline from one queue." },
    { label: "Waitlists", demo: "waitlist", description: "Keep a waitlist for a full event and promote people by hand when places open." },
  ] },
  { label: "Orders & payments", items: [
    { label: "Order cockpit", demo: "orders", description: "See paid, partial, refunded and disputed orders in one list, with the amounts beside them." },
    { label: "Refunds", demo: "refunds", description: "Check the order against its refund policy, then record the refund amount." },
    { label: "Disputes", demo: "disputes", description: "Track chargebacks with their evidence and response deadlines." },
  ] },
  { label: "Program & speakers", items: [
    { label: "Agenda builder", demo: "agenda", description: "Drag sessions onto a track-by-time grid. Double-booked speakers and rooms are flagged." },
    { label: "Call for papers", demo: "papers", description: "Review submissions by speaker and track, then move accepted talks into the agenda." },
    { label: "Speakers & credits", demo: "speakers", description: "Manage the speaker roster, the run of show and continuing-education credits." },
  ] },
  { label: "Community", items: [
    { label: "Q&A", demo: "qa", description: "Attendees submit and upvote questions, and moderators mark them answered." },
    { label: "Live polls", demo: "polls", description: "Run a poll during a session and show the results as votes come in." },
    { label: "Meetings", demo: "meetings", description: "Attendees book one-to-one meetings from open time slots." },
  ] },
  { label: "Hybrid & broadcast", items: [
    { label: "Livestream", demo: "stream", description: "Embed a YouTube, Vimeo or video link in event rooms, with attendee presence and chat." },
    { label: "On-demand", demo: "replays", description: "Publish session recordings in a replay library and control who can watch." },
  ] },
  { label: "Venues & logistics", items: [
    { label: "Venue sourcing", demo: "venues", description: "Search venues on a map and move the promising ones into a shortlist." },
    { label: "Instant booking", demo: "booking", description: "Check a venue's availability and rates before you book." },
    { label: "Housing & travel", demo: "travel", description: "Find stays, airports and rail stations near the venue and shortlist them." },
    { label: "Venue library", demo: "library", description: "Save venue records you can reuse for the next event." },
  ] },
  { label: "Growth & discovery", items: [
    { label: "Campaigns", demo: "campaigns", description: "Plan newsletters and track what each campaign costs." },
    { label: "Discovery", demo: "discovery", description: "Publish an organizer profile and an event wall that lists your upcoming events." },
  ] },
  { label: "Seating & scale", items: [
    { label: "Assigned seating", demo: "seats", description: "Build a seat map and sell specific seats, with timed holds during checkout." },
    { label: "Expo & sponsors", demo: "expo", description: "Sell exhibitor booths from a hall map alongside sponsor packages." },
    { label: "Live operations", demo: "live", description: "Monitor gates, zones and room capacity while guests check in." },
    { label: "Events & series", demo: "series", description: "Copy an event's setup to the next date with templates and series." },
  ] },
];

// Arrow/Home/End keys move between tabs and focus the new one.
function handleTabKey(event, index, count, onChange) {
  let next;
  if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % count;
  if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + count) % count;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = count - 1;
  if (next === undefined) return;
  event.preventDefault();
  onChange(next);
  event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')[next]?.focus();
}

// Open stage: a numbered rail whose active row fills as its preview plays; the heading shares the grid so the stage lines up with the description.
function Showcase({ id, items, title, description }) {
  const [selected, setSelected] = useState(0);
  const progressRef = useRef(null);
  const item = items[selected];
  const next = () => setSelected((current) => (current + 1) % items.length);

  return (
    <div className={styles.showcase}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDescription}>{description}</p>
      <div className={styles.showcaseRail}>
        <div role="tablist" aria-orientation="vertical" aria-label={title} className={styles.showcaseList}>
          {items.map((entry, index) => {
            const active = index === selected;
            return (
              <div key={entry.demo} className={styles.showcaseItem} data-active={active}>
                <span ref={active ? progressRef : null} className={styles.showcaseProgress} aria-hidden="true" />
                <button type="button" role="tab" id={`${id}-tab-${index}`} aria-selected={active} aria-controls={`${id}-panel`} tabIndex={active ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => handleTabKey(event, index, items.length, setSelected)}>
                  <span>{`0${index + 1}`}</span>{entry.label}
                </button>
                <div className={styles.showcaseBody} inert={!active}>
                  <div>
                    <div>
                      <h3>{entry.title}</h3>
                      <p>{entry.description}</p>
                      <ul>{entry.points.map((point) => <li key={point}><Check size={14} />{point}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Link href="/org" className={styles.textLink}>Create an event<ArrowRight size={14} /></Link>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0} className={styles.showcaseStage}>
        <div key={item.demo} className={styles.showcaseScene} data-demo={item.demo}>
          <AutoplayPreview demo={item.demo} controls="chip" progressRef={progressRef} onComplete={next} />
        </div>
      </div>
    </div>
  );
}

// Every feature in one flat, page-ordered list so the tour can walk through all of them.
const features = categories.flatMap((category, categoryIndex) => category.items.map((item, position) => ({ ...item, categoryIndex, position })));

// Same open stage, with categories as the numbered rail; the open category lists its features and its line fills across all of them.
function CapabilityShowcase({ title, description }) {
  const [selected, setSelected] = useState(0);
  const progressRef = useRef(null);
  const item = features[selected];
  const next = () => setSelected((current) => (current + 1) % features.length);
  const firstOf = (categoryIndex) => features.findIndex((feature) => feature.categoryIndex === categoryIndex);

  return (
    <div className={styles.showcase}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDescription}>{description}</p>
      <div className={styles.showcaseRail}>
        <div role="tablist" aria-orientation="vertical" aria-label={title} className={styles.showcaseList}>
          {categories.map((category, categoryIndex) => {
            const active = categoryIndex === item.categoryIndex;
            return (
              <div key={category.label} className={styles.showcaseItem} data-active={active}>
                <span ref={active ? progressRef : null} className={styles.showcaseProgress} style={active ? { "--i": item.position, "--n": category.items.length } : undefined} aria-hidden="true" />
                <button type="button" role="tab" id={`capabilities-tab-${categoryIndex}`} aria-selected={active} aria-controls="capabilities-panel" tabIndex={active ? 0 : -1} onClick={() => setSelected(firstOf(categoryIndex))} onKeyDown={(event) => handleTabKey(event, categoryIndex, categories.length, (index) => setSelected(firstOf(index)))}>
                  <span>{`0${categoryIndex + 1}`}</span>{category.label}
                </button>
                <div className={styles.showcaseBody} inert={!active}>
                  <div>
                    <div>
                      <ul className={styles.featureList}>
                        {category.items.map((entry) => {
                          const index = features.findIndex((feature) => feature.demo === entry.demo);
                          return (
                            <li key={entry.demo}>
                              <button type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>{entry.label}</button>
                              {index === selected ? <p>{entry.description}</p> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id="capabilities-panel" aria-labelledby={`capabilities-tab-${item.categoryIndex}`} tabIndex={0} className={styles.showcaseStage}>
        <div key={item.demo} className={styles.showcaseScene} data-demo={item.demo}>
          <AutoplayPreview demo={item.demo} controls="chip" progressRef={progressRef} onComplete={next} />
        </div>
      </div>
    </div>
  );
}

// Every explorer uses the open-stage showcase; capabilities group their rail by category.
export default function ProductExplorer({ variant = "surfaces", title, description }) {
  if (variant === "capabilities") return <CapabilityShowcase title={title} description={description} />;
  return <Showcase id={variant} items={variant === "automation" ? automation : surfaces} title={title} description={description} />;
}
