"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, CalendarDays, Check, Mail, ScanLine, Ticket } from "lucide-react";
import styles from "./landing.module.css";

const steps = [
  { label: "Share", icon: Mail, title: "Publish the event page", description: "Add the details and ticket types, publish the page, and share one link wherever you promote the event.", status: "Event page published", detail: "Nightshift 2026 · 3 ticket types" },
  { label: "Buy", icon: Ticket, title: "A guest buys a ticket", description: "The order, the ticket and the guest's registration answers are saved to one attendee record.", status: "Order GE-20418", detail: "Ada Chen · 2 × General" },
  { label: "Prepare", icon: CalendarDays, title: "Build the program and brief the crew", description: "Schedule sessions, assign staff and check capacity against the same attendee list.", status: "Program ready", detail: "14 sessions · 3 rooms · 9 crew" },
  { label: "Arrive", icon: ScanLine, title: "Check the guest in", description: "Door staff scan the ticket. The attendee record updates and the arrival count goes up by one.", status: "Checked in at Door B", detail: "Ada Chen · 21:07" },
];

const STEP_MS = 3200;
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange) => {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false);

export default function ConnectedJourney() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const diagramRef = useRef(null);
  const reduced = usePrefersReducedMotion();
  const playing = visible && !hovered && !reduced;
  const step = steps[active];
  const Icon = step.icon;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    if (diagramRef.current) observer.observe(diagramRef.current);
    return () => observer.disconnect();
  }, []);

  // Walks through the journey while it is on screen; hovering the diagram holds the current step.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => setActive((current) => (current + 1) % steps.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, active]);

  return (
    <section className={styles.journeySection} aria-labelledby="journey-heading">
      <div className={styles.container}>
        <div className={styles.sectionHeading}>
          <h2 id="journey-heading" className={styles.sectionTitle}>One attendee record, from the event page to the door</h2>
          <p className={styles.sectionDescription}>Follow a single guest through Geiger Events. Every team sees the same record at every step.</p>
        </div>
        <div className={styles.journeyLayout}>
          <div className={styles.journeyCopy} aria-live="polite">
            <span className={styles.journeyStep}>Step {active + 1} of {steps.length}</span>
            <div key={active} className={ENTER}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
            <a href="#playground" className={styles.textLink}>Try it in the playground<ArrowRight size={14} /></a>
          </div>
          <div ref={diagramRef} className={styles.journeyDiagram} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div className={styles.journeySteps} aria-label="Guest journey steps">
              <span className={styles.journeyLine} style={{ "--journey-fill": active / (steps.length - 1) }} aria-hidden="true" />
              {steps.map(({ label, icon: StepIcon }, index) => (
                <button type="button" key={label} aria-pressed={active === index} onClick={() => setActive(index)}>
                  <span className={styles.journeyNode}>
                    {index < active ? <Check size={18} /> : <StepIcon size={18} strokeWidth={1.75} />}
                    {active === index && playing ? <svg key={active} className={styles.journeyTimer} viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" style={{ animationDuration: `${STEP_MS}ms` }} /></svg> : null}
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className={styles.journeyRecord}>
              <div className={styles.journeyRecordTop}><span>Attendee record</span><span>Example data</span></div>
              <div key={active} className={`${styles.journeyRecordBody} ${ENTER}`}>
                <div className={styles.journeyRecordIcon}><Icon size={22} strokeWidth={1.5} /></div>
                <div><span>{step.status}</span><strong>{step.detail}</strong></div>
              </div>
              <div className={styles.journeyRecordBottom}><span>Updated in the dashboard, door app and attendee portal</span><span>Nightshift 2026</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
