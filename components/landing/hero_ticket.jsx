import { Check, QrCode } from "lucide-react";
import Logo from "@geiger/ui/logo";
import styles from "./landing.module.css";

// Hero artwork: a ticket for the same example event the previews below use, stamped at the door.
export default function HeroTicket() {
  return (
    <div className={styles.ticketScene} aria-hidden="true">
      {/* The order's second ticket, peeking out behind the first */}
      <div className={styles.ticketBack}>
        <div className={styles.ticketBackStub}>
          <div><small>Ticket 2 of 2</small><strong>Ada Chen +1</strong></div>
          <span className={styles.ticketBarcode} />
        </div>
      </div>
      <div className={styles.ticket}>
        <div className={styles.ticketIssuer}>
          <span><Logo size={18} />Geiger Events</span>
          <small>ADMIT 1</small>
        </div>
        <div className={styles.ticketEvent}>Nightshift<br />2026</div>
        <div className={styles.ticketWhen}>Sat 14 Mar · Doors 21:00 · The Foundry</div>
        <div className={styles.ticketPerforation} />
        <div className={styles.ticketStub}>
          <dl className={styles.ticketFields}>
            <div><dt>Guest</dt><dd>Ada Chen</dd></div>
            <div><dt>Ticket</dt><dd>General</dd></div>
            <div><dt>Order</dt><dd>GE-20418</dd></div>
            <div><dt>Entry</dt><dd>Door B</dd></div>
          </dl>
          <QrCode size={52} strokeWidth={1.25} />
        </div>
        <div className={styles.ticketStamp}>
          <strong><Check size={14} strokeWidth={2.5} />Checked in</strong>
          <span>21:07 · Door B</span>
        </div>
      </div>
    </div>
  );
}
