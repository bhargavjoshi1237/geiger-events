# Instagram drip

154 feed posts (1:1 and 4:5) for **@geigerstudio**, scheduled at 09:00, 13:00 and
18:00 UTC, starting **2026-11-09** and ending **2026-12-30**.

Instagram's API cannot schedule a post: `media_publish` publishes immediately and
there is no `scheduled_at` field. So this folder ships its own scheduler — a
GitHub Action that runs three times a day, looks at the queue, and publishes
whatever is due. It is scheduled for 09:00, 13:00 and 18:00 UTC — the same slots
as the queue. The queue starts **paused**.

## How it fits together

```
marketing/ads/png/…            source PNGs (feed formats only)
        │  build.mjs
        ▼
queue.json  ── host.mjs ──►  Supabase Storage (public)
   captions, hashtags,          instagram/media/…  ← JPEGs Instagram fetches
   alt text, schedule           instagram/queue.json  ← publishing state
        │                              │
        │                              ▼
        └──────────────►  publish.mjs (GitHub Action, 3×/day)
                                   │
                                   ▼
                          Instagram Graph API v23.0
```

The images live in Supabase because Instagram only accepts a publicly reachable
URL — it downloads the file itself. Nothing is stored on Instagram until the
publisher runs.

## Files

| File | Role |
| --- | --- |
| `products.mjs` | Product names, URLs, CTAs and hashtag pools |
| `copy/events.mjs` | Hooks, body copy and alt text for Events posts |
| `copy/apps.mjs` | Hooks, body copy and alt text for suite app posts |
| `build.mjs` | Scans PNGs, dedupes, groups carousels, schedules, writes the outputs |
| `host.mjs` | Converts PNG→JPEG, uploads to Supabase, verifies URLs, uploads queue |
| `publish.mjs` | Publishes due posts (IMAGE and CAROUSEL), updates queue state |
| `queue.mjs` | Pause / resume / status / reschedule / reset commands |
| `queue.json` | The queue and its state (generated; do not hand-edit) |
| `calendar.csv` | Review spreadsheet: schedule, caption, hashtags, alt text |
| `PREVIEW.md` | The same calendar, readable in Markdown |

## Review before going live

- `PREVIEW.md` — every post in order, grouped by week, with caption and alt text.
- `calendar.csv` — open in Excel/Sheets to edit or filter.
- The queue is paused, so nothing publishes until you run `--resume`.

## One-time setup

### 1. Add the GitHub Actions secrets

The workflow needs four secrets. From the repo root:

```powershell
gh secret set IG_TOKEN --body (Get-Content "studio meta token.txt" -Raw).Trim()
gh secret set IG_USER_ID --body "17841437114929659"
gh secret set SUPABASE_URL --body "https://dyjiyzcsdaeuxtueslqr.supabase.co"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body (Select-String -Path .env -Pattern '^SUPABASE_SERVICE_ROLE_KEY=' | ForEach-Object { $_.Line -replace '^SUPABASE_SERVICE_ROLE_KEY=', '' })
```

Check them with `gh secret list`.

### 2. Verify credentials and media

Locally (reads the token from the file, never prints it):

```powershell
$env:IG_TOKEN = (Get-Content "studio meta token.txt" -Raw).Trim()
$env:IG_USER_ID = "17841437114929659"
node marketing/ads/instagram/publish.mjs --check
```

This prints the account, the next queued post and `OK` for each hosted image.
It makes read-only calls.

### 3. Resume the drip

```powershell
node marketing/ads/instagram/queue.mjs --resume
```

The GitHub Action takes it from there. To test the Action immediately, run the
**Instagram drip** workflow from the Actions tab with `dry_run` checked, then
unchecked.

## Day-to-day commands

All commands read the queue from Supabase unless you add `--local`.

```powershell
node marketing/ads/instagram/queue.mjs --status        # counts, next post, last error
node marketing/ads/instagram/queue.mjs --pause         # stop publishing now
node marketing/ads/instagram/queue.mjs --resume        # start again
node marketing/ads/instagram/queue.mjs --start 2026-11-15   # re-anchor remaining posts
node marketing/ads/instagram/queue.mjs --reset 42      # re-queue a failed post
node marketing/ads/instagram/queue.mjs --reset-errors  # re-queue every failed post
node marketing/ads/instagram/queue.mjs --skip 12       # drop a post you posted by hand
node marketing/ads/instagram/queue.mjs --mark-published 12 --permalink "https://www.instagram.com/p/…"
```

Two creatives were already posted by hand before the queue existed
(`ads/1a` and `ads/1c`) and are excluded from the 154.

Manual publish of one post (respects the queue; `--force` overrides a pause):

```powershell
$env:IG_TOKEN = (Get-Content "studio meta token.txt" -Raw).Trim()
$env:IG_USER_ID = "17841437114929659"
node marketing/ads/instagram/publish.mjs --post 12 --force
```

Preview without publishing:

```powershell
node marketing/ads/instagram/publish.mjs --dry-run
node marketing/ads/instagram/publish.mjs --dry-run --limit 3
```

## What happens on a run

1. Read `instagram/queue.json` from Supabase with a cache-buster.
2. If `paused`, exit without doing anything.
3. Pick the oldest `queued` post whose `scheduledAt` has passed.
4. IMAGE: create a media container, poll until `FINISHED`, publish it.
   CAROUSEL: create one item container per slide, poll all of them, create the
   carousel container, then publish.
5. Save `status`, `permalink`, `igMediaId` and `publishedAt` back to Supabase.

A failed post is retried on the next scheduled run, up to three attempts, then
marked `error` so it stops blocking the queue. `--reset <n>` puts it back.

## Operational notes

- **Posting limit.** Instagram allows roughly 25 API-published posts per rolling
  24 hours. Three a day is comfortably below it.
- **Missed runs.** GitHub cron is best-effort and can be delayed. Because the
  publisher selects anything already due, a late run still posts; a long pause
  creates a small backlog that drains one post per scheduled run. Use `--start`
  to re-anchor the remaining schedule instead.
- **Token expiry.** A long-lived Facebook user token lasts about 60 days. If it
  expires mid-drip, generate a new one and re-run the `IG_TOKEN` secret command.
  The Action will start failing with an auth error before anything is lost.
- **Public repo cron.** GitHub disables scheduled workflows after 60 days without
  repository activity. This drip ends within that window.
- **State is not in git.** Publishing updates Supabase only, so Vercel does not
  redeploy on every post.
- **Do not re-run `host.mjs` after the queue is live.** It would overwrite the
  remote queue with the freshly built (all-queued) copy; it now refuses when it
  sees publishing history unless you pass `--force-queue`.
- **Story images.** The 73 story-format (1080×1920) exports are intentionally
  excluded. They need the Stories endpoint, not the feed endpoint.

## Regenerating

```powershell
node marketing/ads/instagram/build.mjs   # queue.json, calendar.csv, PREVIEW.md
node marketing/ads/instagram/host.mjs    # convert + upload new media, upload queue
```

`build.mjs` writes every post as `queued` and `paused: true`; only do this before
the drip starts, or reset the schedule deliberately.
