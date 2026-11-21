import { Check, QrCode } from "lucide-react";
import Logo from "@geiger/ui/logo";
import styles from "./landing.module.css";

// Real Code 128-B encoding of order "GE-20418" (start, data, checksum, stop) as alternating bar/space module widths
const BARCODE = "2112142113131321131221322232111231222212311232213112221132222331112";

function Barcode() {
  let x = 0;
  const bars = [];
  [...BARCODE].forEach((d, i) => {
    if (i % 2 === 0) bars.push(<rect key={i} x={x} width={d} height="1" />);
    x += Number(d);
  });
  return (
    <svg className={styles.ticketBarcode} width={x} viewBox={`0 0 ${x} 1`} preserveAspectRatio="none" fill="currentColor">
      {bars}
    </svg>
  );
}

// Hero artwork: a ticket for the same example event the previews below use, stamped at the door.
export default function HeroTicket() {
  return (
    <div className={styles.ticketScene} aria-hidden="true">
      {/* The order's second ticket, peeking out behind the first */}
      <div className={styles.ticketBack}>
        <div className={styles.ticketBackStub}>
          <div><small>Ticket 2 of 2</small><strong>Ada Chen +1</strong></div>
          <Barcode />
        </div>
      </div>
      <div className={styles.ticket}>
        <div className={styles.ticketTop}>
          <div className={styles.ticketIssuer}>
            <span><Logo size={18} />Geiger Events</span>
            <small>ADMIT 1</small>
          </div>
          <div className={styles.ticketEvent}>Nightshift<br />2026</div>
          <div className={styles.ticketWhen}>Sat 14 Mar · Doors 21:00 · The Foundry</div>
        </div>
        <div className={styles.ticketStub}>
          <dl className={styles.ticketFields}>
            <div><dt>Guest</dt><dd>Ada Chen</dd></div>
            <div><dt>Ticket</dt><dd>General</dd></div>
            <div><dt>Order</dt><dd>GE-20418</dd></div>
            <div><dt>Entry</dt><dd>Door B</dd></div>
          </dl>
          <QrCode className={styles.ticketQr} size={52} strokeWidth={1.25} />
        </div>
        <div className={styles.ticketStamp}>
          <strong><Check size={14} strokeWidth={2.5} />Checked in</strong>
          <span>21:07 · Door B</span>
        </div>
      </div>
    </div>
  );
}
