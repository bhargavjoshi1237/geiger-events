# 22 — Broadcast & On-demand

| | |
|---|---|
| **Nav items** | 7 — Livestream Rooms, Webinar Rooms, Breakout Rooms, Simulive & On-demand, Recordings & Replay, Captions & Transcription, Mobile Event App |
| **Registered** | 7/7 |
| **Tier** | **B — real access control around a video stack that doesn't exist** |
| **Key files** | `conference/modules.jsx` (room, webinar, breakout, sponsor_room, simulive, recording), `conference/captions.jsx` (514) + `caption_settings.jsx` (493), `conference/mobile_app.jsx`, `lib/live/*` (state, access, presence, roster, assign, timer — **with tests**), `app/api/live/*`, `app/api/portal/live/*`, `app/api/portal/watch` |

---

## 1. What this means in industry

Virtual/hybrid delivery (Hopin, Zoom Events, ON24, Brandlive):

- **Ingest** — RTMP/SRT from an encoder, or an in-browser studio (WebRTC) with
  guests, screen share, and branded overlays.
- **Delivery** — adaptive-bitrate HLS at scale, low-latency mode for interaction,
  DVR, and a player with quality/captions controls.
- **Recording** — automatic capture, trimming, chaptering, and publishing to a
  gated on-demand library.
- **Simulive** — a pre-recorded file played to a schedule *as if live*, with live
  chat alongside. This is the format most "virtual conferences" actually use.
- **Captions** — real-time ASR captions during the stream, then an editable
  transcript, translations, and a searchable index of the recording.
- **Analytics** — concurrent viewers, watch time, drop-off curve, engagement.

## 2. What exists today (verified)

The **access layer is real and well-built**, which is easy to miss:
- `lib/live/state.js` — schedule-driven room state (`Scheduled → Opening soon → Live →
  Ended`, with a manual override), pure and **unit-tested**
- `lib/live/access.js`, `roster.js`, `presence.js`, `assign.js`, `timer.js` — entitlement
  gating, breakout assignment from an entitled member pool, presence/viewer counts, all
  with tests
- `app/api/live/*` and `app/api/portal/live/*` — roster, stats, heartbeat, rounds
- `app/api/portal/watch` — recordings a member's memberships unlock

The **video layer does not exist**:
- A room is a record whose config holds `streamProvider`, `streamUrl`, `watchUrl` — i.e.
  **you paste a third-party link**. There is no ingest, no player, no recording pipeline
- **No video SDK in `package.json`** — no LiveKit, Mux, Daily, Agora, Cloudflare Stream
- **Simulive cannot play anything to a schedule** — it is a record with a time on it
- **Recordings & Replay** is a link list; nothing is captured by the platform
- **Captions & Transcription** (514 + 493 lines of settings) **transcribes nothing** —
  there is no ASR provider and no transcript store
- Mobile Event App is a singleton config + preview (the actual Expo app lives at `mobile/`)

So: an organizer can configure a captioned, recorded, simulive webinar and get a
pasted YouTube link with no captions, no recording, and no schedule playback.

## 3. Pending deliverables

### P0 — Decide the video strategy, then be honest in the UI
Three viable paths; the wrong move is leaving it ambiguous.

**Path A — embed-only (small, honest).** Keep third-party links; own the gating,
presence, schedule and chat — which are already the differentiated parts.
- [ ] Rename the section **"Rooms & Replay"**; drop "Broadcast"
- [ ] Validate and normalise pasted URLs (YouTube/Vimeo/Zoom/Teams), render a proper embed
- [ ] Remove or clearly mark **Captions & Transcription** and **Simulive** as unavailable —
  they are not achievable on this path and currently promise the most

**Path B — managed video (large).** Adopt one provider (Mux or Cloudflare Stream
for delivery+recording; LiveKit for interactive rooms).
- [ ] Ingest keys per room, player embed, automatic recording into the library
- [ ] Simulive: schedule a recorded asset to play at a time with live chat beside it
- [ ] Viewer analytics into [13 Analytics](13-analytics.md)

**Path C — hybrid.** Path A now, Path B for premium rooms later. Recommended.

### P0 regardless
- [ ] **Stop claiming what isn't delivered.** Captions settings that transcribe nothing, and a Simulive record that never plays, are the same failure mode as [15 Advertising](15-advertising.md)

### P1
- [ ] Captions: ASR on recordings (post-event first — it's far easier than real-time), an editable transcript, and a searchable index. Transcript search over recordings is high value and independent of live streaming
- [ ] Recordings library gated by [11 Membership entitlements](11-memberships.md) — the entitlement model already exists and `app/api/portal/watch` already reads it
- [ ] Chapters/trimming on recordings

### P2
- [ ] Translations of transcripts
- [ ] Live watch-party features (synchronised playback + chat)

## 4. UX & component placement

### Livestream / Webinar / Breakout / Sponsor Rooms — four near-identical record screens
| Issue | Change |
|---|---|
| Four sidebar entries for one object with a `kind` field | **Merge into one "Rooms" screen with a type filter.** Four identical tables differing only by a config value is the clearest padding in this section |
| A room's state is its most important attribute and it sits in a status column | Lead the row with a **live state chip and viewer count** (`● Live · 214 watching`), which the presence layer already computes. Sort live rooms to the top automatically |
| No way to check the stream works | Add "Test / open watch link" per room, and validate the URL on save. An unreachable stream discovered at showtime is the failure this prevents |
| Access rules are configured but not summarised | Show the resolved access in plain language on the row (`Ticket holders + Gold members`), not just in the editor |

### Breakout Rooms
- Assignment is the real feature here (`lib/live/assign.js`, with tests). Give it a
  proper **assignment view**: the entitled pool left, rooms as columns, drag or
  auto-assign with a round counter. A table hides the one thing this screen does well

### Recordings & Replay
| Issue | Change |
|---|---|
| A list of links | **Gallery with thumbnails and durations** — a video library that looks like a spreadsheet doesn't get browsed |
| No entitlement visibility | Show which memberships unlock each recording, and a view count |
| No search | Once transcripts exist, search *inside* them — that's the feature that makes a replay library valuable rather than archival |

### Captions & Transcription
- Over 1,000 lines of settings for a capability that doesn't exist. Until P1, reduce to a single honest panel; afterwards, the primary surface should be the **transcript editor** (video left, editable timed transcript right, click-to-seek), not a settings page

### Mobile Event App
- Keep the live preview — it's the right idea. Add a **device frame toggle and a QR to open the real app**, so the organizer can check it on a phone in one action

## 5. Schema / API work
- [ ] `events.recordings` (event_id, session_id, asset_id, duration, thumbnail_url, transcript_id, entitlement_ref)
- [ ] `events.transcripts` (recording_id, segments jsonb, language) + full-text index for search
- [ ] Path B: `events.rooms` gains `ingest_key`, `playback_id`, `provider`; a provider webhook route for `asset.ready` / `stream.live`
- [ ] Viewer analytics rows feeding [13](13-analytics.md) rather than presence-only counters
