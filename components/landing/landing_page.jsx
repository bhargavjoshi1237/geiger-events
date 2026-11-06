import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Plus, Users } from "lucide-react";
import Footer from "@geiger/ui/footer";
import { Header } from "@/components/header";
import HeroTicket from "./hero_ticket";
import ProductExplorer from "./product_explorer";
import ConnectedJourney from "./connected_journey";
import EventsPlaygroundShowcase from "@/components/EventsPlaygroundShowcase";
import PosterFieldCta from "./poster_field_cta";
import { getEventGuides } from "@/lib/landing/event-guides";
import styles from "./landing.module.css";

const SITE_URL = "https://geiger.studio";

const faqs = [
  {
    question: "Does Geiger Events charge a fee per ticket?",
    answer: "No. Geiger Events adds no platform fee. Ticket payments go to your own Stripe account, and you pay only Stripe's processing fee, straight to Stripe.",
  },
  {
    question: "Can I try it before creating an account?",
    answer: "Yes. The previews on this page and the playground use example data, and the playground opens the full workspace without signing in. Changes you make there aren't saved.",
  },
  {
    question: "Can I run different kinds of events?",
    answer: "Each event picks its own mix of ticket tiers, registration forms, agenda, seating and exhibitor floor. Templates and series let you reuse a setup for the next date.",
  },
  {
    question: "Who can see my event data?",
    answer: "Only members of your project. Project roles control what each person can see and change, and workspace content is never used for advertising.",
  },
  {
    question: "Can my team work in the same workspace?",
    answer: "Yes. Invite teammates to the project and give each one a role, such as door staff or organizer.",
  },
];

// The hero stub's index of the page, in page order.
const sections = [["Event page & door", "#platform"], ["Follow-up", "#workflow"], ["Formats", "#formats"], ["Every feature", "#capabilities"], ["Playground", "#playground"], ["Guides", "#guides"], ["Questions", "#faq"]];

// What search engines and AI answers should know about the product; plan prices mirror /pricing, so change both together.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/events#app`,
      name: "Geiger Events",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Event ticketing, registration and check-in software",
      operatingSystem: "Web",
      url: `${SITE_URL}/events`,
      description: "Geiger Events covers the event page, ticketing, registration, agenda and door check-in in one workspace, with no platform fee on ticket sales.",
      featureList: [
        "Event pages with a drag-and-drop page builder",
        "Free and paid ticketing through the organizer's own Stripe account, with no platform fee",
        "Custom registration questions",
        "Approval before payment for invite-only events",
        "Reserved seating on venue seat maps",
        "Conference agenda builder with tracks and speakers",
        "Exhibitor booth sales on a floor plan",
        "Sponsorship spots with a public prospectus page",
        "VIP and hospitality packages",
        "Memberships and a members portal",
        "QR code tickets",
        "Door check-in app with staff roles",
        "Venue display boards that update from the agenda",
        "Merch and badge pickup tracking that blocks double collection",
        "Affiliate and promoter tracking add-on",
      ],
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "0",
        highPrice: "119",
        offerCount: 4,
        url: `${SITE_URL}/pricing`,
        description: "A free Early access plan, then Basic $29, Plus $79 and Pro $119 a month. No platform fee on ticket sales; Stripe's processing fee applies.",
      },
      publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Geiger Studios", url: `${SITE_URL}/` },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

const guideGroups = [
  ["features", "Features"],
  ["useCases", "By event type"],
  ["compare", "Compare"],
];

function SectionHeading({ title, description }) {
  return (
    <div className={styles.sectionHeading}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description && <p className={styles.sectionDescription}>{description}</p>}
    </div>
  );
}

