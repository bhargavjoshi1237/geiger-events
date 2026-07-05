# Campaigns Module — Design

**Date:** 2026-07-06
**Area:** `components/internal/screens/campaigns`, `lib/supabase/campaigns.js`, `supabase/sqls/campaigns.sql`
**Status:** Approved-by-default (user delegated; see "Decisions taken" — flag any you'd change).

## Goal

Build out the entire **Campaigns** sidebar area — all 14 sub-items — cleanly, following
`MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md`, and `crafting.md`, using the shared
`screen_kit` primitives. No sub-item may fall back to `ComingSoon`.

The 14 sub-items:
Newsletters · Automated Reminders · Email Invites · SMS Invites · WhatsApp Invites ·
Text Blasts · Segmentation · Email Template Builder · Drip Sequences · A/B Testing ·
Send Scheduling · Deliverability · Personalization · Push Notifications.

## Decisions taken (defaults, since delegated)

1. **Architecture: one hub + lenses**, not 14 separate tables/screens. Most sub-items are
   *channels/types of one campaign record*. One `campaigns` record store powers a hub list +
   channel-aware editor; the channel/type items are preset-filtered **lenses** onto that hub.
2. **Records & config only** — no real message dispatch. Campaigns are composed, segmented,
   scheduled, A/B-configured, and tracked entirely as data in the `events` schema. Status
   advances Draft → Scheduled → Sent; metrics are honest (recipients/delivered from the chosen
   audience; **no fabricated opens/clicks**). Matches every other area here (Check-in, Tickets…).
3. **Segmentation reuses the existing Segments screen** (`guests/segments.jsx` +
   `lib/supabase/segments.js`) via the folded-banner pattern — one audience source of truth.

## Surface map (title → screen)

| Sidebar title | Kind | Implementation |
|---|---|---|
| **Campaigns** (parent) | Hub | `CampaignsScreen` — full records list + channel-aware editor |
| Newsletters | Lens | `CampaignsScreen` preset `{channel:email, type:newsletter}` |
| Email Invites | Lens | preset `{channel:email, type:invite}` |
| SMS Invites | Lens | preset `{channel:sms, type:invite}` |
| WhatsApp Invites | Lens | preset `{channel:whatsapp, type:invite}` |
| Text Blasts | Lens | preset `{channel:sms, type:blast}` |
| Automated Reminders | Lens | preset `{type:reminder}` (triggered/scheduled) |
| Push Notifications | Lens | preset `{channel:push}` |
| A/B Testing | Lens | preset `{abOnly:true}` + banner |
| Send Scheduling | Lens | preset `{scheduledOnly:true}` + banner (upcoming sends) |
| Segmentation | Folded | `SegmentsScreen` + Campaigns-context banner |
| Email Template Builder | Records | `EmailTemplateBuilderScreen` (reusable templates + editor) |
| Drip Sequences | Records | `DripSequencesScreen` (reusable step sequences + editor) |
| Deliverability | Settings singleton | `DeliverabilityScreen` |
| Personalization | Settings singleton | `PersonalizationScreen` |

## Data model (`supabase/sqls/campaigns.sql`, `events` schema)

- **`events.campaigns`** — one row per campaign. Promoted columns for filtering/sorting:
  `name, channel (email|sms|whatsapp|push), type (newsletter|invite|reminder|blast|announcement),
  status (draft|scheduled|sending|sent|paused), segment_id uuid, event_id uuid (soft link, no FK
  to avoid cross-file ordering), scheduled_at timestamptz, sent_at timestamptz`. Expansion bags:
  `content jsonb` (subject/previewText/body/pushTitle/templateId/sequenceId), `ab jsonb`
  (enabled/variantB/split/metric/winner), `metrics jsonb` (recipients/delivered/opened/clicked/
  bounced/unsubscribed — default 0). Plus standard `project_id → public.projects`, `created_by`,
  `metadata`, timestamps, `deleted_at`.
- **`events.campaign_assets`** — reusable records store discriminated by `module`
  (`template` | `sequence`), shape mirrors `ticketing_records`:
  `module, kind, name, active, config jsonb`. Backs Email Template Builder + Drip Sequences.
- **`events.campaign_settings`** — project singleton (like `checkin_settings`): `config jsonb`
  with slices `deliverability` and `personalization`. Merge RPC `campaign_settings_merge(uuid,jsonb)`
  (shallow-merge, `security definer`), mirroring `checkin_settings_merge`.
- RLS enabled with the open demo policy (`anon, authenticated using (true)`), to be replaced by the
  org-scoped member policy in `zz_project_access.sql` later. Idempotent DDL; local
  `events.touch_updated_at()` re-declared; `create schema if not exists events`.

## Data layer (`lib/supabase/campaigns.js`)

Pure (`isSupabaseConfigured()` guard, `console.error`, return `null`/`false`/`[]`, never throw/toast).
snake↔camel via `normalizeCampaign`/`toRow`, bags spread onto the view model.

- Campaigns: `listCampaigns(projectId)`, `getCampaign(id)`, `createCampaign(input)` (honors caller id),
  `updateCampaign(id, patch)`, `softDeleteCampaign(id)`.
- Assets: `listAssets(projectId, module)`, `createAsset`, `updateAsset`, `softDeleteAsset`.
- Settings: `getCampaignSettings(projectId)` (returns `{config:{}}` when no row), `updateCampaignSettings(projectId, patch)` via RPC.

## Screens & shared kit

- **`campaigns.jsx`** — `CampaignsScreen({ preset })`: `MainScreenWrapper` → `ScreenHeader`
  (+ optional folded banner) → `StatsBar` (Total / Scheduled / Sent / Recipients, derived) →
  `Toolbar` (search + status + channel `FilterDropdown`) → card list (channel icon, name,
  `StatusPill`, audience, schedule, recipients) with a row-actions menu (Edit / Duplicate /
  Delete). Loading / empty / filtered-empty states. Row click swaps to the editor. Fetches
  campaigns + segments + contacts on mount; recipients estimated with `applySegment`. Optimistic
  create/duplicate/delete + `toast`, real `crypto.randomUUID()` ids.
- **`campaign_editor.jsx`** — `SecondaryScreenWrapper`, back affordance, inline-editable name +
  status control (Draft→Scheduled→Sent actions). Sections: **Audience** (segment select + live
  recipient estimate), **Content** (channel-aware: email subject/preview/body + template pick;
  sms/whatsapp message + char count; push title/body), **Schedule** (send now | scheduled
  datetime), **A/B** (email/sms only: variant B + split). Saves through the data layer.
- **`campaigns_kit.jsx`** — `CampaignSettingsScreen` mirroring `checkin_kit.jsx`'s
  `CheckinSettingsScreen` (load singleton, feature slice + `set` + explicit Save via merge RPC),
  used by Deliverability + Personalization.
- **`email_template_builder.jsx` / `drip_sequences.jsx`** — reuse the generalized `RecordsScreen`
  (see below) against `campaign_assets`, each with its own kinds + edit form.
- **`segmentation.jsx`** — folded `SegmentsScreen` + banner.
- **`constants.js`** — `CHANNEL_MAP`, `TYPE_MAP`, `CAMPAIGN_STATUS_MAP`, `*_FILTER_OPTIONS`,
  `MERGE_TAGS`, `LENS` presets, `formatDate/formatDateTime`, and default-config factories.

**One small shared-kit change:** generalize `tickets/records_kit.jsx` `RecordsScreen` to accept an
optional `data` adapter `{ list, create, update, remove }`, **defaulting to the existing ticketing
functions** (backward-compatible — ticket screens pass nothing and are unchanged). Campaigns passes
its `campaign_assets` functions. Avoids forking ~250 lines.

## Registry & nav

Add all 15 titles (parent + 14) to `SCREEN_REGISTRY` in `registry.jsx`. Nav entries already exist
in `sidebar_nav.jsx` (no change needed). No `rbac.js` change — screens stay reachable by default.

## Out of scope

Real ESP/SMS/push delivery, sending-domain DNS verification, live open/click tracking, a visual
drag-drop email canvas (the template builder edits structured fields/blocks, not a WYSIWYG canvas).

## Testing / done bar

`npx eslint` clean on all changed files; three list states on every list; semantic tokens only;
optimistic + persisted mutations with toasts; ticket screens still build (records_kit change is
backward-compatible).
