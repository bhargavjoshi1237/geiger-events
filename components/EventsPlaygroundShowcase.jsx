"use client";

import Logo from "@geiger/ui/logo";
import { PlaygroundFrame } from "@geiger/ui/playground-frame";
import styles from "@/components/landing/landing.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// The real Events workspace on Halcyon Studio's example data, served from /playground and embedded as an iframe.
export default function EventsPlaygroundShowcase() {
  return (
    <div data-launched="true" className={`dark ${styles.playgroundShell}`}>
      <div className={styles.playgroundToolbar}><span><Logo size={16} />Events playground</span></div>
      <div className="h-[640px] sm:h-[700px] lg:h-[860px]">
        <PlaygroundFrame src={`${BASE_PATH}/playground`} title="Geiger Events playground" />
      </div>
    </div>
  );
}
