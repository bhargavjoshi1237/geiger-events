# Workspace — Templates (sub-project 8 of 8)

Date: 14 November 2026 · Status: decided by Claude under the user's standing instruction; open to review
Needs: all earlier sub-projects. This is the acceptance test for the platform: every template is **data only** — if a template needs new code, the platform is missing a feature.

## Goal

Start a workspace from a complete, working setup for five kinds of event: **Research conference**, **Hackathon**, **Exhibitors**, **Volunteers**, **Awards** — lists, fields, stages and rules, automations, review setup, documents, portal roles and pages.

## Decisions

| Topic | Decision |
|---|---|
| Format | One template = one JSON-like module (`lib/workspace/templates/builtin/*.js`) describing parts with **local keys** instead of ids (`list: "paper"`, `field: "paper.title"`). An installer resolves keys to ids as it creates things. |
| Installer | Runs every part through the normal services (structure commands, process config, automations, documents, portal config), so templates obey the same validation as hand-built workspaces. Idempotent per template + event: re-running fills in what's missing. |
| Snapshot | "Save as template" and "Copy from another event" now carry stage rules, automations (disabled on arrival), review setups, documents and the portal draft (roles + pages), remapped to the new ids. |
| Gallery | Setup screen: *Start empty · From a template · Copy from an event*. Each built-in template shows what it contains before installing. |
| Showcase | `scripts/seed-workspace-showcase.mjs` (ICAML 2026) gains stage rules, automations, a review setup, documents and a certificate, so every feature has a live example. |

## Templates

| Template | Lists | Process | Portal |
|---|---|---|---|
| Research conference | People, Papers, Reviews, Topics, Sessions, Rooms, Attendance | Submitted → Under review → Accepted / Rejected / Withdrawn; 3 reviewers, topic matching, author conflicts; decision emails; certificate of presentation | Authors submit and follow papers; reviewers review blind; session chairs take attendance |
| Hackathon | People, Teams, Projects, Judging scores, Challenges | Registered → Team formed → Submitted → Judged; judges assigned per challenge; results email | Participants register, form teams, submit; judges score |
| Exhibitors | Companies, Contacts, Booth applications, Booths, Deliveries | Applied → Approved (approval step) → Contract sent → Paid → Placed; booth placement with capacity | Exhibitors apply and manage their stand details |
| Volunteers | Volunteers, Shifts, Assignments, Check-ins | Applied → Approved → Scheduled; shift placement; reminder emails the day before | Volunteers apply, pick shifts, see their pass QR; leads scan check-ins |
| Awards | Nominees, Categories, Judges, Scores | Nominated → Shortlisted → Winner; judges with conflict rules; winner certificates | Public nominations; judges score their categories |

## Testing

A dry-run harness installs each template into an in-memory definition and validates every part (links resolve, placeholders refer to real fields, steps validate, pages validate). Lint; build.

## Decisions made while building (15 Nov 2026)

- References instead of ids: `#list:<key>`, `#field:<list>.<field>`, `#role:<key>`, `#doc:<name>`, `#review:<name>` and `#me` (whoever installs it), as values or as object keys anywhere in a part (`lib/workspace/templates/refs.js`). Built-ins are written with a small DSL (`templates/dsl.js`); snapshots of real events are turned into the same references (`templates/carry.js`), so one installer serves both.
- Install order: lists and fields (through the copy service's `applySnapshot`, which skips lists and fields that already exist by key) → stage rules → review setups → documents → automations → portal settings, roles and pages. Parts are matched by name (pages by address, record pages by list), so running it again updates them instead of duplicating. Each part that fails or refers to something missing becomes a note shown after installing; the rest still installs.
- Automations always arrive turned off, from built-ins and copies alike. Steps that need a team member (approvers, team emails) use the person installing, who must be on the project team.
- Built-in portal roles (Public visitor, Anyone signed in) only take access settings from a template or copy; they're never created as look-alikes.
- "Copy from another event" carries the extras of the lists being copied (switch off with `choices.extras: false`), and "Save as template" stores them in the snapshot. Approver and team ids are kept as they are, since templates and copies stay within one project.
- The dry-run harness (`dryRun` in `templates/installer.js`, run by `templates.test.js`) builds each template in memory and runs every part through the real validators: fields, stage rules, review setups, documents (placeholders included), triggers, steps and conditions, roles and pages. All five pass with no code.
- Gallery: the setup screen's "From a template" opens the built-in gallery (contents listed before installing). Settings gets "Add a built-in template" for workspaces that already exist.
- Showcase: `scripts/seed-workspace-showcase.mjs` now adds stage rules for papers and reviews, the "ICAML peer review" setup, a decision email template, a certificate PDF, six automations (assign reviewers, decision email, issue a certificate, due-date reminders, a code step, a webhook-driven session upsert) and one issued certificate.

## Out of scope

A public template marketplace; templates with sample records.
