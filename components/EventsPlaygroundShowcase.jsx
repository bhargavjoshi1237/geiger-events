"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, CalendarDays, LayoutDashboard, Play, Ticket, Users } from "lucide-react";
import Logo from "@geiger/ui/logo";
import { LogoLoading } from "@geiger/ui/logo-loading";
import { ScreenErrorBoundary } from "@/components/landing/screen_error_boundary";
import styles from "@/components/landing/landing.module.css";

const EventsPlayground = dynamic(() => import("@/components/EventsPlayground").then((mod) => mod.EventsPlayground), {
  ssr: false,
  loading: () => <div className={styles.playgroundLoading}><LogoLoading size={56} /></div>,
});

export default function EventsPlaygroundShowcase() {
  const [started, setStarted] = useState(false);
  const shellRef = useRef(null);
  // Launching widens the shell, then brings the full workspace into view once the resize settles.
  const launch = () => {
    setStarted(true);
    setTimeout(() => shellRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
  };
  return (
    <div ref={shellRef} data-launched={started} className={`dark ${styles.playgroundShell}`}>
      <div className={styles.playgroundToolbar}><span><Logo size={16} />Events playground</span><span>Example data</span></div>
      {started ? <div className={styles.livePlayground}><ScreenErrorBoundary title="Events playground"><EventsPlayground /></ScreenErrorBoundary></div> : <div className={styles.playgroundPlaceholder}>
        <div className={styles.mockWorkspace} aria-hidden="true">
          <aside><span><Logo size={16} />Geiger</span>{[[LayoutDashboard, "Overview"], [CalendarDays, "Events"], [Users, "People"], [Ticket, "Orders"]].map(([Icon, label]) => <div key={label}><Icon size={15} />{label}</div>)}</aside>
          <div className={styles.mockOverview}><h3>Overview</h3><div className={styles.mockStats}>{["Events", "Registrations", "Check-ins"].map((label) => <div key={label}><span>{label}</span><strong>—</strong></div>)}</div><div className={styles.mockRows}>{["Nightshift 2026", "Friday Night Live", "The Sunday Social"].map((label) => <div key={label}><CalendarDays size={16} /><span>{label}</span><span>Draft</span><ArrowUpRight size={14} /></div>)}</div></div>
        </div>
        <div className={styles.playgroundLaunch}><button type="button" className={styles.primaryButton} onClick={launch}><Play size={15} fill="currentColor" />Open the playground</button><p>Runs in your browser. No account needed.</p></div>
      </div>}
    </div>
  );
}
