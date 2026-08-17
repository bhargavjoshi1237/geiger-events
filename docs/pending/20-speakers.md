# 20 — Speakers

| | |
|---|---|
| **Nav items** | 3 — Speakers, Speaker Portal, Speaker Backstage |
| **Registered** | 3/3 (all three are `RecordsScreen` modules: `speaker`, `portal_invite`, `backstage`) |
| **Tier** | **B — a roster with two more record lists attached to it** |
| **Blocked by** | [00 H2 send stack](00-cross-cutting.md) for invitations |
| **Key files** | `conference/modules.jsx` (speaker, portal_invite, backstage), `conference/screens.jsx`, `lib/supabase/conference.js` |

---

## 1. What this means in industry

Speaker management (Sessionize, Swapcard, Cvent Speaker Resource Center) is a
**self-service workflow that removes work from the organizer**:

- **Speaker profile** — bio, headshot, title/company, social links, pronouns,
  maintained *by the speaker*, and syndicated automatically to the event page,
  the agenda, and signage.
- **A real speaker portal** — the speaker logs in (or uses a magic link) to
  accept the invitation, complete their profile, upload slides, sign a release,
  confirm A/V needs, submit travel details, and see their own schedule.
- **Task tracking** — the organizer sees who has submitted what, and chases the
  rest automatically.
- **Contracts & releases** — speaker agreement, recording consent, e-signature.
- **Travel & expenses** — flights, hotel, per diem, reimbursement.
- **Green room / run of show** — call times, stage manager notes, AV cues,
  countdown, and a backstage view for the day itself.

## 2. What exists today (verified)

- **Speakers** — a records module: name, bio, and config fields. Fine as a roster.
- **Speaker Portal** — `portal_invite`, another `conference_records` module. **There is
  no speaker-facing route anywhere in `app/`.** A speaker cannot log in, cannot edit their
  own profile, cannot upload anything. The "portal" is a list of invitations that go nowhere.
- **Speaker Backstage** — `backstage`, a third records module holding run-of-show notes
  typed by the organizer. There is no live/day-of view.

Net: **three record lists standing in for one workflow**, and the two that carry
the section's value (portal, backstage) are the ones with no implementation
behind the name.

## 3. Pending deliverables

### P0 — Build the actual portal
The infrastructure exists: `app/members` already implements custom email+password
auth with bearer tokens, and `/e/[id]` proves the tokenized public-route pattern.

- [ ] `app/speaker/[token]` — magic-link route, no account required
- [ ] Speaker-editable profile (bio, headshot, title, socials) writing back to the speaker record
- [ ] Slide/asset upload into storage under `speakers/<id>/` (mirroring `events/<id>/`)
- [ ] A speaker-visible **schedule**: their sessions, room, call time
- [ ] Invitation email with the link, accept/decline, and a reminder job ([00 H1](00-cross-cutting.md), [00 H2](00-cross-cutting.md))

### P1
- [ ] **Task checklist per speaker** (profile ✓, headshot ✓, slides ✗, release ✗, travel ✗) with automated chase mail. This is the feature that saves organizers the most time and it's mostly UI over data you'd now have
- [ ] Recording consent + speaker agreement with e-signature capture
- [ ] Travel details collection, feeding [05 Housing & Travel](05-sourcing.md)

### P2
- [ ] Backstage as a **live day-of view**: current session, countdown, next up, AV notes, stage-manager chat. This should reuse the [19 Display Boards](19-program.md) renderer and the live-room state resolution in `lib/live/state.js` rather than being a record list
- [ ] Speaker ratings from session surveys ([18](18-community.md))

## 4. UX & component placement

### Speakers
| Issue | Change |
|---|---|
| Speakers are people with faces, rendered as table rows | **Gallery presentation** with headshot, name, title/company, and session count. This is the clearest single case in the app for [00 U1](00-cross-cutting.md) — a speaker roster without photos fails its basic job |
| Completion state is invisible | Show a **completeness ring or chip per speaker** (`3/5 tasks`) once P1 lands; before that, at minimum flag missing headshot/bio, since those break the public page |
| No link to their sessions | Show sessions on the card and in the drawer, linked to [19 Agenda Builder](19-program.md) |

### Speaker Portal (internal side, after P0)
| Issue | Change |
|---|---|
| Currently a list of invitations with no outcome | Turn it into an **invitation status board**: `Not invited → Invited → Accepted → Profile complete → Assets received`, with bulk invite and bulk chase. The organizer's question is "who hasn't responded", and a board answers it instantly |
| No preview of what the speaker sees | Add "Preview portal as this speaker" — the same instinct as the staff-route preview recommended in [12 Check-in](12-checkin.md) |

### Speaker Portal (speaker-facing side, new)
- Single-column, mobile-first, **one task per card with an explicit state**; speakers open this on a phone between meetings
- A progress bar at the top ("2 of 5 done") and a single primary action per card
- Deadlines shown as time-remaining chips, not dates

### Speaker Backstage
| Issue | Change |
|---|---|
| A record list of notes | Rebuild as a **day-of run-of-show timeline**: sessions in time order, current one pinned to the top with a countdown, call times, AV notes, and speaker contact one tap away. This screen is used standing backstage — treat it like the check-in routes, not like a CRUD page |
| No live state | Reuse `resolveRoomState()` from `lib/live/state.js` so "now / next" is derived, not manually maintained |

## 5. Schema / API work
- [ ] `events.speaker_tokens` (speaker_id, token, expires_at) for magic-link access
- [ ] `events.speaker_tasks` (speaker_id, kind, status, completed_at) driving the checklist
- [ ] Speaker assets in storage under `speakers/<id>/`, with creator-only write RLS mirroring `events/<id>/`
- [ ] Link speaker records to agenda sessions by id
