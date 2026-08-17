# 19 — Program

| | |
|---|---|
| **Nav items** | 5 — Agenda Builder, Display Boards, Call for Papers, Assign Agenda, CEU & Certificates |
| **Registered** | 5/5 |
| **Tier** | **A** for Agenda Builder + Display Boards · **B** for CFP and CEU |
| **Key files** | `conference/agenda_builder.jsx` (980) + `agenda_grid.jsx` (459) + `lib/agenda/sessions.js`, `display_boards.jsx` (587) + `display/board_builder.jsx` (502) + `lib/display/*` + `app/display/[boardId]`, `conference/modules.jsx` (paper, certificate, agenda_assignment) |

---

## 1. What this means in industry

The program layer (Cvent Abstract Management, Swapcard, Sessionize, ConfTool):

- **Call for papers** — a *public* submission portal (speaker submits, no account
  needed), a reviewer pool, **blind multi-reviewer scoring** against a rubric,
  conflict-of-interest handling, an accept/waitlist/reject decision round, and
  templated notification mail to every submitter.
- **Agenda** — tracks × rooms × time, with speaker and room conflict detection,
  capacity per session, and publish-to-attendees.
- **Personal agenda** — attendees build their own itinerary, which drives room
  capacity forecasting.
- **CEU/certificates** — credit hours per session, attendance verified via
  session check-in, then a **generated certificate PDF** with a verification code,
  and export to accrediting bodies.
- **Signage** — room and wayfinding screens driven from the live agenda.

## 2. What exists today (verified)

Two genuinely strong builds:
- **Agenda Builder** — a real track × time grid with drag-to-reschedule and
  double-booking flags, session/time helpers factored into `lib/agenda/sessions.js`
- **Display Boards** — a canvas-built slide queue with **one Canvas-2D renderer backing
  both the live `/display/<id>` route and a WebM export**. That shared-renderer decision
  is the kind of engineering the rest of the app should copy

Gaps:
- **Call for Papers has no call and no review.** Submissions are added *by the organizer*
  ("Add submission"); there is no public submission portal, no reviewer pool, no
  assignment, and scoring is **one `score` text field typed in by hand** with a free-text
  `reviewerNotes`. It is a submissions spreadsheet
- **CEU & Certificates issues nothing.** It defines certificate *templates* (credit hours,
  accrediting body) with no per-attendee issuance, no attendance verification, no PDF,
  no verification code
- **Assign Agenda** curates sessions to an audience but there is no attendee-facing
  personal-agenda experience driving capacity forecasting
- Agenda sessions are not linked to [12 Session Check-in](12-checkin.md), so attendance
  per session — the input CEU needs — isn't captured

## 3. Pending deliverables

### P0 — Make CFP a real call
- [ ] **Public submission route** (`/cfp/<token>`) — speaker submits title, abstract, format, track, bio, headshot with no account. Reuse the tokenized public-route pattern already used by `/e/[id]` and the portal
- [ ] Reviewer pool + assignment (N reviewers per submission), **scored against a rubric** (multiple criteria, 1–5 each), with blind mode hiding author identity
- [ ] Aggregate score + spread shown per submission; decision round (Accept / Waitlist / Reject) with bulk decisions
- [ ] Notification mail per outcome ([00 H2](00-cross-cutting.md))
- [ ] **Accepted submission → agenda session** in one action. Today CFP and Agenda Builder don't connect, which is the entire point of having both

### P0 — Make CEU issue something
- [ ] Link sessions to certificates (credit hours per session)
- [ ] Verify attendance from session check-in; compute earned credits per attendee
- [ ] **Generate the certificate** — the `lib/display` Canvas-2D renderer and `lib/passes` (badge design/print/zip) are both already in the repo and either can render a certificate. Add a verification code + a public verify route
- [ ] Deliver via the portal + email; export a credits report for the accrediting body

### P1
- [ ] Session capacity + attendee personal agenda (feeds room-size decisions)
- [ ] Speaker/room conflict detection extended to speaker travel and setup gaps
- [ ] Agenda publish/versioning so attendees see a stable schedule while editing continues

### P2
- [ ] Wayfinding boards driven from the live agenda ("Now / Next in this room")
- [ ] Multi-track PDF/print program export

## 4. UX & component placement

### Agenda Builder (already strong)
| Issue | Change |
|---|---|
| Unscheduled sessions need a home | Add a **left "parking lot" rail** of unscheduled sessions to drag from — this is the standard grid-scheduler idiom and it is what makes CFP → agenda one gesture |
| Conflicts are flagged in place | Also add a **docked conflict summary at the bottom** ("3 conflicts: 2 speaker, 1 room") that filters the grid when clicked. Conflicts scrolled off-screen get missed |
| Track/room switching | Keep the grid axes controllable from the header, and persist the choice per event |
| No publish state | Add `Draft / Published` with a "publish changes" action; attendees should not see half-edited schedules |

### Call for Papers (after P0)
| Issue | Change |
|---|---|
| A flat table for a pipeline | Render as a **board by status** (`Submitted → Under review → Decision → Accepted / Rejected`), which is how program committees actually work |
| Reviewing in a table row is impossible | A dedicated **review view**: abstract left (full text, readable measure), rubric scoring right, with keyboard-driven next/prev. Reviewers process dozens in a sitting; anything slower doesn't get used |
| Score is a single typed number | Replace with the aggregate of real reviews: mean, spread, and per-reviewer scores on hover |

### CEU & Certificates
| Issue | Change |
|---|---|
| Templates only, with no view of who earned what | Two tabs: **Templates** (design + credit rules) and **Issued** (per-attendee credits, status, download). The issued list is the one people ask for |
| No preview | Show a live certificate preview beside the template settings, as Display Boards already does for slides |

### Display Boards (already strong)
- Keep the builder as-is; add a **"Now playing" indicator** on the list showing which boards are live on which screens, and a "copy display URL / QR" action per board so setting up a physical screen is one scan

### Assign Agenda
- Show the **resolved audience count** next to the targeting, consistent with [18 Community](18-community.md) — targeting without a count is guesswork

## 5. Schema / API work
- [ ] `events.cfp_reviews` (submission_id, reviewer_id, scores jsonb, comment, submitted_at); `cfp_reviewers`; a public submission token table
- [ ] `events.session_attendance` (session_id, ticket_id, checked_in_at) — links [12](12-checkin.md) to credits
- [ ] `events.certificates_issued` (contact_id, template_id, credits, code, issued_at) + a public `/verify/<code>` route
- [ ] Link `conference_records` sessions ↔ agenda ↔ CFP submissions by id rather than by name
