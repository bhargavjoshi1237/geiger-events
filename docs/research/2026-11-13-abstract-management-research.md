# Abstract collection (Call for Papers): market research and fit with Geiger Forms

2026-11-13. Covers what abstract management is, what Cvent and its competitors offer, what Geiger Events and Geiger Forms already have, and a recommended way to build it.

## 1. What "collecting abstracts" means

A conference opens a **call for papers / abstracts / speakers**. Anyone can submit a proposal, a committee reviews it, the organiser decides, and accepted items become sessions on the agenda. The industry splits the lifecycle into four stages (Cvent uses exactly these names): **Collect → Review → Decide → Publish**.

| Stage | What a serious tool does |
|---|---|
| **Collect** | Public, branded submission form (no account, or a light submitter login). Title, abstract with a **word limit** (150–350 words is typical, 250 the most common), track/topic, format (talk, workshop, panel, poster), co-authors / co-speakers with a per-submission cap, bio, headshot, file upload (paper PDF, slides), consent and disclosure questions. Open/close dates enforced automatically, drafts, edit until the deadline, withdraw. Optional submission fee. Often a separate **late-breaking** track with its own deadline and limit. |
| **Review** | A reviewer pool (often external people, not staff). Assignment by track, topic or expertise, manually or automatically, N reviewers per submission. Scoring against a **rubric** the organiser defines (several criteria, 1–5 each), comments to the committee and comments to the author. **Blind review** (author identity hidden). Conflict-of-interest declaration before a reviewer sees anything. Sometimes multiple rounds. |
| **Decide** | Aggregate score and spread per submission. Outcomes beyond yes/no: accept as oral, accept as poster, waitlist, reject, revise-and-resubmit. Individual and **bulk** decisions, then templated decision emails. Speaker confirms or declines. |
| **Publish** | Accepted submission → agenda session and speaker profile in one step. Attendees can register for or bookmark the session. Academic tools also produce a **book of abstracts / proceedings**. |

## 2. Cvent

### The platform

Cvent is the enterprise incumbent: a Gartner Magic Quadrant leader for event marketing and management three years running (per Cvent), and since its December 2025 Goldcast and April 2026 ON24 acquisitions it also covers webinars. Core products:

- **Cvent Registration**: registration sites and forms, the entry point for most customers
- **OnArrival**: on-site check-in, badge printing, session capacity control
- **Attendee Hub**: web and mobile event app (personal agendas, polling, networking, virtual/hybrid)
- **Lead Capture**: exhibitor lead retrieval
- Add-ons sold separately, each with its own annual fee: **Abstract Management**, Speaker Resource Center, Surveys, and more

Pricing is quote-only. There is no public list price for Abstract Management. Third-party estimates for whole-platform contracts run to six figures a year, but they conflict and can't be verified. It is aimed at enterprises and associations, not small or academic events.

### Cvent Abstract Management

What Cvent's own marketing page and support pages say:

- **Collect**: customisable submission forms (layout, branding, fields, sub-questions, contact fields, consent questions). Handles abstracts, sessions, papers and **awards**. Mobile-friendly portal. Co-authors with a configurable cap (up to 100). Planners can submit on an author's behalf. Automated invitation, confirmation and reminder emails.
- **Review**: reviewers imported in bulk or added one by one with topics of expertise; assignment by track, topic or expertise. A reviewer portal for rating against criteria you define, commenting and leaving notes, with scores and votes tracked in real time. Blind review or author information shown (from a university brochure).
- **Decide**: accept or reject individually or in bulk, with automated acceptance/rejection emails.
- **Publish**: link the abstract project to an event, create sessions directly from accepted submissions, publish them to the agenda, and open them for attendee registration. Speaker logistics after acceptance sit in a separate product, **Speaker Resource Center**.

