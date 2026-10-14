"use client";

import Logo from "@geiger/ui/logo";
import { PlaygroundFrame } from "@/components/landing/playground_frame";
import styles from "@/components/landing/landing.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// The real Events workspace on Halcyon Studio's example data, served from /playground and embedded as an iframe.
export default function EventsPlaygroundShowcase() {
  return (
    <div data-launched="true" className={`dark ${styles.playgroundShell}`}>
      <div className={styles.playgroundToolbar}><span><Logo size={16} />Events playground</span><span>Example data · nothing is saved</span></div>
      <PlaygroundFrame src={`${BASE_PATH}/playground`} title="Geiger Events playground" className="!rounded-none !border-0" />
    </div>
  );
}
