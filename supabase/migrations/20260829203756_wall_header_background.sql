-- Wall header background
--
-- The Event Wall's public page has a top section (the hero: banner, logo, name,
-- tagline, follow button). Its backdrop was only ever the themed accent glow —
-- there was no way to put a picture behind it. This adds a real column for that
-- backdrop, sitting alongside logo_url rather than in the metadata bag: the
-- public /w/<slug> route reads it on every render, and it is edited from the
-- Design section the same way the logo is.
--
-- The value is a plain URL and may be either an image or a video; the kind is
-- read back off the URL by coverKind() (lib/events/gallery.js), so the column
-- needs no companion flag. Uploaded files live in the public "products" bucket
-- at walls/<project-uuid>/<file>, written by uploadWallImage() /
-- uploadWallVideo() — the storage policies from
-- 20260823151042_wall_asset_storage.sql already cover that folder, so no new
-- policy is needed here. Idempotent.

-- @up
alter table events.event_wall
  add column if not exists header_bg_url text;

-- @down
alter table events.event_wall
  drop column if exists header_bg_url;