Known weak spots (from user reviews and competitors):
- The person who submits is always the primary author.
- Not built for academic workflows (proceedings, journal publishing). Competitors such as Sessionboard sell an abstract-to-program layer that sits *beside* Cvent registration, so Cvent's own module isn't always the default choice.
- Expensive and only sold as an add-on to an existing Cvent contract.

Not confirmed from any readable source: conflict-of-interest handling, multi-round review, poster vs oral outcomes, submission fees, word limits. The detailed Cvent support articles don't render outside a browser.

## 3. Other tools worth copying from

| Tool | Positioning | Notable |
|---|---|---|
| **Oxford Abstracts** | Academic conferences, from about £575 per event | Custom review form, custom **decision form**, assign reviewers, schedule abstracts into symposia, **book of abstracts**, exports sessions *into* Cvent |
| **Ex Ordo** | Academic and peer review | Multi-round, multi-track peer review, then **proceedings published to journals** (SPIE, BioOne) |
| **Sessionize** | Tech and community conferences, free for community events | Call opens and closes automatically, caps on submissions per speaker and on co-speakers. **Three evaluation modes: star rating (with custom criteria), Yes/No, and Comparison** (pick the better of two). Multiple evaluation plans, each with its own reviewers |
| **Sessionboard, Accelevents, EventsAir, Fourwaves, Dryfta** | Mid-market | Same Collect → Review → Decide → Publish shape, usually with a speaker portal after acceptance |

**Worth copying:** Sessionize's **Comparison mode**. Reviewers burn out on absolute 1–5 scoring across hundreds of abstracts, and pairwise "which is better" gives a cleaner ranking. None of the enterprise tools advertise it.

## 4. What we already have

### Geiger Events: the Call for Papers module (records only)

`components/internal/screens/conference/modules/paper.jsx` is a `conference_records` module (`module: "paper"`): title, author, email, track, format (Talk/Workshop/Panel), abstract, topics, **one hand-typed `score`**, reviewer notes and a status.

- There is **no public submission form**. The organiser types every submission in.
- No reviewer pool, assignment, rubric or blind mode.
- No link to Agenda Builder, so an accepted submission doesn't become a session.
- `docs/research/2026-11-06-feature-coverage-inventory.md` marks the public call-for-papers page as **overclaiming**, and `docs/pending/19-program.md` already lists the P0 work (public route, reviewer pool, rubric, decision round, emails, accept → session).

### Geiger Forms: most of the Collect stage, and part of Review

Forms (`C:\Pro\geiger-forms`, `forms` schema in the same Supabase project) already ships much of what the submission side needs:

| Need | In Forms today |
|---|---|
| Public branded submission form | Yes: public filler at `/form/[slug]`, themes, fonts, logo, 7 languages |
| Custom fields, conditional logic | Yes: the full field set and logic |
| Co-authors | Yes, as a **repeating group** field (name, email, affiliation per row) |
| File upload (paper PDF, headshot) | Yes |
| Consent / disclosure | Yes, with a timestamp and a hash of the wording |
| Drafts | Yes: save and resume, partial submissions |
| Edit after submit | Partly: an edit window (1h up to always), but no "until the deadline" option |
| Close at a deadline or cap | Yes: submission rules and a response cap |
| Submission fee | Yes: Stripe |
| Confirmation email + PDF of the submission | Yes |
| Inbox: kanban by status, saved views, bulk actions | Yes |
| Assign to a reviewer | Partly: **one** assignee per response, workspace members only |
| Approval with vote rules | Partly: multi-step approvals with any/all/majority rules, but approvers must be signed-in workspace users, and they vote approve/reject with no scores |
| Internal comments, @mentions | Yes |
| Webhooks / API | Yes, signed webhooks with retries |

