# 18 — Community

| | |
|---|---|
| **Nav items** | 8 — Event Chat, Messages, Polls, Surveys, Q&A, Meeting Scheduler, Announcements, Discussion Boards |
| **Registered** | 6/8 — **Meeting Scheduler** and **Discussion Boards** are `ComingSoon` |
| **Tier** | **A** for Chat/Q&A/Messages · **B** for Polls/Surveys/Announcements · **C** for the two missing |
| **Key files** | `community/qa_threads.jsx` (984), `event_chat.jsx` (534), `community/modules.jsx` (poll/survey/announcement), `messages/organiser_inbox.jsx` (517), `lib/supabase/chat.js` + `community.js`, `lib/audience/resolve.js` |

---

## 1. What this means in industry

Audience engagement (Slido, Whova, Swapcard, Brella):

- **Live polls** — the audience votes from their phone and results animate on the
  screen in real time; multiple choice, word cloud, rating, quiz with a leaderboard.
- **Q&A** — attendees submit and **upvote** questions; moderators screen, mark
  answered, and push to the stage view. Upvoting is the whole mechanism — it's how
  the best question surfaces without a moderator reading everything.
- **Surveys** — pre/post event, per session, with NPS, branching, and response
  analytics.
- **Networking** — attendee directory, interest matchmaking, 1:1 meeting requests
  with mutual availability and a meeting schedule that respects the agenda.
- **Discussion boards** — persistent, threaded, topic-based community that lives
  between events.
- **Announcements** — push/in-app broadcast to a targeted audience with read receipts.

## 2. What exists today (verified)

Real and good:
- **Event Chat** (534) and **Q&A Threads** (984) are substantive builds on `lib/supabase/chat.js`,
  including participants + moderation, and **`votePoll(msg.id, optionId, meKey)`** — polls
  posted *inside a chat thread* genuinely collect votes per option per member
- **Messages** — a real organiser inbox for members-portal support threads (buyers start
  them from the portal; organisers reply here)
- Announcements target a real audience via `lib/audience/resolve.js` and the portal push
  route (`app/api/portal/push/announce`)

Gaps:
- **The standalone Polls screen is a fake of a feature that already works.**
  `community/modules.jsx:58` defines `votes` as a **number the organizer types in**
  (`c("votes", "Votes", "number", { placeholder: "e.g. 0" })`). There is no voting, no
  per-option results, no respondent tracking — while a real voting implementation exists
  15 files away in chat. **Two poll concepts, and the one with its own nav entry is the fake one.**
- **Surveys** are the same shape: a record with no response collection, so [13 Surveys & NPS](13-analytics.md)
  has nothing to report on
- **Meeting Scheduler** and **Discussion Boards** are `ComingSoon`
- No attendee directory or matchmaking, so networking — the main reason attendees use a
  conference app — is absent

## 3. Pending deliverables

### P0 — Unify polls on the implementation that works
- [ ] Make the Polls screen an authoring + results surface over the **real** poll model in `lib/supabase/chat.js`, not a `community_records` row
- [ ] **Delete the typed-in `votes` field.** A vote count an organizer enters by hand is the clearest example of the pattern this whole audit is about
- [ ] Live results view (per-option bars, total responses, updating) + a presenter/full-screen mode for the room screen — reuse the [19 Display Boards](19-program.md) renderer

### P0 — Make Q&A's upvote loop explicit
- [ ] Confirm/complete attendee-side upvoting and sort-by-votes; surface a moderator queue (`New / Approved / Answered / Dismissed`) and a "push to stage" view

### P1
- [ ] **Surveys** with real responses: per-session and post-event, NPS question type, response storage, and an analytics view
- [ ] **Discussion Boards** — persistent threaded topics; the chat data layer already covers most of the model
- [ ] **Meeting Scheduler** — attendee availability, request/accept, and a meeting slot that respects the [19 Agenda](19-program.md)

### P2
- [ ] Attendee directory + interest-based matchmaking
- [ ] Read receipts and delivery stats on Announcements
- [ ] Gamification/leaderboard tied to session attendance

## 4. UX & component placement

### Polls (after P0)
| Issue | Change |
|---|---|
| A record table gives no sense of a live poll | Poll rows should show **live result bars inline** — the result *is* the record. Add a Live/Closed toggle directly on the row |
| No presenter view | A dedicated full-screen results view with large type, auto-refresh, and a QR code for the audience to join. This is the artifact that actually appears in the room |
| Audience targeting is a field among fields | Keep the audience picker, but show the **resolved recipient count** next to it (the resolver can compute it) |

### Q&A
| Issue | Change |
|---|---|
| Threads and moderation share one surface | Give moderators a **queue-first layout**: incoming questions left (sorted by votes), the selected question and its answer composer right. Moderating a busy Q&A is a rapid triage task |
| Answered questions clutter the queue | Segmented filter (`New · Approved · Answered · Dismissed`) as the first control, defaulting to New |

### Event Chat
- Channel list left, messages centre, participants/moderation right — the standard three-zone chat contract
- Surface moderation actions on hover per message rather than in a separate mode
- Note: chat **polls**, not Realtime — the portal chat polls for updates. Document the refresh interval in the UI ("updates every Ns") so organizers don't read a lag as a bug

### Messages (organiser inbox)
| Issue | Change |
|---|---|
| An inbox is a triage queue | Two-pane: thread list left (unread bold, sorted by last activity), conversation right. Add assignment and a status (`Open / Waiting / Closed`) — support inboxes without status turn into a swamp |
| No link to the order/ticket in question | Show the buyer's order context in a right rail — every support reply needs it, and [09 Orders](09-orders.md) already has the drawer content to reuse |

### Announcements
- Show **sent vs draft** as the primary split, with delivery counts once available
- Add a preview of the push/in-app notification exactly as the member sees it

### Meeting Scheduler / Discussion Boards
- If not being built this cycle, remove the two nav entries rather than leaving `ComingSoon` under a section that is otherwise real. They currently drag down a genuinely strong area.

## 5. Schema / API work
- [ ] Promote the chat poll model to a first-class `events.polls` + `events.poll_votes` (unique on `(poll_id, member_id)`), used by both chat and the Polls screen
- [ ] `events.survey_responses` (survey_id, contact_id, answers jsonb, submitted_at)
- [ ] `events.meeting_requests` (from, to, event_id, proposed_slots, status)
- [ ] `events.board_topics` / `board_posts` for discussion boards
