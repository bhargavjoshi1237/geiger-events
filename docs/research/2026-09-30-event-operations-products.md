# Configurable event operations: product research

Research date: 30 September 2026. Prepared for Geiger Events.

## What the requirement is called

The proposed product is a **configurable event management workspace**, with an emphasis on **event operations**. CRM covers contacts, relationships, and communication history; it does not describe room allocation, staff assignments, attendance, evaluation, or operational workflows adequately. The conference-specific part is often called abstract management, program management, or speaker management.

Suggested user-facing name: **Event Workspace**. Suggested optional product capability: **Operations**. An organiser enables it for an event and assembles the modules they need.

## Comparable products

The table records capabilities described in each vendor's own documentation. It is a feature discovery exercise, not a hands-on product evaluation. A capability missing from the reviewed pages is **unverified**, rather than proof that a product lacks it. Vendor claims about competitors were excluded. Pricing was excluded because entitlements, usage limits, and quotes need a separate purchasing comparison.

| Product | Verified overlap | Pattern useful to Geiger | Difference to investigate in a demo |
| --- | --- | --- | --- |
| Cvent | Custom submission forms; track/topic reviewer assignment; reviewer scoring and notes; acceptance notifications; agenda integration. Its Speaker Resource Center adds assigned tasks, deadlines, reminders, and speaker access. | Treat review, programme construction, and speaker preparation as connected workflows with distinct interfaces. | Whether onsite presentation judging and organiser-defined operational entities can be configured to the required depth. Sources: [Abstract Management](https://www.cvent.com/en/event-marketing-management/abstract-management-software), [Speaker Resource Center](https://www.cvent.com/en/event-management-software/speaker-resource-center). |
| EventsAir | Custom presenter submission portals; reviewer portals with scores and notes; assignment by topic/theme; review monitoring; synchronized agenda changes. Its broader suite includes check-in, logistics, and exhibitor portals. | Give each participant role a focused portal while keeping the event's operational data shared. | Record-level restrictions for room staff and evaluators; flexibility outside its established event modules. Sources: [Abstract Management](https://www.eventsair.com/event-management-software/abstract-management-software), [Platform](https://www.eventsair.com/event-management-software). |
| Oxford Abstracts | Configurable submission forms; review and decisions; customizable communications and scheduled reminders; reviewer autosave; conference programme/schedule builder. | Make forms and communications configurable, and let reviewers safely save work in progress. | Day-of-event attendance capture and presentation evaluation as separate processes. Source: [Abstract Management](https://oxfordabstracts.com/product/abstract-management-software/). |
| Ex Ordo | Submission, allocation, review, decision, presentation-material, and timetable phases; blind review settings; presenter schedule conflict checking. | Explicit stages, release points, and conflicts are preferable to a free-form status field. | Live presentation attendance/judging and custom operational modules beyond its academic workflow. Sources: [Conference workflow](https://support.exordo.com/article/523-conference-workflow), [Conflict checker](https://help.exordo.com/checking-your-programme-for-conflicts), [Review configuration](https://help.exordo.com/configuring-review). |
| Fourwaves | Custom submission forms; manual/automatic reviewer assignment; single/double-blind review; configurable scoring forms; reviewer-visible field selection; accepted-submission scheduling; presenter certificates. | Preserve the relationship from submission to presentation, and make score criteria and reviewer visibility explicit. | Whether presentation-day grading/attendance can be independent of pre-event peer review. Sources: [Abstract Management](https://fourwaves.com/abstract-management-software/), [Customize reviews](https://help.fourwaves.com/en/articles/8350208-customize-reviews). |
| Sessionize | Call for speakers; submitted-session evaluations; multiple evaluation plans; evaluator assignment; anonymous mode; deadlines; schedule publishing; attendee feedback. | Separate draft configuration from opening evaluation, protect completed evaluations, and show assignment progress. | Its submitted-session evaluation and attendee feedback must not be assumed to equal staff judging of delivered presentations. Sources: [Overview](https://sessionize.com/playbook/platform-overview), [Evaluations](https://sessionize.com/playbook/evaluations/evaluations-start-to-finish). |
| Airtable | Custom interfaces over existing data; published interfaces; interface collaborator permissions; buttons that trigger automations. | A configurable operational interface can serve different teams over one set of records. | Tenant isolation, assignment-bound access, publication consistency, and event constraints would need explicit engineering. Sources: [Interface Designer](https://www.airtable.com/platform/interface-designer), [Permissions](https://support.airtable.com/articles/2193541120-interface-designer-permissions), [Automation buttons](https://support.airtable.com/articles/2099494420-using-buttons-in-interfaces). |
| Zoho Creator | Form-triggered workflows, conditional actions, schedules, custom buttons, and approvals within a general application builder. | Offer bounded trigger/condition/action building blocks for organiser-specific work. | Event scheduling rules, presenter identity, review privacy, and operational reliability must be supplied by the application design. Source: [Workflow automation](https://www.zoho.com/creator/automate-workflow.html). |

## Conclusions for the proposed product

The following are our design conclusions, inferred from the requirement and these sources, rather than vendor claims:

1. **This is an established need.** Submission review, speaker coordination, scheduling, and role-specific portals appear across the event products reviewed.
2. **Configuration should start from useful templates.** The academic products demonstrate the value of a clear submission/review/programme workflow. A blank application builder puts too much initial modelling work on an organiser.
3. **The differentiator to validate is configurable live operations.** The initial research does not establish that no competitor supplies the exact requested combination. Interview organisers about switching costs and test the complete scenario in vendor demos before making uniqueness claims.
4. **The conference is a first domain pack, not the entire platform.** Forms, assignments, resources, attendance, evaluations, communications, and audit history can serve workshops, competitions, exhibitions, and festivals.
5. **Peer review and live judging are separate.** Several vendor pages describe evaluations of submissions before selection. That is useful research, but it is not evidence of day-of-event presenter attendance and evaluation.

## Three build approaches

| Approach | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Native event modules plus configuration | Reliable core event rules, useful defaults, custom fields/forms/views/workflows, native connection to existing tickets and contacts | Requires an explicit extension contract and versioned configuration | **Recommended** for Geiger |
| Build a fully general application builder | Organisers can model almost anything | Much larger schema, permission, expression, reporting, and UI-builder problem; useful event workflows still need to be built | Defer unrestricted flexibility; add bounded custom records after a pilot |
| Integrate Airtable/Zoho or a conference vendor | Fast way to test a process or import existing conference data | Multiple identities/data stores, integration maintenance, licensing questions, and fragmented UX | Offer integrations/imports; use as a validation tool where helpful |

## Validation before a large implementation

Recruit 3–5 organisers across academic conferences and at least one other event type. Have each walk through their most recent event, showing actual spreadsheets, forms, staff roles, last-minute changes, and outputs. Obtain permission before inspecting real participant data.

For the conference, test a room reassignment after initial notifications, a presenter who is not the submitting author, two evaluators grading the same talk, an absent presenter, a revoked evaluator, and incomplete evaluations at closure. Ask which of these are essential versus occasional exceptions.

Measure time spent assigning people, chasing confirmations, entering attendance, and consolidating scores. This establishes whether the new workspace is solving a costly operational problem, rather than simply recreating a spreadsheet interface.

## Technical references checked

- [Supabase Queues](https://supabase.com/docs/guides/queues): Postgres-backed durable queue facilities. Application effects still need idempotency and recovery; the queue's visibility-window guarantee is not a guarantee that an external email is sent only once.
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions): scheduled consumers can process bounded batches. The deployment must verify actual limits and extension availability.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): database authorization for clients accessing exposed tables; privileged service clients require separate server authorization.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): policies for private file access.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): enforce identity, reference, and uniqueness invariants in the database.
- [Supabase database upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes): check deployed Postgres/extension versions before considering range/exclusion indexes. No live database version or migration state was inspected for this research.
- The installed Next.js guides at `node_modules/next/dist/docs/01-app/02-guides/data-security.md` and `01-app/01-getting-started/15-route-handlers.md` were read. They support a server-only data access layer, authorization at data boundaries, minimal response objects, and Route Handlers. The eventual implementation must read the installed guides relevant to each change again if the dependency version changes.