**What Forms lacks for abstracts:**
1. **Word limits.** Validation only has character min/max (`lib/forms/logic.js:356`). Abstracts are always specified in words.
2. **Per-reviewer rubric scoring** with an aggregate (mean, spread). Its scoring is respondent-answer scoring, not reviewer scoring.
3. **Blind review**, meaning hiding the author fields from reviewers. Sensitive-field masking is close but is built for PII, not this.
4. **External reviewers**, people who aren't workspace members, through a link with a token.
5. **Conflict-of-interest declaration** and multiple reviewers per submission.
6. **A submitter status page**: "my submissions", their status, withdraw.
7. **Decision outcomes** beyond approve/reject (oral, poster, waitlist), plus bulk decision emails.
8. **A hand-off into Events**: submission → `paper` record → agenda session + speaker.

## 5. Recommendation

**Split it by what each app is good at. Forms collects and reviews, Events decides and publishes.**

1. **Collect in Forms.** Don't build a second form builder inside Events. Add a **"Call for papers" form template**: title, abstract (word-limited), track, format, co-authors (repeater), bio, headshot, file and consent. Add **word-count validation** to Forms. Events links to the form; it doesn't embed a separate one.
2. **Review in Forms, as a general "Review rounds" feature.** Rubric scoring, N reviewers per response, blind mode, external reviewers through tokenised links, a conflict-of-interest prompt, and a fast keyboard-driven review screen (abstract on the left, rubric on the right, next/previous). This isn't specific to conferences: **grant applications, awards, hiring and scholarships** all need it, so it's a Forms selling point in its own right and closes a gap against Submittable and similar tools.
3. **Decide and publish in Events.** Forms responses sync into the Events Call for Papers module (webhook or a DB function into `conference_records`, `module: "paper"`) carrying the aggregate score. Events owns the program-committee view (a board by status, decisions of oral/poster/waitlist/reject, bulk decision emails) and the step that matters most: **accepted → session in Agenda Builder + speaker record**, which nothing does today.
4. **Afterwards:** a submitter status page in the members portal, Sessionize-style comparison mode, and a book of abstracts (PDF) generated with Forms' existing PDF pipeline.

**Alternative:** build everything inside Events, as `docs/pending/19-program.md` currently assumes. That's faster for the events use case alone, but it duplicates the form builder, uploads, payments and drafts that Forms already has, and leaves Forms without the reviewer workflow other buyers want.

**Open decision for you:** does reviewing live in Forms (generic, reusable) or in Events (conference-only)? Everything else follows from that.

## Sources

- Cvent Abstract Management: https://www.cvent.com/en/event-marketing-management/abstract-management-software
- Cvent support, adding co-authors / submitting for authors: https://support.cvent.com/s/communityarticle/Submitting-Submissions-for-Your-Authors
- Cvent support, limiting co-authors: https://support.cvent.com/s/communityarticle/How-do-I-limit-the-number-of-co-authors-for-a-submission
- Cvent platform: https://www.cvent.com/en/platform · Attendee Hub: https://www.cvent.com/en/attendee-hub
- Cvent features overview (ZoomInfo, third-party): https://pipeline.zoominfo.com/sales/cvent-features
- Cvent pricing estimates (third-party, unverified): https://www.costbench.com/software/event-management/cvent/ · add-ons: https://www.cu.edu/print/blog/ecomm-wiki/cvent-add-ons-purchase
- Cvent Abstract Management reviews: https://www.trustradius.com/products/cvent-abstract-management/reviews/all
- Competitor roundups (vendor-written): https://fourwaves.com/blog/best-abstract-management-software/ · https://www.sessionboard.com/blog/best-abstract-management-software · https://oxfordabstracts.com/blog/the-best-abstract-management-software-a-comparison/ · https://www.eventsair.com/blog/best-abstract-management-software
- Sessionize evaluations: https://sessionize.com/playbook/evaluations/evaluations-start-to-finish · features: https://sessionize.com/features
- Oxford Abstracts: https://get.oxfordabstracts.com/abstract-management
- Abstract word limits and structure: https://casrai.org/guides/sample-conference-abstract-format-word-limits · https://openwater.com/blog/abstract-submission-standards