const formats = [
  {
    title: "Meetups and RSVPs",
    description: "Publish a page, collect free RSVPs or paid tickets, and check guests in at the door.",
    link: "See registration",
    href: "/features/events/event-registration-rsvp",
    art: <div className={styles.formatArt} aria-hidden="true"><div className={styles.orbitCircle} />{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--i": i }} />)}<Users size={30} strokeWidth={1.25} /></div>,
  },
  {
    title: "Conferences and seated venues",
    description: "Run a multi-track agenda, sell assigned seats and lay out the exhibitor floor.",
    link: "See seating and agenda",
    href: "/solutions/events/conference-event-software",
    art: <div className={`${styles.formatArt} ${styles.seatsArt}`} aria-hidden="true"><span>Stage</span><div>{Array.from({ length: 60 }, (_, i) => <i key={i} />)}</div></div>,
  },
  {
    title: "Recurring series",
    description: "Copy an event's setup to the next date and list every date on one event wall.",
    link: "See series",
    href: "/features/events/event-series-recurring",
    art: <div className={`${styles.formatArt} ${styles.seriesArt}`} aria-hidden="true">{["Fri 03 Oct", "Fri 10 Oct", "Fri 17 Oct"].map((date, i) => <div key={date} style={{ "--i": i }}><span>Open Mic</span><strong>Open<br />Mic</strong><span>{date}</span></div>)}</div>,
  },
];

export default async function EventsLandingPage() {
  const guides = await getEventGuides();

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <Header dashboardHref="/org" />
      <main id="main-content" className={styles.main}>
        {/* The hero is the ticket: it tears off along a perforation, and the stub below indexes the page */}
        <div className={styles.heroPanel}>
          {/* Suite grid wash, the same one geiger-dash uses (GridBackdrop "default") */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[linear-gradient(to_right,#80808030_1px,transparent_1px),linear-gradient(to_bottom,#80808030_1px,transparent_1px)] bg-[size:24px_24px] [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent,#000_120px),radial-gradient(ellipse_60%_55%_at_50%_0%,#000_70%,transparent_100%)]" />
          <section className={`${styles.container} ${styles.hero}`}>
            <div>
              <h1 className={styles.heroTitle}>Sell the tickets & run the door from one workspace.</h1>
              <p className={styles.heroDescription}>Geiger Events covers the event page, ticketing, registration, agenda and check-in. Orders, attendees and sessions stay in one project your team shares.</p>
              <div className={styles.actions}>
                <Link href="/org" className={styles.primaryButton}>Create Events<ArrowRight size={16} /></Link>
                <a href="#playground" className={styles.secondaryButton}>Try Playground</a>
              </div>
            </div>
            <HeroTicket />
          </section>
          <div className={styles.tearLine} aria-hidden="true" />
          <nav className={`${styles.container} ${styles.heroStub}`} aria-label="On this page">
            <span>Inside</span>
            {sections.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
            <ArrowDown size={16} className={styles.heroStubArrow} aria-hidden="true" />
          </nav>
        </div>

        <section id="platform" className={`${styles.container} ${styles.section}`}>
          <SectionHeading
            title="Guests and your team work from the same event"
            description="The event page, the door scanner, the attendee portal and the staff desk all read the same orders and tickets." />
          <ProductExplorer variant="surfaces" />
        </section>

        <section id="workflow" className={`${styles.container} ${styles.section}`}>
          <SectionHeading
            title="Know who bought, and plan what happens next"
            description="Build audiences from tickets, spend and tags, and lay out the follow-up in the workflow builder." />
          <ProductExplorer variant="automation" />
        </section>

        <ConnectedJourney />

        <section id="formats" className={`${styles.container} ${styles.section}`}>
          <SectionHeading
            title="Use only the parts your event needs"
            description="A meetup needs a page and a guest list. Turn on seating, sessions and exhibitors when the event calls for them." />
          <div className={styles.formatCards}>
            {formats.map(({ title, description, link, href, art }) => (
              <article key={title} className={styles.formatCard}>
                {art}
                <h3>{title}</h3>
                <p>{description}</p>
                {/* Plain anchors: the guides live on the dash at the domain root, outside this app's basePath */}
                <a href={href} className={styles.textLink}>{link}<ArrowRight size={14} /></a>
              </article>
            ))}
          </div>
        </section>

        <section id="capabilities" className={`${styles.container} ${styles.section}`}>
          <SectionHeading
            title="Browse every feature"
            description="Everything in Geiger Events at a glance. The preview plays through each feature in turn, or pick one to jump straight to it." />
          <ProductExplorer variant="capabilities" />
        </section>

        {/* The playground breaks out of the content column so the workspace has room */}
        <section id="playground" className={styles.section}>
          <div className={styles.container}>
            <SectionHeading
              title="Try the real workspace"
              description="The playground opens the Events dashboard with example data. Click anywhere you like; nothing you change is saved." />
          </div>
          <EventsPlaygroundShowcase />
        </section>

        {guides ? (
          <section id="guides" className={`${styles.container} ${styles.section}`}>
            <SectionHeading
              title="Guides for every feature"
              description="How each part of Geiger Events works, which events it suits, and how it compares with the tools you may use now." />
            <div className={styles.guideGroups}>
              {guideGroups.map(([key, label]) => guides[key].length ? (
                <div key={key} className={styles.guideGroup}>
                  <h3>{label}</h3>
                  <ul>
                    {guides[key].map((guide) => <li key={guide.href}><a href={guide.href}>{guide.title}</a></li>)}
                  </ul>
                </div>
              ) : null)}
            </div>
          </section>
        ) : null}

        <section id="faq" className={`${styles.container} ${styles.section} ${styles.faqSection}`}>
          <div>
            <h2 className={styles.sectionTitle}>Questions</h2>
            <a href="mailto:help@geiger.studio" className={styles.textLink}>Email help@geiger.studio<ArrowUpRight size={14} /></a>
          </div>
          <div>
            {faqs.map(({ question, answer }) => (
              <details className={styles.faq} key={question}>
                <summary>{question}<Plus size={18} aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <PosterFieldCta dashboardHref="/org" />
      </main>
      <Footer />
    </div>
  );
}
