import {
  ArrowLeftRight, Armchair, Award, BadgeCheck, BookOpen, Briefcase, Building2, CalendarRange, ChartColumn, ClipboardCheck,
  Contact, Copy, FileText, Globe, GraduationCap, Handshake, HeartHandshake, LayoutGrid, LayoutTemplate, Mail, Map, MapPin,
  MessagesSquare, Mic, MonitorPlay, Music, Nfc, PanelsTopLeft, Presentation, Printer, Repeat, ScanLine, ShieldCheck, Store,
  Tent, Ticket, TicketPercent, TrendingUp, UserRound, Users, Video, Wallet, Webhook, Workflow,
} from "lucide-react";
import styles from "./landing.module.css";

// Title keywords → icon, most specific first, so newly published guides still pick up a fitting icon.
const ICONS = [
  [/call for papers/, FileText], [/lead retrieval/, Contact], [/seat map|floor plan/, Map], [/reserved seating/, Armchair],
  [/membership/, BadgeCheck], [/nfc|rfid/, Nfc], [/badge/, Printer], [/check-in/, ScanLine], [/pricing/, TrendingUp],
  [/festival/, Tent], [/nightlife|club/, Music], [/scalping|resale/, ShieldCheck], [/wallet/, Wallet], [/agenda|speaker/, CalendarRange],
  [/domain|white-label/, Globe], [/automation|workflow/, Workflow], [/recurring|series/, Repeat], [/organizer event page/, PanelsTopLeft],
  [/organizer profile|follower/, UserRound], [/event pages|visual builder/, LayoutTemplate], [/sponsor/, Handshake], [/expo|trade show/, LayoutGrid],
  [/venue sourcing/, MapPin], [/venue/, Building2], [/analytics|reporting/, ChartColumn], [/api|webhook/, Webhook], [/crm|contacts/, Users],
  [/ceu|certificate/, Award], [/engagement/, MessagesSquare], [/community/, Users], [/discount|coupon/, TicketPercent], [/email|sms/, Mail],
  [/livestream|webinar/, Video], [/virtual|hybrid/, MonitorPlay], [/workshop|class/, GraduationCap], [/registration|rsvp/, ClipboardCheck], [/template/, Copy],
  [/conference|summit/, Presentation], [/corporate|b2b/, Briefcase], [/independent creator/, Mic], [/small business/, Store],
  [/nonprofit|fundraising/, HeartHandshake], [/ticket/, Ticket],
];
const iconFor = (title) => ICONS.find(([pattern]) => pattern.test(title.toLowerCase()))?.[1] ?? BookOpen;

// "The Bizzabo Alternative Without the Seat Minimum" → "vs Bizzabo"; the full headline stays as the link's title.
const compareLabel = (title) => {
  const match = title.match(/^The (.+?) Alternative/i);
  return match ? `vs ${match[1]}` : title;
};

function GroupHeading({ label, count }) {
  return <h3 className={styles.guideHeading}>{label}<span>{count}</span></h3>;
}

// Features as an icon grid; event types and comparisons as compact chips underneath.
export default function GuideIndex({ guides }) {
  const { features = [], useCases = [], compare = [] } = guides;
  return (
    <div className={styles.guideIndex}>
      {features.length ? (
        <div>
          <GroupHeading label="Features" count={features.length} />
          <ul className={styles.guideGrid}>
            {features.map((guide) => {
              const Icon = iconFor(guide.title);
              return <li key={guide.href}><a href={guide.href}><span><Icon size={16} /></span>{guide.title}</a></li>;
            })}
          </ul>
        </div>
      ) : null}
      <div className={styles.guideChipGroups}>
        {useCases.length ? (
          <div>
            <GroupHeading label="By event type" count={useCases.length} />
            <ul className={styles.guideChips}>
              {useCases.map((guide) => {
                const Icon = iconFor(guide.title);
                return <li key={guide.href}><a href={guide.href}><Icon size={14} />{guide.title}</a></li>;
              })}
            </ul>
          </div>
        ) : null}
        {compare.length ? (
          <div>
            <GroupHeading label="Compare" count={compare.length} />
            <ul className={styles.guideChips}>
              {compare.map((guide) => <li key={guide.href}><a href={guide.href} title={guide.title}><ArrowLeftRight size={14} />{compareLabel(guide.title)}</a></li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
