"use client";

import { useEffect, useRef, useState } from "react";
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
  { label: "At the door", title: "Scan guests in at the door", description: "Door staff scan QR or wallet passes, look a guest up by name, and see how many people have arrived.", points: ["QR and wallet passes", "Search by name or order", "Live arrival count"], demo: "door" },
  { label: "In their pocket", title: "Give attendees their tickets and agenda", description: "The attendee portal holds each guest's tickets, their personal agenda and the event's live rooms.", points: ["Tickets and event details", "Personal agendas", "Live rooms and chat"], demo: "portal" },
  { label: "Behind the scenes", title: "Hand out badges and merch without double-issuing", description: "The staff desk shows what each guest is owed, records what they collect, and blocks a second collection.", points: ["Shared issuing desk", "Collection status per guest", "Duplicate collection checks"], demo: "desk" },
];

const automation = [
  { label: "Workflows", title: "Start work automatically when a ticket sells", description: "Choose a trigger, add conditions, then send guest emails or alert your team. Every run is logged.", points: ["Triggers, conditions and actions", "Guest emails and team alerts", "Run history and logs"], demo: "workflows" },
  { label: "Audience segments", title: "Build audiences from tickets, spend and tags", description: "Combine rules on ticket type, attendance, spend and tags. The list of matching guests updates as you edit.", points: ["Combine audience rules", "Preview who matches", "Reuse segments in campaigns"], demo: "segments" },
  { label: "Live insights", title: "See where buyers come from and where they drop off", description: "Follow visitors from the event page to a paid order and compare acquisition channels side by side.", points: ["Conversion funnel", "Channel comparison", "Drop-off by step"], demo: "analytics" },
];

const categories = [
  { label: "Registration", items: [
    { label: "Registration forms", demo: "forms", description: "Add custom questions to registration and choose which ones are required." },
    { label: "Approval gates", demo: "approvals", description: "Review applications with their answers attached, then approve or decline from one queue." },
    { label: "Waitlists", demo: "waitlist", description: "Let guests join a waitlist when tickets sell out and see who is next in line." },
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
    { label: "Livestream", demo: "stream", description: "Stream sessions into event rooms with attendee presence and chat." },
    { label: "On-demand", demo: "replays", description: "Publish session recordings in a replay library and control who can watch." },
    { label: "Captions", demo: "captions", description: "Live captions and a searchable transcript for each session." },
  ] },
  { label: "Venues & logistics", items: [
    { label: "Venue sourcing", demo: "venues", description: "Search venues on a map and move the promising ones into a shortlist." },
    { label: "Instant booking", demo: "booking", description: "Check a venue's availability and rates before you book." },
    { label: "Housing & travel", demo: "travel", description: "Find stays, airports and rail stations near the venue and shortlist them." },
    { label: "Venue library", demo: "library", description: "Save venue records you can reuse for the next event." },
  ] },
  { label: "Growth & discovery", items: [
    { label: "Campaigns", demo: "campaigns", description: "Plan newsletters and reminders and track what each campaign costs." },
    { label: "Discovery", demo: "discovery", description: "Publish an organizer profile and an event wall that lists your upcoming events." },
  ] },
  { label: "Seating & scale", items: [
    { label: "Assigned seating", demo: "seats", description: "Build a seat map and sell specific seats, with timed holds during checkout." },
    { label: "Expo & sponsors", demo: "expo", description: "Sell exhibitor booths from a hall map alongside sponsor packages." },
    { label: "Live operations", demo: "live", description: "Monitor gates, zones and room capacity while guests check in." },
    { label: "Events & series", demo: "series", description: "Copy an event's setup to the next date with templates and series." },
  ] },
];

function TabList({ items, selected, onChange, id }) {
  const handleKey = (event, index) => {
    let next;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % items.length;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className={styles.explorerTabs} role="tablist" aria-label={`${id} previews`}>
    {items.map((item, index) => <button key={item.label} type="button" id={`${id}-tab-${index}`} role="tab" aria-selected={selected === index} aria-controls={`${id}-panel`} tabIndex={selected === index ? 0 : -1} onClick={() => onChange(index)} onKeyDown={(event) => handleKey(event, index)}>{item.label}</button>)}
  </div>;
}

// Every feature in one flat, page-ordered list so the tour can walk through all of them.
const features = categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.label })));

// All features stay visible at once; the preview tours through them on its own, and any one can be picked to jump there.
function CapabilityExplorer() {
  const [selected, setSelected] = useState(0);
  const indexRef = useRef(null);
  const item = features[selected];
  const next = () => setSelected((current) => (current + 1) % features.length);

  // When the index scrolls sideways (narrow screens), keep the playing feature in view without moving the page.
  useEffect(() => {
    const index = indexRef.current;
    const active = index?.querySelector('[aria-pressed="true"]');
    if (index && active && index.scrollWidth > index.clientWidth) index.scrollTo({ left: active.offsetLeft - 12, behavior: "smooth" });
  }, [selected]);

  return (
    <div className={`${styles.explorer} ${styles.capabilityExplorer}`}>
      <nav ref={indexRef} className={styles.featureIndex} aria-label="All features">
        {categories.map((category) => (
          <div key={category.label} className={styles.featureGroup}>
            <span>{category.label}</span>
            <div>
              {category.items.map((entry) => {
                const index = features.findIndex((feature) => feature.demo === entry.demo);
                return <button key={entry.demo} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{entry.label}</button>;
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className={styles.capabilityStage}>
        <div className={styles.capabilityCopy} aria-live="polite">
          <span className={styles.explorerCategory}>{item.category} · {selected + 1} of {features.length}</span>
          <h3>{item.label}</h3>
          <p>{item.description}</p>
        </div>
        <AutoplayPreview key={item.demo} demo={item.demo} onComplete={next} />
      </div>
    </div>
  );
}

// Tabbed explorer for the surfaces and automation sections; it moves to the next tab after each preview plays through.
export default function ProductExplorer({ variant = "surfaces" }) {
  const [selected, setSelected] = useState(0);
  if (variant === "capabilities") return <CapabilityExplorer />;
  const items = variant === "automation" ? automation : surfaces;
  const item = items[selected];
  const next = () => setSelected((current) => (current + 1) % items.length);

  return (
    <div className={styles.explorer}>
      <TabList items={items} selected={selected} onChange={setSelected} id={variant} />
      <div role="tabpanel" id={`${variant}-panel`} aria-labelledby={`${variant}-tab-${selected}`} tabIndex={0} className={styles.explorerPanel}>
        <div className={`${styles.explorerContent} ${variant === "automation" ? styles.automationContent : ""}`}>
          <div className={styles.explorerCopy}>
            <h3>{item.title}</h3><p>{item.description}</p>
            <ul>{item.points.map((point) => <li key={point}><Check size={14} />{point}</li>)}</ul>
            <Link href="/org" className={styles.textLink}>Create an event<ArrowRight size={14} /></Link>
          </div>
          <div className={styles.demoStage}>
            <AutoplayPreview key={item.demo} demo={item.demo} onComplete={next} />
          </div>
        </div>
      </div>
    </div>
  );
}
