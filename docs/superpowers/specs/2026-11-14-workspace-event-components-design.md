# Workspace — Event components (sub-project 5 of 8)

Date: 14 November 2026 · Status: decided by Claude under the user's standing instruction; open to review
Needs: Foundation, Portals (blocks render on portal pages and team pages). Also closes sub-project 2's missing **timeline** block and the calendar's start date.

## Goal

Give workspaces the event-specific tools generic tables can't: a **schedule grid** for sessions, **placement** of things into rooms / booths / seats / shifts with capacity, **scanner attendance**, and closer ties to tickets, orders and check-in.

## Decisions

| Topic | Decision |
|---|---|
| Form | New **blocks**, so they work on team pages (staff, full access) and portal pages (roles decide who sees and edits). No new dashboard-only view types. |
| Schedule | Block `schedule`: a list with a start (datetime), an end (datetime) or a duration, and a lane (link to records, link to venue spaces, or a single-select). Day tabs, time rows (15-minute grid), lanes as columns. Drag to move or resize (when the viewer may edit those fields). Flags: two items in one lane at once; optionally the same person (a chosen link field) in two places at once. Narrow screens get an agenda list. |
| Timeline | Block `timeline`: bars from start to end on a day / week / month axis, grouped by a field; read-only bars with click-to-open. |
| Placement | Block `placement`: items (a list) placed into places (records the items link to through a chosen link field). Places show capacity (a number field) and fill; unplaced items sit in a tray; drag to place or unplace (sets the link). Flags: over capacity, and — when places have start/end — one item placed in overlapping places. **Auto-place** fills open capacity in order (optionally matching a select field such as track or skill). Rooms, booths, seats and shifts are all "places". |
| Scanner | Block `scanner`: pick the attendance list, its person link and an optional context link (e.g. session). Camera scanning (existing `jsqr`) or name search. Accepts a person's **workspace pass** QR (block `pass` shows the signed-in person their QR) or an event **ticket** QR, matched to the person by a ticket link or by email. Creates one attendance record per person per context; repeats show "already marked at 10:02". |
| Pass QR | `ws1.<eventId-short>.<recordId>.<hmac>` signed with the server secret, so a QR can't be forged from a record number. |
| Event data | Ticket links show ticket type and check-in time; order links show total and status. A **Match tickets by email** action links a people list to registrations in bulk. Automations gain a `checkin` trigger (a ticket holder checks in) and an `upsert_record` step (find a record by a field value, update it or create it). |
| Calendar | `startDate` option: a fixed date or "first record". |

## Data model (migration `20261118100000_workspace_components.sql`)

- Trigger on `events.checkin_attendance` insert → `workspace_queue` item (kind `checkin`) when the event has a `checkin` automation.
- No new tables: blocks live in page bodies; attendance and placements are ordinary records and links.

## Server

- `lib/workspace/portal/blocks.js`: validators and defaults for `schedule`, `timeline`, `placement`, `scanner`, `pass`; `calendar.startDate`.
- `lib/workspace/portal/read.js`: data for the new blocks (list data with a date window; placement loads items + places; scanner resolves a code).
- Portal + team write paths: `scan.mark` (creates the attendance record through the role-checked command), placement uses ordinary `record.update`.
- `lib/workspace/components/pass.js` (sign/verify), `lib/workspace/components/schedule.js` (overlaps, slots; pure, tested), `lib/workspace/components/placement.js` (fill, auto-place; pure, tested).

## UI

`components/workspace_portal/render/{schedule,timeline,placement,scanner,pass}_block.jsx` + inspector settings for each. All use `@geiger/ui`, no new visual language.

## Testing

Unit: overlaps, slot snapping, capacity and auto-place, pass signing. Lint; build.

## Decisions made while building (15 Nov 2026)

- Calendar, schedule and timeline share one `startDate` setting: today (null), `"first"` (the earliest dated record, found with a one-row query) or a fixed day. Schedules show `days` days at a time (1–14) with day tabs.
- Schedule lanes come from the server: a choice field's options, the linked list's records the viewer can see (up to 50) or the venue's spaces. Venue-space lanes can't be changed by dragging (portal people can't set event links); choice and record lanes can.
- Placement replaces the item's place on a drop (a multi-link field keeps the other places). Auto-place runs in the browser as ordinary guarded `record.update`s, at most 200 at a time.
- The scanner reads a workspace pass, a full ticket/order id (also inside a URL) or the 8-character ticket code. People are matched through a `link_event` ticket/order field on the people list, else by email. Name search needs two letters and returns up to ten names. Portal people need "add" access to the attendance list; on team pages the staff command writes it (`POST /workspace/portal/scan`). In builder previews the scanner only says who it would mark.
- Pass secret: `WORKSPACE_PASS_SECRET`, falling back to the service-role key, then `CRON_SECRET` (hashed before use). Rotating it invalidates printed passes.
- Ticket chips show the registration's status and latest check-in; order chips show quantity × ticket, total, status (cancelled / refunded / part refunded) and check-in. Inline on the record sheet, as a tooltip elsewhere.
- "Match tickets by email" (list view menu, needs a ticket link field and an email field) links each person to their oldest registration with that email, case-insensitively, as logged staff edits. It skips people already linked unless asked to replace.
- The `checkin` trigger can take a list: each check-in then runs on that list's record for the holder (linked ticket/order, else email) or logs a skipped run. The database trigger swallows its own errors so the door never waits on the workspace.

## Out of scope

Drawing seat maps inside the workspace (the event's seat maps and expo floor plans stay in their own editors), offline scanning (the existing check-in app covers door scanning).
