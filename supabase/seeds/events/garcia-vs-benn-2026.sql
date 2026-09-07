-- Demo event: GARCIA vs BENN — WBC Welterweight World Championship
--
-- The reference page for a TICKETED, RESERVED-SEATING event. Where the F1 seed
-- exercises the presentation surface, this one exercises the selling surface:
-- a real T-Mobile Arena bowl (160 sections, 18,600 chairs), eight price bands
-- painted onto that map, and every per-event ticket rule switched on at once —
-- early-bird, donations, access codes, held-back seats, group buying, bundles
-- and batched releases. If a checkout step renders empty here, that step is
-- broken, not unconfigured.
--
-- Everything except sold/revenue is real: the card is the announced 12 September
-- 2026 running order, records are as reported at announcement, the venue and its
-- neighbours are T-Mobile Arena's, and the price bands follow the level
-- structure a Las Vegas championship card actually sells on. Sold/revenue and
-- the per-band sell-through are invented — no gate figure is published, and the
-- "Who's going" block plus the seat map both need numbers to be worth looking at.
--
-- Images are Wikimedia Commons, every URL HEAD-verified 200. Two constraints on
-- which ones:
--
--   * Only four fighters on this card have a freely licensed portrait, so a
--     roster of faces would be half blanks. It uses national flags for every
--     fighter instead — uniform, accurate, and the tale-of-the-tape convention
--     anyway. No portrait is invented or borrowed under fair use.
--   * "Boxing ring, MGM Grand.jpg" is captioned as what it is (a Las Vegas ring,
--     2008), not as this event's ring. Nothing here claims to show a fight that
--     has not happened yet.
--
-- Owns four rows/sets, all upserted on fixed ids so `npm run db:seed` repeats:
--   events.venues            T-Mobile Arena
--   events.seat_maps         "Championship boxing — full house"
--   events.seat_map_sections 160 bowl sections (from lib/seating/bowl.js)
--   events.events            the event itself
--
-- The chairs themselves are NOT here — 18,600 INSERTs do not belong in a seed
-- file. Run `node scripts/seed-garcia-benn-seats.mjs` after this to generate
-- events.seats from these sections and to fill the map with sold/blocked seats.

-- ===========================================================================
-- 1 · The venue
-- ===========================================================================
insert into events.venues (
  id, project_id, name, type, status, description,
  address, city, region, postcode, country, timezone, latitude, longitude,
  parking_notes, transit_notes,
  seated_capacity, standing_capacity, spaces, amenities,
  contact_name, contact_email, contact_phone, website,
  cover_url, gallery, metadata
) values (
  '7b012026-0912-4a10-9c00-000000000001',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'T-Mobile Arena',
  'Indoor',
  'Active',
  $vdesc$The Strip's championship room. Opened in 2016 between New York-New York and Park MGM, T-Mobile Arena seats around 20,000 for a centre-stage show and reconfigures to a boxing bowl of 18,600 — a ring on the floor, four tiers wrapped around it, and The Park's open-air plaza feeding every gate.$vdesc$,
  '3780 S Las Vegas Blvd',
  'Las Vegas',
  'Nevada',
  '89109',
  'United States',
  'America/Los_Angeles',
  36.102800,
  -115.178300,
  $vpark$The arena has no lot of its own. The New York-New York, Park MGM and Excalibur garages all sit within a five-minute walk and stay open through the night; expect them to fill from three hours before the first bell. Frank Sinatra Drive is the least-jammed approach on a fight night — Las Vegas Boulevard will not be.$vpark$,
  $vtran$The MGM Grand and Bally's stations put the Las Vegas Monorail about fifteen minutes' walk from the gates, with an extended service on event nights. Harry Reid International (LAS) is four miles south — ten minutes by road outside event hours, and considerably more after the final bell.$vtran$,
  18600,
  0,
  1,
  $amen$["Step-free access","Accessible seating platforms","Assistive listening devices","Sensory room","Cashless payment","Clear-bag policy","Box office","Merchandise stands","Licensed bars","Baby-change facilities"]$amen$::jsonb,
  'T-Mobile Arena Box Office',
  'boxoffice@t-mobilearena.example',
  '+1 702 692 1616',
  'https://www.t-mobilearena.com/',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg/1920px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg',
  $vgal$[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/T-Mobile_Arena_Outside.jpg/1920px-T-Mobile_Arena_Outside.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Las_Vegas_05.2020_-_T-Mobile_Arena.jpg/1920px-Las_Vegas_05.2020_-_T-Mobile_Arena.jpg"
  ]$vgal$::jsonb,
  $vmeta${
    "guidelines": [
      { "id": "vg1", "category": "accessibility", "label": "Accessible platforms on every level", "detail": "Step-free wheelchair spaces with a companion seat alongside sit on all four tiers, ringside floor included. Book them as accessible seats rather than converting a standard seat at the door." },
      { "id": "vg2", "category": "accessibility", "label": "Assistive listening at every guest services desk", "detail": "Receivers are free, need no deposit, and work anywhere in the bowl. A quiet sensory room sits off the main concourse and is open from doors to the final bell." },
      { "id": "vg3", "category": "safety", "label": "Clear-bag policy, strictly enforced", "detail": "One clear bag no larger than 12 x 6 x 12 inches, or a small clutch no larger than 4.5 x 6.5 inches. Everything else goes back to your room — there is no bag check on site." }
    ],
    "loadIn": "Frank Sinatra Drive service road, gates 1-3.",
    "houseCurfew": "23:30 local"
  }$vmeta$::jsonb
)
on conflict (id) do update set
  project_id        = excluded.project_id,
  name              = excluded.name,
  type              = excluded.type,
  status            = excluded.status,
  description       = excluded.description,
  address           = excluded.address,
  city              = excluded.city,
  region            = excluded.region,
  postcode          = excluded.postcode,
  country           = excluded.country,
  timezone          = excluded.timezone,
  latitude          = excluded.latitude,
  longitude         = excluded.longitude,
  parking_notes     = excluded.parking_notes,
  transit_notes     = excluded.transit_notes,
  seated_capacity   = excluded.seated_capacity,
  standing_capacity = excluded.standing_capacity,
  spaces            = excluded.spaces,
  amenities         = excluded.amenities,
  contact_name      = excluded.contact_name,
  contact_email     = excluded.contact_email,
  contact_phone     = excluded.contact_phone,
  website           = excluded.website,
  cover_url         = excluded.cover_url,
  gallery           = excluded.gallery,
  metadata          = excluded.metadata,
  deleted_at        = null;

-- ===========================================================================
-- 2 · The seat map — one named configuration of the venue.
-- config.field is the ring; lib/seating/bowl.js lays every tier around it and
-- the storefront draws it as the centre marker.
-- ===========================================================================
insert into events.seat_maps (id, project_id, venue_id, name, status, config, metadata)
values (
  '7b012026-0912-4a10-9c00-000000000002',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  '7b012026-0912-4a10-9c00-000000000001',
  'Championship boxing — full house',
  'Active',
  $cfg${
    "aspect": "16/10",
    "field": { "shape": "ring", "x": 43, "y": 40, "width": 14, "height": 20, "rotation": 0, "label": "The Ring" }
  }$cfg$::jsonb,
  $smeta${
    "generatedBy": "lib/seating/bowl.js",
    "bowl": { "shape": "rect", "tiers": 4, "perSide": 5, "gap": 1.8, "tierDepth": 9 },
    "tiers": ["Floor", "Lower bowl", "Club level", "Upper bowl"]
  }$smeta$::jsonb
)
on conflict (id) do update set
  project_id = excluded.project_id,
  venue_id   = excluded.venue_id,
  name       = excluded.name,
  status     = excluded.status,
  config     = excluded.config,
  metadata   = excluded.metadata,
  deleted_at = null;

-- ===========================================================================
-- 3 · The bowl — 160 sections in four tiers, 18,600 chairs between them.
-- Generated by lib/seating/bowl.js and frozen here so the ids the event's
-- sectionTiers map points at never move. 100s are the floor, 200s the lower
-- bowl, 300s the club level, 400s the upper bowl.
-- ===========================================================================
insert into events.seat_map_sections
  (id, seat_map_id, name, kind, x, y, width, height, rotation, layout, capacity, sort_order)
select v.id::uuid, '7b012026-0912-4a10-9c00-000000000002'::uuid, v.name, v.kind,
       v.x, v.y, v.width, v.height, v.rotation, v.layout, v.capacity, v.sort_order
from (values
  ('7b012026-0912-4a10-9c01-000000000001', '101', 'seated', 61.46, 49.49, 3.09, 7.03, 270.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 0),
  ('7b012026-0912-4a10-9c01-000000000002', '102', 'seated', 61.46, 55.61, 3.09, 7.01, 270.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1),
  ('7b012026-0912-4a10-9c01-000000000003', '103', 'seated', 59.44, 64.08, 2.88, 6.80, 323.58, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2),
  ('7b012026-0912-4a10-9c01-000000000004', '104', 'seated', 54.09, 65.67, 3.09, 7.03, 0.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3),
  ('7b012026-0912-4a10-9c01-000000000005', '105', 'seated', 50.32, 65.67, 3.09, 7.03, 0.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 4),
  ('7b012026-0912-4a10-9c01-000000000006', '106', 'seated', 46.59, 65.67, 3.09, 7.03, 0.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 5),
  ('7b012026-0912-4a10-9c01-000000000007', '107', 'seated', 42.81, 65.67, 3.09, 7.03, 0.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 6),
  ('7b012026-0912-4a10-9c01-000000000008', '108', 'seated', 37.68, 64.08, 2.88, 6.80, 36.42, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 7),
  ('7b012026-0912-4a10-9c01-000000000009', '109', 'seated', 35.45, 55.61, 3.09, 7.01, 90.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 8),
  ('7b012026-0912-4a10-9c01-000000000010', '110', 'seated', 35.44, 49.49, 3.09, 7.03, 90.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 9),
  ('7b012026-0912-4a10-9c01-000000000011', '111', 'seated', 35.44, 43.48, 3.09, 7.03, 90.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 10),
  ('7b012026-0912-4a10-9c01-000000000012', '112', 'seated', 35.45, 37.38, 3.09, 7.01, 90.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 11),
  ('7b012026-0912-4a10-9c01-000000000013', '113', 'seated', 37.68, 29.12, 2.88, 6.80, 143.58, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 12),
  ('7b012026-0912-4a10-9c01-000000000014', '114', 'seated', 42.81, 27.31, 3.09, 7.03, 180.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 13),
  ('7b012026-0912-4a10-9c01-000000000015', '115', 'seated', 46.59, 27.31, 3.09, 7.03, 180.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 14),
  ('7b012026-0912-4a10-9c01-000000000016', '116', 'seated', 50.32, 27.31, 3.09, 7.03, 180.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 15),
  ('7b012026-0912-4a10-9c01-000000000017', '117', 'seated', 54.09, 27.31, 3.09, 7.03, 180.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 16),
  ('7b012026-0912-4a10-9c01-000000000018', '118', 'seated', 59.44, 29.12, 2.88, 6.80, 216.42, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 17),
  ('7b012026-0912-4a10-9c01-000000000019', '119', 'seated', 61.46, 37.38, 3.09, 7.01, 270.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 18),
  ('7b012026-0912-4a10-9c01-000000000020', '120', 'seated', 61.46, 43.48, 3.09, 7.03, 270.00, '{"rows":7,"seatsPerRow":12,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 19),
  ('7b012026-0912-4a10-9c01-000000000021', '201', 'seated', 67.16, 48.70, 2.23, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1000),
  ('7b012026-0912-4a10-9c01-000000000022', '202', 'seated', 67.10, 53.27, 2.37, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1001),
  ('7b012026-0912-4a10-9c01-000000000023', '203', 'seated', 67.19, 57.80, 2.17, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1002),
  ('7b012026-0912-4a10-9c01-000000000024', '204', 'seated', 67.04, 62.48, 2.46, 6.99, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1003),
  ('7b012026-0912-4a10-9c01-000000000025', '205', 'seated', 66.18, 68.92, 2.23, 6.92, 301.03, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1004),
  ('7b012026-0912-4a10-9c01-000000000026', '206', 'seated', 63.06, 73.23, 2.30, 6.91, 336.67, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1005),
  ('7b012026-0912-4a10-9c01-000000000027', '207', 'seated', 58.92, 74.10, 2.57, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1006),
  ('7b012026-0912-4a10-9c01-000000000028', '208', 'seated', 56.18, 74.10, 2.18, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1007),
  ('7b012026-0912-4a10-9c01-000000000029', '209', 'seated', 53.13, 74.10, 2.47, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1008),
  ('7b012026-0912-4a10-9c01-000000000030', '210', 'seated', 50.27, 74.10, 2.29, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1009),
  ('7b012026-0912-4a10-9c01-000000000031', '211', 'seated', 47.43, 74.10, 2.29, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1010),
  ('7b012026-0912-4a10-9c01-000000000032', '212', 'seated', 44.40, 74.10, 2.47, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1011),
  ('7b012026-0912-4a10-9c01-000000000033', '213', 'seated', 41.65, 74.10, 2.18, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1012),
  ('7b012026-0912-4a10-9c01-000000000034', '214', 'seated', 38.50, 74.10, 2.57, 7.03, 0.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1013),
  ('7b012026-0912-4a10-9c01-000000000035', '215', 'seated', 34.64, 73.23, 2.30, 6.91, 23.33, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1014),
  ('7b012026-0912-4a10-9c01-000000000036', '216', 'seated', 31.60, 68.92, 2.23, 6.92, 58.97, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1015),
  ('7b012026-0912-4a10-9c01-000000000037', '217', 'seated', 30.50, 62.48, 2.46, 6.99, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1016),
  ('7b012026-0912-4a10-9c01-000000000038', '218', 'seated', 30.63, 57.80, 2.17, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1017),
  ('7b012026-0912-4a10-9c01-000000000039', '219', 'seated', 30.53, 53.27, 2.37, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1018),
  ('7b012026-0912-4a10-9c01-000000000040', '220', 'seated', 30.60, 48.70, 2.23, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1019),
  ('7b012026-0912-4a10-9c01-000000000041', '221', 'seated', 30.60, 44.27, 2.23, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1020),
  ('7b012026-0912-4a10-9c01-000000000042', '222', 'seated', 30.53, 39.70, 2.37, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1021),
  ('7b012026-0912-4a10-9c01-000000000043', '223', 'seated', 30.63, 35.17, 2.17, 7.03, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1022),
  ('7b012026-0912-4a10-9c01-000000000044', '224', 'seated', 30.50, 30.53, 2.46, 6.99, 90.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1023),
  ('7b012026-0912-4a10-9c01-000000000045', '225', 'seated', 31.60, 24.16, 2.23, 6.92, 121.03, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1024),
  ('7b012026-0912-4a10-9c01-000000000046', '226', 'seated', 34.64, 19.86, 2.30, 6.91, 156.67, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1025),
  ('7b012026-0912-4a10-9c01-000000000047', '227', 'seated', 38.50, 18.87, 2.57, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1026),
  ('7b012026-0912-4a10-9c01-000000000048', '228', 'seated', 41.65, 18.87, 2.18, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1027),
  ('7b012026-0912-4a10-9c01-000000000049', '229', 'seated', 44.40, 18.87, 2.47, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1028),
  ('7b012026-0912-4a10-9c01-000000000050', '230', 'seated', 47.43, 18.87, 2.29, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1029),
  ('7b012026-0912-4a10-9c01-000000000051', '231', 'seated', 50.27, 18.87, 2.29, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1030),
  ('7b012026-0912-4a10-9c01-000000000052', '232', 'seated', 53.13, 18.87, 2.47, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1031),
  ('7b012026-0912-4a10-9c01-000000000053', '233', 'seated', 56.18, 18.87, 2.18, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1032),
  ('7b012026-0912-4a10-9c01-000000000054', '234', 'seated', 58.92, 18.87, 2.57, 7.03, 180.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1033),
  ('7b012026-0912-4a10-9c01-000000000055', '235', 'seated', 63.06, 19.86, 2.30, 6.91, 203.33, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1034),
  ('7b012026-0912-4a10-9c01-000000000056', '236', 'seated', 66.18, 24.16, 2.23, 6.92, 238.97, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1035),
  ('7b012026-0912-4a10-9c01-000000000057', '237', 'seated', 67.04, 30.53, 2.46, 6.99, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1036),
  ('7b012026-0912-4a10-9c01-000000000058', '238', 'seated', 67.19, 35.17, 2.17, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1037),
  ('7b012026-0912-4a10-9c01-000000000059', '239', 'seated', 67.10, 39.70, 2.37, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1038),
  ('7b012026-0912-4a10-9c01-000000000060', '240', 'seated', 67.16, 44.27, 2.23, 7.03, 270.00, '{"rows":10,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1039),
  ('7b012026-0912-4a10-9c01-000000000061', '301', 'seated', 72.07, 49.43, 2.96, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2000),
  ('7b012026-0912-4a10-9c01-000000000062', '302', 'seated', 71.98, 55.49, 3.15, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2001),
  ('7b012026-0912-4a10-9c01-000000000063', '303', 'seated', 72.11, 61.51, 2.89, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2002),
  ('7b012026-0912-4a10-9c01-000000000064', '304', 'seated', 71.90, 67.71, 3.29, 7.00, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2003),
  ('7b012026-0912-4a10-9c01-000000000065', '305', 'seated', 70.98, 75.71, 2.99, 6.86, 298.85, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2004),
  ('7b012026-0912-4a10-9c01-000000000066', '306', 'seated', 67.34, 81.21, 3.04, 6.85, 334.06, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2005),
  ('7b012026-0912-4a10-9c01-000000000067', '307', 'seated', 62.05, 82.54, 3.46, 7.02, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2006),
  ('7b012026-0912-4a10-9c01-000000000068', '308', 'seated', 58.34, 82.54, 2.94, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2007),
  ('7b012026-0912-4a10-9c01-000000000069', '309', 'seated', 54.23, 82.54, 3.33, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2008),
  ('7b012026-0912-4a10-9c01-000000000070', '310', 'seated', 50.37, 82.54, 3.10, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2009),
  ('7b012026-0912-4a10-9c01-000000000071', '311', 'seated', 46.53, 82.54, 3.10, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2010),
  ('7b012026-0912-4a10-9c01-000000000072', '312', 'seated', 42.44, 82.54, 3.33, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2011),
  ('7b012026-0912-4a10-9c01-000000000073', '313', 'seated', 38.72, 82.54, 2.94, 7.03, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2012),
  ('7b012026-0912-4a10-9c01-000000000074', '314', 'seated', 34.49, 82.54, 3.46, 7.02, 0.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2013),
  ('7b012026-0912-4a10-9c01-000000000075', '315', 'seated', 29.62, 81.21, 3.04, 6.85, 25.94, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2014),
  ('7b012026-0912-4a10-9c01-000000000076', '316', 'seated', 26.03, 75.71, 2.99, 6.86, 61.15, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2015),
  ('7b012026-0912-4a10-9c01-000000000077', '317', 'seated', 24.81, 67.71, 3.29, 7.00, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2016),
  ('7b012026-0912-4a10-9c01-000000000078', '318', 'seated', 25.00, 61.51, 2.89, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2017),
  ('7b012026-0912-4a10-9c01-000000000079', '319', 'seated', 24.87, 55.49, 3.15, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2018),
  ('7b012026-0912-4a10-9c01-000000000080', '320', 'seated', 24.96, 49.43, 2.96, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2019),
  ('7b012026-0912-4a10-9c01-000000000081', '321', 'seated', 24.96, 43.54, 2.96, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2020),
  ('7b012026-0912-4a10-9c01-000000000082', '322', 'seated', 24.87, 37.48, 3.15, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2021),
  ('7b012026-0912-4a10-9c01-000000000083', '323', 'seated', 25.00, 31.46, 2.89, 7.03, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2022),
  ('7b012026-0912-4a10-9c01-000000000084', '324', 'seated', 24.81, 25.29, 3.29, 7.00, 90.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2023),
  ('7b012026-0912-4a10-9c01-000000000085', '325', 'seated', 26.03, 17.43, 2.99, 6.86, 118.85, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2024),
  ('7b012026-0912-4a10-9c01-000000000086', '326', 'seated', 29.62, 11.94, 3.04, 6.85, 154.06, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2025),
  ('7b012026-0912-4a10-9c01-000000000087', '327', 'seated', 34.49, 10.44, 3.46, 7.02, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2026),
  ('7b012026-0912-4a10-9c01-000000000088', '328', 'seated', 38.72, 10.44, 2.94, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2027),
  ('7b012026-0912-4a10-9c01-000000000089', '329', 'seated', 42.44, 10.44, 3.33, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2028),
  ('7b012026-0912-4a10-9c01-000000000090', '330', 'seated', 46.53, 10.44, 3.10, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2029),
  ('7b012026-0912-4a10-9c01-000000000091', '331', 'seated', 50.37, 10.44, 3.10, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2030),
  ('7b012026-0912-4a10-9c01-000000000092', '332', 'seated', 54.23, 10.44, 3.33, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2031),
  ('7b012026-0912-4a10-9c01-000000000093', '333', 'seated', 58.34, 10.44, 2.94, 7.03, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2032),
  ('7b012026-0912-4a10-9c01-000000000094', '334', 'seated', 62.05, 10.44, 3.46, 7.02, 180.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2033),
  ('7b012026-0912-4a10-9c01-000000000095', '335', 'seated', 67.34, 11.94, 3.04, 6.85, 205.94, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2034),
  ('7b012026-0912-4a10-9c01-000000000096', '336', 'seated', 70.98, 17.43, 2.99, 6.86, 241.15, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2035),
  ('7b012026-0912-4a10-9c01-000000000097', '337', 'seated', 71.90, 25.29, 3.29, 7.00, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2036),
  ('7b012026-0912-4a10-9c01-000000000098', '338', 'seated', 72.11, 31.46, 2.89, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2037),
  ('7b012026-0912-4a10-9c01-000000000099', '339', 'seated', 71.98, 37.48, 3.15, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2038),
  ('7b012026-0912-4a10-9c01-000000000100', '340', 'seated', 72.07, 43.54, 2.96, 7.03, 270.00, '{"rows":7,"seatsPerRow":15,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2039),
  ('7b012026-0912-4a10-9c01-000000000101', '401', 'seated', 77.60, 48.93, 2.45, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3000),
  ('7b012026-0912-4a10-9c01-000000000102', '402', 'seated', 77.57, 53.88, 2.52, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3001),
  ('7b012026-0912-4a10-9c01-000000000103', '403', 'seated', 77.50, 59.03, 2.65, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3002),
  ('7b012026-0912-4a10-9c01-000000000104', '404', 'seated', 77.65, 64.03, 2.35, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3003),
  ('7b012026-0912-4a10-9c01-000000000105', '405', 'seated', 77.54, 68.93, 2.57, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3004),
  ('7b012026-0912-4a10-9c01-000000000106', '406', 'seated', 77.40, 74.37, 2.81, 6.98, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3005),
  ('7b012026-0912-4a10-9c01-000000000107', '407', 'seated', 76.82, 81.03, 2.56, 6.92, 291.63, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3006),
  ('7b012026-0912-4a10-9c01-000000000108', '408', 'seated', 74.67, 86.36, 2.48, 6.93, 315.02, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3007),
  ('7b012026-0912-4a10-9c01-000000000109', '409', 'seated', 71.26, 89.88, 2.58, 6.92, 338.53, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3008),
  ('7b012026-0912-4a10-9c01-000000000110', '410', 'seated', 66.80, 90.97, 2.96, 6.99, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3009),
  ('7b012026-0912-4a10-9c01-000000000111', '411', 'seated', 63.42, 90.97, 2.66, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3010),
  ('7b012026-0912-4a10-9c01-000000000112', '412', 'seated', 60.39, 90.97, 2.41, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3011),
  ('7b012026-0912-4a10-9c01-000000000113', '413', 'seated', 56.88, 90.97, 2.84, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3012),
  ('7b012026-0912-4a10-9c01-000000000114', '414', 'seated', 53.54, 90.97, 2.67, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3013),
  ('7b012026-0912-4a10-9c01-000000000115', '415', 'seated', 50.32, 90.97, 2.58, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3014),
  ('7b012026-0912-4a10-9c01-000000000116', '416', 'seated', 47.10, 90.97, 2.58, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3015),
  ('7b012026-0912-4a10-9c01-000000000117', '417', 'seated', 43.79, 90.97, 2.67, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3016),
  ('7b012026-0912-4a10-9c01-000000000118', '418', 'seated', 40.27, 90.97, 2.84, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3017),
  ('7b012026-0912-4a10-9c01-000000000119', '419', 'seated', 37.20, 90.97, 2.41, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3018),
  ('7b012026-0912-4a10-9c01-000000000120', '420', 'seated', 33.92, 90.97, 2.66, 7.03, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3019),
  ('7b012026-0912-4a10-9c01-000000000121', '421', 'seated', 30.24, 90.97, 2.96, 6.99, 0.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3020),
  ('7b012026-0912-4a10-9c01-000000000122', '422', 'seated', 26.16, 89.88, 2.58, 6.92, 21.47, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3021),
  ('7b012026-0912-4a10-9c01-000000000123', '423', 'seated', 22.86, 86.36, 2.48, 6.93, 44.98, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3022),
  ('7b012026-0912-4a10-9c01-000000000124', '424', 'seated', 20.62, 81.03, 2.56, 6.92, 68.37, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3023),
  ('7b012026-0912-4a10-9c01-000000000125', '425', 'seated', 19.79, 74.37, 2.81, 6.98, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3024),
  ('7b012026-0912-4a10-9c01-000000000126', '426', 'seated', 19.89, 68.93, 2.57, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3025),
  ('7b012026-0912-4a10-9c01-000000000127', '427', 'seated', 20.00, 64.03, 2.35, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3026),
  ('7b012026-0912-4a10-9c01-000000000128', '428', 'seated', 19.85, 59.03, 2.65, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3027),
  ('7b012026-0912-4a10-9c01-000000000129', '429', 'seated', 19.92, 53.88, 2.52, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3028),
  ('7b012026-0912-4a10-9c01-000000000130', '430', 'seated', 19.95, 48.93, 2.45, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3029),
  ('7b012026-0912-4a10-9c01-000000000131', '431', 'seated', 19.95, 44.04, 2.45, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3030),
  ('7b012026-0912-4a10-9c01-000000000132', '432', 'seated', 19.92, 39.09, 2.52, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3031),
  ('7b012026-0912-4a10-9c01-000000000133', '433', 'seated', 19.85, 33.94, 2.65, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3032),
  ('7b012026-0912-4a10-9c01-000000000134', '434', 'seated', 20.00, 28.94, 2.35, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3033),
  ('7b012026-0912-4a10-9c01-000000000135', '435', 'seated', 19.89, 24.04, 2.57, 7.03, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3034),
  ('7b012026-0912-4a10-9c01-000000000136', '436', 'seated', 19.79, 18.66, 2.81, 6.98, 90.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3035),
  ('7b012026-0912-4a10-9c01-000000000137', '437', 'seated', 20.62, 12.05, 2.56, 6.92, 111.63, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3036),
  ('7b012026-0912-4a10-9c01-000000000138', '438', 'seated', 22.86, 6.71, 2.48, 6.93, 135.02, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3037),
  ('7b012026-0912-4a10-9c01-000000000139', '439', 'seated', 26.16, 3.20, 2.58, 6.92, 158.53, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3038),
  ('7b012026-0912-4a10-9c01-000000000140', '440', 'seated', 30.24, 2.04, 2.96, 6.99, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3039),
  ('7b012026-0912-4a10-9c01-000000000141', '441', 'seated', 33.92, 2.00, 2.66, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3040),
  ('7b012026-0912-4a10-9c01-000000000142', '442', 'seated', 37.20, 2.00, 2.41, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3041),
  ('7b012026-0912-4a10-9c01-000000000143', '443', 'seated', 40.27, 2.00, 2.84, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3042),
  ('7b012026-0912-4a10-9c01-000000000144', '444', 'seated', 43.79, 2.00, 2.67, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3043),
  ('7b012026-0912-4a10-9c01-000000000145', '445', 'seated', 47.10, 2.00, 2.58, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3044),
  ('7b012026-0912-4a10-9c01-000000000146', '446', 'seated', 50.32, 2.00, 2.58, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3045),
  ('7b012026-0912-4a10-9c01-000000000147', '447', 'seated', 53.54, 2.00, 2.67, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3046),
  ('7b012026-0912-4a10-9c01-000000000148', '448', 'seated', 56.88, 2.00, 2.84, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3047),
  ('7b012026-0912-4a10-9c01-000000000149', '449', 'seated', 60.39, 2.00, 2.41, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3048),
  ('7b012026-0912-4a10-9c01-000000000150', '450', 'seated', 63.42, 2.00, 2.66, 7.03, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3049),
  ('7b012026-0912-4a10-9c01-000000000151', '451', 'seated', 66.80, 2.04, 2.96, 6.99, 180.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3050),
  ('7b012026-0912-4a10-9c01-000000000152', '452', 'seated', 71.26, 3.20, 2.58, 6.92, 201.47, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3051),
  ('7b012026-0912-4a10-9c01-000000000153', '453', 'seated', 74.67, 6.71, 2.48, 6.93, 224.98, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3052),
  ('7b012026-0912-4a10-9c01-000000000154', '454', 'seated', 76.82, 12.05, 2.56, 6.92, 248.37, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3053),
  ('7b012026-0912-4a10-9c01-000000000155', '455', 'seated', 77.40, 18.66, 2.81, 6.98, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3054),
  ('7b012026-0912-4a10-9c01-000000000156', '456', 'seated', 77.54, 24.04, 2.57, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3055),
  ('7b012026-0912-4a10-9c01-000000000157', '457', 'seated', 77.65, 28.94, 2.35, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3056),
  ('7b012026-0912-4a10-9c01-000000000158', '458', 'seated', 77.50, 33.94, 2.65, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3057),
  ('7b012026-0912-4a10-9c01-000000000159', '459', 'seated', 77.57, 39.09, 2.52, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3058),
  ('7b012026-0912-4a10-9c01-000000000160', '460', 'seated', 77.60, 44.04, 2.45, 7.03, 270.00, '{"rows":8,"seatsPerRow":14,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3059)
) as v(id, name, kind, x, y, width, height, rotation, layout, capacity, sort_order)
on conflict (id) do update set
  seat_map_id = excluded.seat_map_id,
  name        = excluded.name,
  kind        = excluded.kind,
  x           = excluded.x,
  y           = excluded.y,
  width       = excluded.width,
  height      = excluded.height,
  rotation    = excluded.rotation,
  layout      = excluded.layout,
  capacity    = excluded.capacity,
  sort_order  = excluded.sort_order;

-- ===========================================================================
-- 4 · Two coupons, as reusable ticketing_records.
-- A code only works on a ticket that lists its id in discountIds (below), and
-- events.public_event_discount additionally requires the event to attach it —
-- so both wirings are set.
-- ===========================================================================
insert into events.ticketing_records (id, project_id, module, kind, name, active, config)
values
  (
    '7b012026-0912-4a10-9c02-000000000001',
    'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
    'discount', 'coupon', 'Fight Week — 15% off the bowl', true,
    $c1${
      "code": "VEGAS15",
      "discountType": "percent",
      "value": 15,
      "usageLimit": 0,
      "applyPer": "order",
      "maxDiscount": 400,
      "minQty": 2,
      "maxQty": null,
      "validFrom": "",
      "validUntil": "2026-09-11T23:59",
      "rules": [
        { "id": "r1", "label": "Four or more together", "minQty": 4, "maxQty": null, "validFrom": "", "validUntil": "", "discountType": "percent", "value": 20, "applyPer": "order" }
      ]
    }$c1$::jsonb
  ),
  (
    '7b012026-0912-4a10-9c02-000000000002',
    'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
    'discount', 'coupon', 'Upper bowl — $40 off, first 500', true,
    $c2${
      "code": "FIRSTBELL",
      "discountType": "flat",
      "value": 40,
      "usageLimit": 500,
      "applyPer": "ticket",
      "maxDiscount": null,
      "minQty": null,
      "maxQty": 6,
      "validFrom": "",
      "validUntil": "2026-09-12T13:00",
      "rules": []
    }$c2$::jsonb
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  module     = excluded.module,
  kind       = excluded.kind,
  name       = excluded.name,
  active     = excluded.active,
  config     = excluded.config,
  deleted_at = null;

-- ===========================================================================
-- 5 · The event
-- ===========================================================================
insert into events.events (
  id, project_id, venue_id, name, status, type, event_date, event_time, timezone,
  venue, address, city, capacity, sold, revenue, visibility, organizer,
  summary, cover_url, gallery, is_listable, metadata
) values (
  '9a4c2026-0912-4b12-9e00-000000000001',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  '7b012026-0912-4a10-9c00-000000000001',
  'Garcia vs Benn — WBC Welterweight World Championship',
  'On sale',
  'In-person',
  '2026-09-12',
  '14:00',
  'America/Los_Angeles',
  'T-Mobile Arena',
  '3780 S Las Vegas Blvd, Las Vegas, NV 89109',
  'Las Vegas',
  18600,
  11305,
  11038885,
  'Public',
  'Zuffa Boxing',
  'Mexican Independence Day weekend on the Strip. Ryan Garcia makes the first defence of his WBC welterweight title against Conor Benn over twelve rounds, above an unbeaten cruiserweight champion and seven more fights.',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg/1920px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg',
  $gallery$[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/T-Mobile_Arena_Outside.jpg/1920px-T-Mobile_Arena_Outside.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/The_Las_Vegas_Strip_at_night_29AUG19.jpg/1920px-The_Las_Vegas_Strip_at_night_29AUG19.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/1920px-Set-up_of_a_boxing_Ring.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Las_Vegas_Strip_from_Resorts_World_February_2023_HDR_1.jpg/1920px-Las_Vegas_Strip_from_Resorts_World_February_2023_HDR_1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Las_Vegas_05.2020_-_T-Mobile_Arena.jpg/1920px-Las_Vegas_05.2020_-_T-Mobile_Arena.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798877122%29.jpg/1920px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798877122%29.jpg"
  ]$gallery$::jsonb,
  true,
  $meta${
    "description": "## Twelve rounds, one belt, Mexican Independence Day weekend\n\n**Ryan Garcia (25-2, 20 KOs)** comes back to the room where he won it. In February he took the WBC welterweight title off Mario Barrios on this floor; on 12 September he defends it here for the first time, against a man who has waited three years for a night like this.\n\n**Conor Benn (25-1, 14 KOs)** arrives off a decisive win over the two-time world champion Regis Prograis in his Zuffa Boxing debut. It is the hardest fight of his career and the first world title he has ever boxed for — and at 147lbs, in front of a Strip crowd on Mexican Independence Day weekend, there is nowhere for either man to hide.\n\n### The co-main: 30-0 against 28-3\n\n**Jai Opetaia** has not lost. Thirty fights, thirty wins, and both the Zuffa Boxing and *Ring* cruiserweight titles on the line against **Noel Mikaelian**, who has beaten better men than his record suggests. Two belts, twelve rounds, straight before the main event.\n\n### Nine fights, seven hours\n\nDoors at one. First bell at two. The main card joins the stream at 5pm Pacific — 8pm on the East Coast — and the ring walks for the championship fight land shortly after half past seven. Between those two points there is an unbeaten heavyweight, a former featherweight world champion, and a welterweight ten-rounder in **Jose Ramirez vs Alexis Rocha** that would headline most cards in the country.\n\nT-Mobile Arena reconfigures to 18,600 for a fight: the ring on the floor, then four tiers wrapped around it. Every seat in this building is sold as a specific chair, and you pick yours yourself.",
    "highlights": [
      { "id": "h1", "title": "A world title defended, not won", "detail": "Garcia's first defence of the WBC welterweight belt he took from Mario Barrios in this same building in February." },
      { "id": "h2", "title": "An unbeaten champion in the co-main", "detail": "Jai Opetaia is 30-0. Both the Zuffa Boxing and Ring cruiserweight titles are on the line against Noel Mikaelian." },
      { "id": "h3", "title": "Nine fights on one card", "detail": "Five preliminary bouts from 2pm, then four on the main card. No filler — Ramirez vs Rocha alone is a ten-round welterweight main event anywhere else." },
      { "id": "h4", "title": "Pick your own chair", "detail": "Every one of the 18,600 seats is reserved and sold individually. Choose your level, then choose the exact seat on the arena plan." },
      { "id": "h5", "title": "Mexican Independence Day weekend", "detail": "The single biggest weekend in the Las Vegas boxing calendar, and the Strip behaves accordingly." },
      { "id": "h6", "title": "Four tiers, eight price bands", "detail": "Ringside on the floor to the last row of the upper bowl, priced by level and by side. The map is coloured by what you would actually pay." }
    ],
    "schedule": [
      { "id": "s1", "layout": "timeline", "spacing": "normal", "frame": "boxed", "sectionNote": "All times are local to Las Vegas (PT). The main card start is fixed by the broadcast; everything below it is indicative and moves with the length of the fights ahead of it.", "time": "13:00", "title": "Doors open", "description": "All gates. Box office, merchandise and bars open with the building. Clear-bag policy applies at every entrance.", "by": "Saturday 12 September", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s2", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "14:00", "title": "Vlad Panin vs Dakota Linger", "description": "Super welterweight, 6 rounds. Panin 24-2 (16 KOs), Linger 17-7-3 (13 KOs) of Buckhannon, West Virginia. First bell of the night.", "by": "Preliminary card" },
      { "id": "s3", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "14:35", "title": "Oswaldo Molina vs Pablo Rubio", "description": "132lb catchweight, 6 rounds. Two unbeaten men — Mexico's Molina 9-0 (4 KOs) against Los Angeles native Rubio 15-0 (5 KOs).", "by": "Preliminary card" },
      { "id": "s4", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "15:05", "title": "Abel Gonzalez vs Raul Salomon", "description": "Super middleweight, 8 rounds. Las Vegas native Gonzalez 8-0 (6 KOs) against Mexico's Salomon 16-4-1 (14 KOs), who has never been stopped.", "by": "Preliminary card" },
      { "id": "s5", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "15:45", "title": "Sean Garcia vs Abraham Morales", "description": "Lightweight, 6 rounds. Sean Garcia 7-1-1 (2 KOs) of Victorville, California, against Oxnard-based Morales 4-1 (2 KOs) of Mexico.", "by": "Preliminary card" },
      { "id": "s6", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "16:15", "title": "Jose Ramirez vs Alexis Rocha", "description": "Welterweight, 10 rounds. The former unified light-welterweight champion Ramirez (29-3, 18 KOs) against Rocha (26-2-1, 16 KOs). The fight that closes the prelims and would headline most cards in the country.", "by": "Preliminary card", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/1920px-Set-up_of_a_boxing_Ring.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s7", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Main card begins — Mark Magsayo vs Andres Cortes", "description": "Lightweight, 10 rounds. Magsayo 29-2, Cortes 25-0. 8pm ET: the broadcast joins here.", "by": "Main card" },
      { "id": "s8", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:50", "title": "Da'Mazion Vanhouter vs Raphael Akpejiori", "description": "Heavyweight, 8 rounds. Vanhouter is 12-0; Akpejiori (19-3) is the sternest test of that record so far.", "by": "Main card" },
      { "id": "s9", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:30", "title": "CO-MAIN: Jai Opetaia vs Noel Mikaelian", "description": "Cruiserweight, 12 rounds, for the Zuffa Boxing and Ring cruiserweight world titles. Opetaia defends an unbeaten 30-0 record against Mikaelian (28-3).", "by": "Main card", "image": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s10", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:30", "title": "MAIN EVENT: Ryan Garcia vs Conor Benn", "description": "Welterweight, 12 rounds, for the WBC world title. Ring walks from approximately 19:30 — the exact time depends on how the card has run. Garcia 25-2 (20 KOs), Benn 25-1 (14 KOs).", "by": "Main event", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg", "imagePosition": "background", "imageFit": "cover" },
      { "id": "s11", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "21:15", "title": "Decision, presentation and post-fight", "description": "Scorecards, the belt, and the in-ring interviews. The concourse stays open for thirty minutes after the last announcement.", "by": "Main event" }
    ],
    "guests": [
      { "id": "g1", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Ryan Garcia", "role": "Main event · WBC welterweight world title, 12 rounds", "company": "25-2 (20 KOs) · United States", "bio": "Won this title in this building in February, taking a wide decision off Mario Barrios. Twenty of his twenty-five wins have come inside the distance, and the left hook that stopped Luke Campbell and dropped Devin Haney is still the fastest single punch in the division." },
      { "id": "g2", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Flag_of_England.svg/330px-Flag_of_England.svg.png", "name": "Conor Benn", "role": "Main event · challenger, 12 rounds", "company": "25-1 (14 KOs) · England", "bio": "Son of Nigel Benn, and boxing for a world title for the first time. His Zuffa Boxing debut was a decisive win over the two-time world champion Regis Prograis — the performance that earned him this shot at 147lbs." },
      { "id": "g3", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Australia.svg/330px-Flag_of_Australia.svg.png", "name": "Jai Opetaia", "role": "Co-main · Zuffa Boxing & Ring cruiserweight titles, 12 rounds", "company": "30-0 · Australia", "bio": "Thirty fights, thirty wins, two world titles, and a reputation for finishing rounds the way he starts them. Beat Mairis Briedis with a broken jaw and has not slowed down since." },
      { "id": "g4", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/330px-Flag_of_Germany.svg.png", "name": "Noel Mikaelian", "role": "Co-main · challenger, 12 rounds", "company": "28-3 · Germany", "bio": "A cruiserweight who has spent a decade beating people he was not supposed to beat. The three losses are all to top-ten opposition, and none of them came easily." },
      { "id": "g5", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Da'Mazion Vanhouter", "role": "Main card · heavyweight, 8 rounds", "company": "12-0 · United States", "bio": "Unbeaten in twelve and moving quickly. This is the first time he has been asked a question by someone with nineteen professional wins." },
      { "id": "g6", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Flag_of_Nigeria.svg/330px-Flag_of_Nigeria.svg.png", "name": "Raphael Akpejiori", "role": "Main card · heavyweight, 8 rounds", "company": "19-3 · Nigeria", "bio": "A former University of Miami basketball player who came to boxing late and has won nineteen since. Six foot seven, and the reach that comes with it." },
      { "id": "g7", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Flag_of_the_Philippines.svg/330px-Flag_of_the_Philippines.svg.png", "name": "Mark Magsayo", "role": "Main card · lightweight, 10 rounds", "company": "29-2 · Philippines", "bio": "Former WBC featherweight world champion, moving up in weight for the second time. Twenty of his wins are knockouts and he has never been in a dull fight." },
      { "id": "g8", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Andres Cortes", "role": "Main card · lightweight, 10 rounds", "company": "25-0 · United States", "bio": "Unbeaten in twenty-five, and boxing in his home city. Las Vegas-born, Las Vegas-trained, and this is the biggest room he has fought in." },
      { "id": "g9", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Jose Ramirez", "role": "Preliminary card · welterweight, 10 rounds", "company": "29-3 (18 KOs) · United States", "bio": "Former unified light-welterweight world champion from Avenal, California. Twenty-nine wins, eighteen inside the distance, and the biggest name on the undercard — this ten-rounder closes the prelims." },
      { "id": "g10", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Alexis Rocha", "role": "Preliminary card · welterweight, 10 rounds", "company": "26-2-1 (16 KOs) · United States", "bio": "Santa Ana southpaw, 26-2-1 with sixteen knockouts. Has only ever lost at the top of the division and comes to spoil the former champion's homecoming." },
      { "id": "g11", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Vlad Panin", "role": "Preliminary card · super welterweight, 6 rounds", "company": "24-2 (16 KOs) · United States", "bio": "Los Angeles-based welterweight, 24-2 with sixteen knockouts. Signed by Zuffa Boxing off a stoppage win over Shinard Bunch and opening the night's boxing." },
      { "id": "g12", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Dakota Linger", "role": "Preliminary card · super welterweight, 6 rounds", "company": "17-7-3 (13 KOs) · United States", "bio": "The 'Lone Wolf' from Buckhannon, West Virginia. Seventeen wins against genuine opposition — the kind of durable test that has derailed hotter prospects than Panin." },
      { "id": "g13", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Flag_of_Mexico.svg/330px-Flag_of_Mexico.svg.png", "name": "Oswaldo Molina", "role": "Preliminary card · 132lb catchweight, 6 rounds", "company": "9-0 (4 KOs) · Mexico", "bio": "'Pitufo' from Guadalajara, nineteen years old and 9-0. Unbeaten, unhurried, and facing the first fellow unbeaten of his career." },
      { "id": "g14", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Pablo Rubio", "role": "Preliminary card · 132lb catchweight, 6 rounds", "company": "15-0 (5 KOs) · United States", "bio": "The 'Shark' from Los Angeles, 15-0 and fighting out of Whittier. Ten years a pro without a loss — the experience edge in a battle of unbeatens." },
      { "id": "g15", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Abel Gonzalez", "role": "Preliminary card · super middleweight, 8 rounds", "company": "8-0 (6 KOs) · United States", "bio": "Las Vegas native, Florida-based, twice a National Golden Gloves champion. Eight wins, six early, and tipped by Queensberry as a future star at 168lbs." },
      { "id": "g16", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Flag_of_Mexico.svg/330px-Flag_of_Mexico.svg.png", "name": "Raul Salomon", "role": "Preliminary card · super middleweight, 8 rounds", "company": "16-4-1 (14 KOs) · Mexico", "bio": "From Ciudad Morelos, Baja California. Sixteen wins, fourteen by stoppage, and never been stopped himself — including ten rounds with the unbeaten Daniel Blancas in May." },
      { "id": "g17", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Sean Garcia", "role": "Preliminary card · lightweight, 6 rounds", "company": "7-1-1 (2 KOs) · United States", "bio": "Younger brother of Ryan, fighting out of Victorville, California. Seven wins in nine — and sharing a card with his brother for the biggest night of his career." },
      { "id": "g18", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Flag_of_Mexico.svg/330px-Flag_of_Mexico.svg.png", "name": "Abraham Morales", "role": "Preliminary card · lightweight, 6 rounds", "company": "4-1 (2 KOs) · Mexico", "bio": "Oxnard-based Mexican lightweight. Four wins in five, and nothing to lose against the most famous surname on the undercard." }
    ],
    "guestsDisplay": { "layout": "list", "columns": 4, "imageShape": "square", "imageFit": "contain", "cardStyle": "card", "align": "left", "showBio": true },
    "faq": [
      { "id": "f1", "q": "What time should I actually get there?", "a": "Doors are at **13:00** and the first bell is at **14:00**. If you only want the main card, be in your seat by **17:00** — but Ramirez vs Rocha closes the prelims at around 16:15 and is worth the earlier start. The main event ring walks are from approximately 19:30." },
      { "id": "f2", "q": "Do I choose my own seat?", "a": "Yes. Every seat in the building is reserved and sold individually. Pick your price band first, then pick the exact chair on the arena plan — your selection is held for ten minutes while you check out, and released automatically if you do not finish." },
      { "id": "f3", "q": "What is the difference between Ringside and Floor?", "a": "Both are on the arena floor. **Ringside** is the twelve sections along the two long sides of the ring, closest to the action and to the broadcast position. **Floor** is the eight sections at the ends. Ringside Champions Club is a small, separately released block in the four centre-side sections." },
      { "id": "f4", "q": "Is there an age limit?", "a": "No, but everyone aged 3 and over needs their own ticket and their own seat. Under-3s enter free on a lap. Anyone being served alcohol will be asked for photo ID — Nevada is strictly 21+." },
      { "id": "f5", "q": "What can I bring in?", "a": "One clear bag no larger than 12 x 6 x 12 inches, or a small clutch no larger than 4.5 x 6.5 inches. No outside food or drink, no professional cameras with detachable lenses, no signs on poles. There is no bag check on site, so anything refused goes back to your room." },
      { "id": "f6", "q": "How do I get there and where do I park?", "a": "Walk if you are anywhere on the south Strip — the arena sits behind The Park between New York-New York and Park MGM. There is no arena lot: the New York-New York, Park MGM and Excalibur garages are all a five-minute walk and fill from about three hours out. Pre-paid parking is available as an add-on at checkout. The MGM Grand monorail station is about fifteen minutes on foot." },
      { "id": "f7", "q": "Can I change my seat after buying?", "a": "Contact the box office. A reseat is possible while equivalent inventory exists in the band you bought, and there is no fee for moving within the same band. Refunds follow the event's order policy — a bout changing or being withdrawn from the card is not grounds for a refund provided the main event goes ahead." },
      { "id": "f8", "q": "What accessibility provision is there?", "a": "Wheelchair spaces with a companion seat sit on all four tiers, floor included, with step-free routes from every accessible drop-off. Assistive listening receivers are free at any guest services desk, and there is a quiet sensory room off the main concourse. Book accessible seating directly on the plan rather than converting a standard seat on the night." }
    ],
    "map": {
      "coords": { "lat": 36.1028, "lng": -115.1783 },
      "transport": "The MGM Grand and Bally's stations put the Las Vegas Monorail about fifteen minutes' walk from the gates, running an extended service on event nights. Harry Reid International (LAS) is four miles south — ten minutes by road outside event hours, considerably more after the final bell. The Strip itself is the fastest way in on foot from anywhere between the Luxor and the Bellagio.",
      "parking": "The arena has no lot of its own. The New York-New York, Park MGM and Excalibur garages all sit within a five-minute walk and stay open through the night, filling from about three hours before the first bell. Pre-paid parking is available as an add-on at checkout. Frank Sinatra Drive is the least-jammed approach; Las Vegas Boulevard will not be.",
      "nearbyHotels": [
        { "name": "Park MGM", "kind": "Hotel", "detail": "North side of The Park — the shortest walk to any gate", "walkMin": 4, "lat": 36.1017, "lng": -115.1738 },
        { "name": "New York-New York", "kind": "Hotel", "detail": "South side of The Park, opposite Park MGM", "walkMin": 5, "lat": 36.1023, "lng": -115.1745 },
        { "name": "Excalibur", "kind": "Hotel", "detail": "Across Tropicana, connected by the free tram", "walkMin": 12, "lat": 36.0989, "lng": -115.1755 },
        { "name": "MGM Grand", "kind": "Hotel", "detail": "Corner of Tropicana and the Boulevard, by the monorail", "walkMin": 14, "lat": 36.1026, "lng": -115.1700 },
        { "name": "Aria Resort & Casino", "kind": "Hotel", "detail": "CityCenter, north along the Boulevard", "walkMin": 15, "lat": 36.1073, "lng": -115.1766 },
        { "name": "The Cosmopolitan of Las Vegas", "kind": "Hotel", "detail": "Mid-Strip, above the Boulevard", "walkMin": 18, "lat": 36.1097, "lng": -115.1742 },
        { "name": "Luxor", "kind": "Hotel", "detail": "South Strip, on the tram line", "walkMin": 20, "lat": 36.0955, "lng": -115.1761 },
        { "name": "Bellagio", "kind": "Hotel", "detail": "Fountain-side, twenty-five minutes up the Boulevard", "walkMin": 25, "lat": 36.1126, "lng": -115.1767 }
      ],
      "nearbyFood": [
        { "name": "Beerhaus", "kind": "Bar", "detail": "The Park — the pre-fight meeting point, right outside the gates", "walkMin": 2, "lat": 36.1021, "lng": -115.1755 },
        { "name": "Sake Rok", "kind": "Restaurant", "detail": "The Park — Japanese, loud, open late", "walkMin": 3, "lat": 36.1020, "lng": -115.1752 },
        { "name": "Bruxie", "kind": "Fast food", "detail": "The Park — fried chicken and waffles, quick before doors", "walkMin": 3, "lat": 36.1022, "lng": -115.1750 },
        { "name": "Eataly Las Vegas", "kind": "Restaurant", "detail": "Park MGM — market, counters and a full restaurant", "walkMin": 5, "lat": 36.1015, "lng": -115.1740 },
        { "name": "Bavette's Steakhouse", "kind": "Restaurant", "detail": "Park MGM — book well ahead on fight weekend", "walkMin": 5, "lat": 36.1014, "lng": -115.1737 },
        { "name": "Tom's Urban", "kind": "Restaurant", "detail": "New York-New York — big screens, big tables", "walkMin": 6, "lat": 36.1026, "lng": -115.1748 }
      ],
      "nearbyTransit": [
        { "name": "MGM Grand Monorail", "kind": "Transit stop", "detail": "Southern terminus of the line, extended service on event nights", "walkMin": 15, "lat": 36.1024, "lng": -115.1671 },
        { "name": "Bally's / Paris Monorail", "kind": "Transit stop", "detail": "Next station north, for mid-Strip hotels", "walkMin": 24, "lat": 36.1131, "lng": -115.1699 },
        { "name": "Aria Express Tram — Park MGM", "kind": "Transit stop", "detail": "Free tram to Aria and Bellagio", "walkMin": 6, "lat": 36.1030, "lng": -115.1760 },
        { "name": "Harry Reid International Airport", "kind": "Transit", "detail": "LAS — four miles south, ten minutes by road outside event hours", "walkMin": 70, "lat": 36.0840, "lng": -115.1537 }
      ],
      "nearbyParking": [
        { "name": "New York-New York Garage", "kind": "Car park", "detail": "Closest self-park to the arena gates", "walkMin": 6, "lat": 36.1013, "lng": -115.1764 },
        { "name": "Park MGM Garage", "kind": "Car park", "detail": "North side, straight onto The Park", "walkMin": 6, "lat": 36.1009, "lng": -115.1745 },
        { "name": "Excalibur Garage", "kind": "Car park", "detail": "Across Tropicana, usually the last to fill", "walkMin": 13, "lat": 36.0982, "lng": -115.1769 },
        { "name": "MGM Grand Garage", "kind": "Car park", "detail": "East on Tropicana, near the monorail", "walkMin": 15, "lat": 36.1020, "lng": -115.1685 }
      ],
      "nearbyTaxi": [
        { "name": "New York-New York Taxi Stand", "kind": "Taxi rank", "detail": "Staffed until the building empties; rideshare pick-up alongside", "walkMin": 6, "lat": 36.1027, "lng": -115.1740 },
        { "name": "Park MGM Taxi Stand", "kind": "Taxi rank", "detail": "Quieter than New York-New York after the final bell", "walkMin": 6, "lat": 36.1012, "lng": -115.1735 }
      ]
    },
    "ticketGroups": [
      { "tierId": "t-floor", "name": "Ringside & Floor", "color": "rose", "rank": 1 },
      { "tierId": "t-lower", "name": "Lower Bowl", "color": "amber", "rank": 2 },
      { "tierId": "t-club", "name": "Club Level", "color": "violet", "rank": 3 },
      { "tierId": "t-upper", "name": "Upper Bowl", "color": "slate", "rank": 4 }
    ],
    "tickets": [
      { "id": "tk-ringside-vip", "groupId": "t-floor", "name": "Ringside Champions Club", "price": 12500, "qty": 336, "description": "The four centre-side floor sections, level with the ring and beside the broadcast position. Released to Champions Club members only — enter your code above to unlock.", "discountIds": [] },
      { "id": "tk-ringside", "groupId": "t-floor", "name": "Ringside — sides", "price": 5500, "qty": 672, "description": "Floor seating along the two long sides of the ring. The corner is behind you and the cards are in front of you.", "discountIds": [] },
      { "id": "tk-floor", "groupId": "t-floor", "name": "Floor — ends", "price": 1800, "qty": 672, "description": "Floor seating at the two ends of the ring, behind the neutral corners. On the floor, at a fraction of ringside.", "discountIds": [] },
      { "id": "tk-lower-side", "groupId": "t-lower", "name": "Lower Bowl — sideline", "price": 855, "qty": 3000, "description": "First tier above the floor, along the sides. The best value view of a full twelve-round fight in the building.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001"] },
      { "id": "tk-lower-end", "groupId": "t-lower", "name": "Lower Bowl — end", "price": 555, "qty": 3000, "description": "First tier above the floor, behind the corners. Same height, shallower angle, lower price.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001"] },
      { "id": "tk-club-side", "groupId": "t-club", "name": "Club Level — sideline", "price": 455, "qty": 2100, "description": "Second tier, along the sides, with in-seat service and access to the club concourse.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001"] },
      { "id": "tk-club-end", "groupId": "t-club", "name": "Club Level — end", "price": 325, "qty": 2100, "description": "Second tier, behind the corners, with the same club concourse access.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001"] },
      { "id": "tk-upper-side", "groupId": "t-upper", "name": "Upper Bowl — sideline", "price": 255, "qty": 3136, "description": "Top tier, along the sides. Every seat sees the whole ring, and the big screen is directly opposite.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001", "7b012026-0912-4a10-9c02-000000000002"], "releases": [ { "id": "rel-us-1", "name": "General on-sale", "qty": 1800, "startMode": "now", "startAt": "", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }, { "id": "rel-us-2", "name": "Fight Week release", "qty": 1336, "startMode": "date", "startAt": "2026-09-08T10:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false } ] },
      { "id": "tk-upper-end", "groupId": "t-upper", "name": "Upper Bowl — end", "price": 155, "qty": 3584, "description": "Top tier, behind the corners. The cheapest seat in the building and the loudest part of it.", "discountIds": ["7b012026-0912-4a10-9c02-000000000001", "7b012026-0912-4a10-9c02-000000000002"], "releases": [ { "id": "rel-ue-1", "name": "Presale", "qty": 1200, "startMode": "now", "startAt": "", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }, { "id": "rel-ue-2", "name": "General on-sale", "qty": 1600, "startMode": "after_stockout", "startAt": "", "afterReleaseId": "rel-ue-1", "delayDays": 0, "endAt": "", "released": true, "paused": false }, { "id": "rel-ue-3", "name": "Final release", "qty": 784, "startMode": "date", "startAt": "2026-09-11T10:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false } ] }
    ],
    "ticketSold": {
      "tk-ringside-vip": 214, "tk-ringside": 519, "tk-floor": 497,
      "tk-lower-side": 2130, "tk-lower-end": 1980,
      "tk-club-side": 1302, "tk-club-end": 1218,
      "tk-upper-side": 1725, "tk-upper-end": 1720
    },
    "releaseSoldOutAt": { "rel-ue-1": "2026-08-21T18:04:00.000Z" },
    "attached": { "discount": ["7b012026-0912-4a10-9c02-000000000001", "7b012026-0912-4a10-9c02-000000000002"] },
    "seating": {
      "seatMapId": "7b012026-0912-4a10-9c00-000000000002",
      "mode": "type-first",
      "holdMinutes": 10,
      "sectionTiers": {
        "7b012026-0912-4a10-9c01-000000000001": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000002": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000003": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000004": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000005": "tk-ringside-vip",
        "7b012026-0912-4a10-9c01-000000000006": "tk-ringside-vip",
        "7b012026-0912-4a10-9c01-000000000007": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000008": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000009": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000010": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000011": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000012": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000013": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000014": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000015": "tk-ringside-vip",
        "7b012026-0912-4a10-9c01-000000000016": "tk-ringside-vip",
        "7b012026-0912-4a10-9c01-000000000017": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000018": "tk-ringside",
        "7b012026-0912-4a10-9c01-000000000019": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000020": "tk-floor",
        "7b012026-0912-4a10-9c01-000000000021": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000022": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000023": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000024": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000025": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000026": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000027": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000028": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000029": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000030": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000031": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000032": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000033": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000034": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000035": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000036": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000037": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000038": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000039": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000040": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000041": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000042": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000043": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000044": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000045": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000046": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000047": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000048": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000049": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000050": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000051": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000052": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000053": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000054": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000055": "tk-lower-side",
        "7b012026-0912-4a10-9c01-000000000056": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000057": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000058": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000059": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000060": "tk-lower-end",
        "7b012026-0912-4a10-9c01-000000000061": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000062": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000063": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000064": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000065": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000066": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000067": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000068": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000069": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000070": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000071": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000072": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000073": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000074": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000075": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000076": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000077": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000078": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000079": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000080": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000081": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000082": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000083": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000084": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000085": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000086": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000087": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000088": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000089": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000090": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000091": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000092": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000093": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000094": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000095": "tk-club-side",
        "7b012026-0912-4a10-9c01-000000000096": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000097": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000098": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000099": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000100": "tk-club-end",
        "7b012026-0912-4a10-9c01-000000000101": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000102": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000103": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000104": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000105": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000106": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000107": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000108": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000109": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000110": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000111": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000112": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000113": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000114": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000115": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000116": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000117": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000118": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000119": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000120": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000121": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000122": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000123": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000124": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000125": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000126": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000127": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000128": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000129": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000130": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000131": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000132": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000133": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000134": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000135": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000136": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000137": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000138": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000139": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000140": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000141": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000142": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000143": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000144": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000145": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000146": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000147": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000148": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000149": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000150": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000151": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000152": "tk-upper-side",
        "7b012026-0912-4a10-9c01-000000000153": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000154": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000155": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000156": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000157": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000158": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000159": "tk-upper-end",
        "7b012026-0912-4a10-9c01-000000000160": "tk-upper-end"
      }
    },
    "ticketRules": {
      "earlybird": true,
      "donation": true,
      "accessCode": true,
      "reservedSeating": true,
      "groupPurchase": true,
      "bundles": true,
      "releases": true
    },
    "earlybird": {
      "mode": "flat",
      "amount": 50,
      "percent": 0,
      "startAt": "2026-04-01T10:00",
      "endAt": "2026-09-11T23:59",
      "note": "Advance purchase: $50 off every seat until the night before the fight. The saving disappears on the day."
    },
    "donation": {
      "cause": "Nevada amateur boxing",
      "suggestedAmounts": [5, 10, 25, 50],
      "allowCustom": true,
      "minAmount": 1,
      "prompt": "Every ticket to a Nevada fight card already carries $1 for the amateur programme. Add to it if you want to — it funds gym time, headguards and travel for kids who will never buy a seat in this building.",
      "required": false
    },
    "accessCodes": [
      { "id": "ac1", "code": "CHAMPIONSCLUB", "label": "Ringside Champions Club release", "ticketIds": ["tk-ringside-vip"] }
    ],
    "reserved": {
      "tk-ringside-vip": { "qty": 40, "note": "Promoter, sanctioning body and broadcast" },
      "tk-ringside": { "qty": 60, "note": "Fighter allocation, both camps" },
      "tk-lower-side": { "qty": 120, "note": "Sponsor allocation" },
      "tk-upper-end": { "qty": 200, "note": "Community and gym allocation, released on the day" }
    },
    "groupPurchase": {
      "minSeats": 6,
      "maxSeats": 40,
      "discountPercent": 8,
      "requireApproval": false,
      "eligibleTickets": ["tk-lower-side", "tk-lower-end", "tk-club-side", "tk-club-end", "tk-upper-side", "tk-upper-end"]
    },
    "bundles": [
      { "id": "bn-pair-lower", "name": "Lower Bowl pair", "description": "Two sideline seats in the lower bowl, side by side. $160 less than buying them separately.", "enabled": true, "pricingMode": "fixed", "price": 1550, "items": [ { "ticketId": "tk-lower-side", "qty": 2 } ] },
      { "id": "bn-four-upper", "name": "Upper Bowl four", "description": "Four together behind the corner. Bring the group, keep the change.", "enabled": true, "pricingMode": "fixed", "price": 520, "items": [ { "ticketId": "tk-upper-end", "qty": 4 } ] },
      { "id": "bn-club-pair", "name": "Club Level pair + programme", "description": "Two sideline club seats with the official programme included.", "enabled": true, "pricingMode": "fixed", "price": 860, "items": [ { "ticketId": "tk-club-side", "qty": 2 } ] }
    ],
    "purchasables": [
      { "id": "pu-programme", "name": "Official fight programme", "description": "The full card, the tale of the tape, and the night's officials. Collected at your gate.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/1920px-Set-up_of_a_boxing_Ring.jpg", "price": 25, "priceType": "flat", "pickType": "toggle", "required": false, "stock": null, "maxPerOrder": null, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-shirt", "name": "Event T-shirt", "description": "Printed for the night, not restocked afterwards. Sizes are chosen at the merchandise stand on arrival.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg", "price": 45, "priceType": "flat", "pickType": "quantity", "required": false, "stock": 2000, "maxPerOrder": 4, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-parking", "name": "Pre-paid parking — New York-New York garage", "description": "Guaranteed space in the closest garage to the gates, valid from 11:00. The garages fill about three hours before the first bell.", "image": "", "price": 60, "priceType": "flat", "pickType": "toggle", "required": false, "stock": 900, "maxPerOrder": 1, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": 24, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-weighin", "name": "Weigh-in ceremony — Friday 11 September", "description": "Free entry to the public weigh-in at the Park MGM theatre, 15:00 Friday. Ticket holders only, capacity limited.", "image": "", "price": 0, "priceType": "flat", "pickType": "toggle", "required": false, "stock": 1500, "maxPerOrder": 2, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-hospitality", "name": "Pre-fight hospitality at Beerhaus", "description": "Two hours of food and drink in The Park from 12:00, then straight through your own gate. Floor tickets only.", "image": "", "price": 180, "priceType": "flat", "pickType": "toggle", "required": false, "stock": 240, "maxPerOrder": 4, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": ["tk-ringside-vip", "tk-ringside", "tk-floor"], "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": 48, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-photo", "name": "Digital photo pack", "description": "Twelve licensed images from the night, delivered the following Monday.", "image": "", "price": 30, "priceType": "flat", "pickType": "toggle", "required": false, "stock": null, "maxPerOrder": 1, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } }
    ],
    "ticketSelection": {
      "enabled": true,
      "mode": "seats",
      "seatsLabel": "Pick your seat on the arena plan",
      "priceLabel": "Browse by price band",
      "features": ["plan", "insurance", "digital"],
      "autoAssignNote": "Choose a price band, then choose the exact chair. Your selection is held for ten minutes while you check out and released automatically if you do not finish — so a seat you can see is a seat you can have.",
      "soldOutNote": "This band is sold out. Returns and expired holds go back on sale here first, and the final upper-bowl release opens on 11 September."
    },
    "regSettings": { "showRemaining": true },
    "questions": [
      { "id": "q1", "label": "Who are you supporting? (for the seating team — we try not to split camps)" },
      { "id": "q2", "label": "Accessible seating or companion seat required" },
      { "id": "q3", "label": "Name for the programme collection list, if different from the booker" },
      { "id": "q4", "label": "Emergency contact number" }
    ],
    "guidelines": [
      { "id": "gl1", "category": "accessibility", "label": "Accessible seating on all four tiers", "detail": "Wheelchair spaces with a companion seat alongside sit on the floor, the lower bowl, the club level and the upper bowl. Select them on the arena plan when you book rather than asking to convert a standard seat on the night." },
      { "id": "gl2", "category": "accessibility", "label": "Step-free from every accessible drop-off", "detail": "Dedicated accessible drop-off on Frank Sinatra Drive with a step-free route to all gates. Buggy transfer from the garages is available on request at least 24 hours ahead." },
      { "id": "gl3", "category": "accessibility", "label": "Assistive listening and a quiet room", "detail": "Free receivers at every guest services desk, no deposit, working anywhere in the bowl. A quiet sensory room sits off the main concourse and is open from doors to the final bell." },
      { "id": "gl4", "category": "dietary", "label": "Every concourse carries a full allergen sheet", "detail": "Vegetarian, vegan, gluten-free and halal options are stocked on all four concourses. Ask at the stand for the sheet — kitchens are nut-aware but not nut-free." },
      { "id": "gl5", "category": "dietary", "label": "Hospitality caters to requirement, with notice", "detail": "The Beerhaus pre-fight package plates to any dietary requirement given at least 14 days before the event. Tell us in your booking questions." },
      { "id": "gl6", "category": "safety", "label": "Clear-bag policy, no bag check", "detail": "One clear bag up to 12 x 6 x 12 inches or a clutch up to 4.5 x 6.5 inches. Anything refused has to go back to your room — there is nowhere on site to leave it." }
    ],
    "organizerAvatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg",
    "team": [
      { "name": "Zuffa Boxing", "role": "Promoter" },
      { "name": "T-Mobile Arena", "role": "Venue" },
      { "name": "World Boxing Council", "role": "Sanctioning body" },
      { "name": "Nevada State Athletic Commission", "role": "Regulator" }
    ],
    "languages": [
      { "name": "English", "isDefault": true },
      { "name": "Español" }
    ],
    "tags": ["Championship boxing", "WBC welterweight title", "Nine fights", "Reserved seating"],
    "galleryDisplay": { "layout": "carousel", "slidesPerView": 3, "autoplay": true, "autoplaySeconds": 5, "loop": true, "arrows": true, "dots": true },
    "sectionNotes": [
      { "id": "n1", "target": "schedule", "enabled": true, "text": "Only the main card start (17:00 PT) is fixed — it is set by the broadcast. Everything below it moves with the length of the fights ahead of it, so treat the prelim times as indicative and get there early if there is a bout you want to see." },
      { "id": "n2", "target": "register", "enabled": true, "text": "Prices are per seat and include Nevada's $1 amateur boxing levy. Choose a band, then choose the exact chair — your seats are held for ten minutes while you check out." },
      { "id": "n3", "target": "guests", "enabled": true, "text": "All eighteen fighters across all nine bouts, records as reported at the card announcement. Fighters shown by nationality: no portrait on this page is licensed for reuse, so we use flags rather than borrow one." },
      { "id": "n4", "target": "guidelines", "enabled": true, "text": "Accessibility and dietary requirements need to reach us at least 14 days ahead so the access and hospitality teams can plan around them." }
    ],
    "ctas": {
      "primaryLabel": "Choose your seat",
      "items": [
        { "id": "cta-packages", "label": "VIP packages & hospitality", "url": "/e/9a4c2026-0912-4b12-9e00-000000000001/packages", "style": "primary" },
        { "id": "cta-card", "label": "See the full card", "url": "#sec-schedule", "style": "outline" },
        { "id": "cta-access", "label": "Accessible seating enquiries", "url": "mailto:access@zuffaboxing.example", "style": "ghost" }
      ]
    },
    "disclaimer": {
      "enabled": true,
      "text": "This is a demonstration event page built on Geiger Events. Zuffa Boxing, WBC, The Ring and T-Mobile Arena are the marks of their respective owners; this page is not affiliated with, endorsed by or sponsored by any of them. The card, records, venue and running order are as publicly reported at the time of writing and may change. Ticket prices, sales figures and seat availability are illustrative and no transaction here is real.",
      "placements": ["hero", "above-footer"]
    },
    "infographics": [
      {
        "id": "ig-bands",
        "type": "showcase",
        "props": {
          "title": "Four tiers, eight ways to watch it",
          "titleAlign": "left",
          "layoutMode": "grid",
          "columns": "2",
          "showOne": false,
          "clickOpen": true,
          "items": [
            { "title": "Floor — Ringside", "text": "Twenty sections on the arena floor, wrapped tight around the ring. The sides are ringside proper; the ends are Floor.", "image": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg", "textSide": "top", "ctaLabel": "Choose a floor seat", "ctaUrl": "#tickets", "details": "1,680 chairs, seven rows deep, sold in three bands: the Champions Club block in the four centre-side sections, Ringside along the rest of the sides, and Floor behind the corners. This is where the corner work is audible and the cards are handed up in front of you." },
            { "title": "Lower Bowl", "text": "First tier above the floor. Ten rows, forty sections, the best value view of a full twelve-round fight in the building.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg", "textSide": "top", "ctaLabel": "Choose a lower bowl seat", "ctaUrl": "#tickets", "details": "6,000 seats across sideline and end sections. High enough to read the whole ring, close enough to see a shot land. If you are buying one seat and want to actually watch the boxing, buy here." },
            { "title": "Club Level", "text": "Second tier, seven rows, with in-seat service and its own concourse.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/T-Mobile_Arena_Outside.jpg/1920px-T-Mobile_Arena_Outside.jpg", "textSide": "top", "ctaLabel": "Choose a club seat", "ctaUrl": "#tickets", "details": "4,200 seats. Shorter queues, table service to the row, and a bar that is not four deep between rounds. The compromise level: bowl prices, floor comfort." },
            { "title": "Upper Bowl", "text": "Top tier, sixty sections, and the loudest part of the arena all night.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798877122%29.jpg/1920px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798877122%29.jpg", "textSide": "top", "ctaLabel": "Choose an upper bowl seat", "ctaUrl": "#tickets", "details": "6,720 seats from $155. Every one of them sees the whole ring and the big screen hangs directly opposite. Released in waves — a presale, a general on-sale, and a final release on 11 September." }
          ]
        }
      },
      {
        "id": "ig-tape",
        "type": "showcase",
        "props": {
          "title": "Tale of the tape",
          "titleAlign": "left",
          "layoutMode": "grid",
          "columns": "2",
          "showOne": false,
          "clickOpen": true,
          "items": [
            { "title": "Main event — Garcia vs Benn", "text": "WBC welterweight world title, 12 rounds. The champion's first defence against a first-time challenger.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg", "textSide": "top", "ctaLabel": "Meet the fighters", "ctaUrl": "#sec-guests", "details": "Ryan Garcia: 25-2 (20 KOs), United States, orthodox. Won this belt in this building in February, taking a wide decision off Mario Barrios. Conor Benn: 25-1 (14 KOs), England, orthodox. Boxing for a world title for the first time, off a decisive win over Regis Prograis. Champion: 80% KO rate against challenger 56%. Twelve rounds, one belt." },
            { "title": "Co-main — Opetaia vs Mikaelian", "text": "Zuffa Boxing and Ring cruiserweight titles, 12 rounds. 30-0 against 28-3, straight before the main event.", "image": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg", "textSide": "top", "ctaLabel": "Meet the fighters", "ctaUrl": "#sec-guests", "details": "Jai Opetaia: 30-0, Australia, southpaw. Unbeaten in thirty, defending both the Zuffa Boxing and Ring cruiserweight titles. Noel Mikaelian: 28-3, Germany. A decade beating people he was not supposed to beat — all three losses to top-ten opposition, none of them easy. Youth and zeroes against road-tested experience." }
          ]
        }
      },
      {
        "id": "ig-split",
        "type": "split",
        "props": {
          "title": "How the seat picker works",
          "titleAlign": "left",
          "text": "Choose your price band, then choose your chair.\n\nThe arena plan shows all 18,600 seats coloured by what they cost, with sold and held seats greyed out in real time. Click the ones you want — the system holds them for ten minutes while you finish, and hands them back automatically if you walk away.\n\nAccessible spaces and their companion seats are marked on the plan and sell as a pair, so a wheelchair space is never separated from the person you came with.",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/1920px-Set-up_of_a_boxing_Ring.jpg",
          "imageSide": "right",
          "ctaLabel": "Open the arena plan",
          "ctaUrl": "#tickets"
        }
      },
      {
        "id": "ig-carousel",
        "type": "carousel",
        "props": {
          "title": "The building",
          "titleAlign": "left",
          "autoplay": true,
          "mode": "row",
          "items": [
            { "title": "T-Mobile Arena", "text": "Opened 2016, behind The Park between New York-New York and Park MGM. Around 20,000 for a concert; 18,600 for a fight.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg/1920px-T_Mobile_Arena_The_Strip_Las_Vegas_%2829798246202%29.jpg", "textSide": "bottom" },
            { "title": "The approach", "text": "The Park's plaza feeds every gate. Beerhaus, Sake Rok and Bruxie are the pre-fight meeting points, all inside three minutes of the doors.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/T-Mobile_Arena_Outside.jpg/1920px-T-Mobile_Arena_Outside.jpg", "textSide": "bottom" },
            { "title": "A Las Vegas ring", "text": "The centre of the floor, set up for a championship fight. This one was the MGM Grand in 2008 — the geometry has not changed.", "image": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg", "textSide": "bottom" },
            { "title": "The Strip on a fight night", "text": "Walk. Anything between the Luxor and the Bellagio is faster on foot than it is in a car once the garages start filling.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/The_Las_Vegas_Strip_at_night_29AUG19.jpg/1920px-The_Las_Vegas_Strip_at_night_29AUG19.jpg", "textSide": "bottom" },
            { "title": "South Strip from above", "text": "The arena sits just off the Boulevard at Tropicana, with four resort garages inside a fifteen-minute walk.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Las_Vegas_Strip_from_Resorts_World_February_2023_HDR_1.jpg/1920px-Las_Vegas_Strip_from_Resorts_World_February_2023_HDR_1.jpg", "textSide": "bottom" },
            { "title": "Gate signage", "text": "Nine gates around the plaza. Your ticket names yours — use it, the queues on the far side are always shorter than they look.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/T_Mobile_Arena_Sign.jpg/1920px-T_Mobile_Arena_Sign.jpg", "textSide": "bottom" }
          ]
        }
      },
      {
        "id": "ig-quotes",
        "type": "quotes",
        "props": {
          "title": "From the last card here",
          "titleAlign": "left",
          "layout": "grid",
          "columns": "3",
          "items": [
            { "quote": "Picked our exact seats off the plan in about a minute. Row four, both together, no lottery, no fees at the end that we had not already seen.", "name": "Lower Bowl ticket holder", "role": "Section 214, February 2026" },
            { "quote": "Upper bowl is the cheapest seat in Las Vegas and the best atmosphere in the building. You see the whole ring and you hear everything.", "name": "Upper Bowl ticket holder", "role": "Section 421, February 2026" },
            { "quote": "Walked from Park MGM in four minutes while everyone who drove was still circling the garage. Do not drive to this arena.", "name": "Club Level ticket holder", "role": "Section 318, February 2026" }
          ]
        }
      },
      {
        "id": "ig-footer",
        "type": "footer",
        "props": {
          "title": "Before you travel",
          "titleAlign": "left",
          "note": "Zuffa Boxing · T-Mobile Arena, 3780 S Las Vegas Blvd, Las Vegas, NV 89109 · Saturday 12 September 2026, doors 13:00 PT. Demonstration page — see the disclaimer above.",
          "items": [
            { "title": "Venue information", "link": "https://www.t-mobilearena.com/" },
            { "title": "Accessible seating", "link": "mailto:access@zuffaboxing.example" },
            { "title": "Group bookings (6+)", "link": "mailto:groups@zuffaboxing.example" },
            { "title": "Box office", "link": "tel:+17026921616" }
          ]
        }
      }
    ],
    "packagesPage": {
      "enabled": true,
      "title": "Garcia vs Benn — VIP",
      "subtitle": "Four ways to spend fight night on the floor.",
      "introHeading": "Closer than a ticket gets you",
      "introBody": "A VIP package is a seat plus the night around it — the walk in, the room before the first bell, the people you meet between fights and the things you take home. Every package below includes a reserved seat in the band named, and every one of them is limited by how many people the room actually holds.",
      "introLinkLabel": "Back to the event",
      "introLinkUrl": "",
      "gridHeading": "VIP Packages",
      "pitchEnabled": true,
      "pitchHeading": "Buying for a company?",
      "pitchBody": "Blocks of eight or more on the floor and club level are handled directly rather than through checkout — including invoicing, name collection, and a hosted arrival. Tell us the size and the budget and we will come back with what the building can actually do.",
      "pitchImage": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/T-Mobile_Arena_in_Las_Vegas.jpg/1920px-T-Mobile_Arena_in_Las_Vegas.jpg",
      "pitchCtaLabel": "Talk to the VIP team",
      "leadsEnabled": true,
      "leadsHeading": "Ask about a package",
      "leadsConsent": "We will use these details only to answer this enquiry about Garcia vs Benn.",
      "leadsRecipient": "vip@zuffaboxing.example"
    },
    "packages": {
      "intro": "Every package includes a reserved seat, and every one is capped by the size of the room it uses.",
      "items": [
        {
          "id": "pkg-champions",
          "name": "Champions Club",
          "tagline": "The four centre-side floor sections, and the room behind them",
          "image": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Boxing_ring%2C_MGM_Grand.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Reserved seat in a centre-side floor section, level with the ring" },
            { "id": "i2", "icon": "hospitality", "text": "Open bar and chef-led dining from 12:00" },
            { "id": "i3", "icon": "access", "text": "Private entrance off Frank Sinatra Drive, no general queue" },
            { "id": "i4", "icon": "gift", "text": "Signed commemorative glove, boxed" },
            { "id": "i5", "icon": "photo", "text": "Ring apron photograph before the first bell" }
          ],
          "details": "The best forty seats in the building, sold as a package rather than a ticket. Access is by invitation code — enter CHAMPIONSCLUB on the event page to unlock the seats themselves.",
          "price": 14500,
          "priceSuffix": "/pp",
          "stock": 40,
          "ctaLabel": "Enquire",
          "mode": "enquire",
          "visible": true
        },
        {
          "id": "pkg-ringside",
          "name": "Ringside Package",
          "tagline": "Floor seat, pre-fight hospitality, and the walk in",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Set-up_of_a_boxing_Ring.jpg/1920px-Set-up_of_a_boxing_Ring.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Reserved ringside seat along one of the long sides" },
            { "id": "i2", "icon": "hospitality", "text": "Two hours of food and drink at Beerhaus from 12:00" },
            { "id": "i3", "icon": "ticket", "text": "Official programme and lanyard credential" },
            { "id": "i4", "icon": "access", "text": "Priority gate, opening thirty minutes before general doors" }
          ],
          "details": "The floor without the invitation code. Seats are assigned from the best available ringside inventory at the time of booking.",
          "price": 5900,
          "priceSuffix": "/pp",
          "stock": 120,
          "ctaLabel": "Buy package",
          "mode": "buy",
          "visible": true
        },
        {
          "id": "pkg-club",
          "name": "Club Level Package",
          "tagline": "Sideline club seat with the concourse to yourself",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/T-Mobile_Arena_Outside.jpg/1920px-T-Mobile_Arena_Outside.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Reserved sideline seat on the club level" },
            { "id": "i2", "icon": "hospitality", "text": "In-seat service all night, no queueing between rounds" },
            { "id": "i3", "icon": "location", "text": "Club concourse access from doors" },
            { "id": "i4", "icon": "gift", "text": "Official programme" }
          ],
          "details": "The comfortable middle. Club concourse, table service to the row, and a view that reads the whole ring.",
          "price": 650,
          "priceSuffix": "/pp",
          "stock": 300,
          "ctaLabel": "Buy package",
          "mode": "buy",
          "visible": true
        },
        {
          "id": "pkg-weekend",
          "name": "Fight Week Weekend",
          "tagline": "Weigh-in, open workouts and a lower bowl seat",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/The_Las_Vegas_Strip_at_night_29AUG19.jpg/1920px-The_Las_Vegas_Strip_at_night_29AUG19.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Reserved sideline seat in the lower bowl" },
            { "id": "i2", "icon": "access", "text": "Reserved seating at Friday's public weigh-in" },
            { "id": "i3", "icon": "star", "text": "Wednesday open workouts, both camps" },
            { "id": "i4", "icon": "gift", "text": "Event T-shirt and programme" }
          ],
          "details": "Three days rather than one. Everything Fight Week does in public, with a seat waiting for you at each of them.",
          "price": 1150,
          "priceSuffix": "/pp",
          "stock": 200,
          "ctaLabel": "Buy package",
          "mode": "buy",
          "visible": true
        }
      ]
    },
    "pageDesign": {
      "mode": "themed",
      "accent": "amber",
      "cover": "accent",
      "font": "sans",
      "showGallery": true,
      "viewerMode": "dark",
      "theme": {
        "base": "dark",
        "colors": {
          "brand": "#D4A62A",
          "brandText": "#0A0A0C",
          "accent": "#E11D2E",
          "link": "#D4A62A",
          "brandHover": "#E8BC44",
          "brandTo": "#8A6410",
          "bg": "#08080A",
          "surface": "#131316",
          "text": "#F5F5F7",
          "muted": "#9B9BA4",
          "border": "#26262C"
        },
        "font": { "heading": "grotesk", "body": "sans", "scale": "md", "headingFamily": "", "bodyFamily": "", "webfonts": [], "faces": [] },
        "logo": { "url": "", "height": 26, "link": "", "showBar": true, "showInFooter": true },
        "footerLogo": { "url": "", "height": 24, "link": "" },
        "source": { "url": "https://www.t-mobilearena.com/", "siteName": "T-Mobile Arena", "importedAt": "" },
        "header": {
          "show": true,
          "links": [
            { "label": "The fight", "url": "#sec-top" },
            { "label": "The card", "url": "#sec-schedule" },
            { "label": "Fighters", "url": "#sec-guests" },
            { "label": "Getting there", "url": "#sec-location" },
            { "label": "FAQ", "url": "#sec-faq" }
          ],
          "cta": { "label": "Choose your seat", "url": "#tickets" },
          "align": "split",
          "sticky": true,
          "background": "#08080A",
          "border": true,
          "navUpper": true,
          "navTracking": 0.08,
          "navWeight": "600",
          "navSize": 12
        },
        "headingWeight": "black",
        "headingUpper": true,
        "headingTracking": -0.02,
        "headingLineHeight": 1.05,
        "bodyWeight": "",
        "radius": "sharp",
        "radiusPx": 2,
        "button": "solid",
        "buttonRadiusPx": 2,
        "buttonUpper": true,
        "buttonWeight": "700",
        "buttonTracking": 0.06,
        "borderWidth": 1,
        "elevation": "lifted",
        "width": "wide",
        "density": "spacious",
        "layout": "boxoffice",
        "hero": "banner",
        "coverOverlay": "scrim",
        "sidebar": "right",
        "background": {
          "type": "image",
          "value": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/The_Las_Vegas_Strip_at_night_29AUG19.jpg/1920px-The_Las_Vegas_Strip_at_night_29AUG19.jpg",
          "overlay": "base",
          "dim": 92
        },
        "footerStyle": { "background": "#050506", "text": "#E7E7EA" },
        "favicon": "",
        "tagline": "Twelve rounds for the WBC welterweight title. T-Mobile Arena, Las Vegas — Mexican Independence Day weekend.",
        "themeColor": "#08080A"
      },
      "blocks": [
        { "id": "about", "type": "about", "visible": true, "props": {} },
        { "id": "expect", "type": "expect", "visible": true, "props": {} },
        { "id": "schedule", "type": "schedule", "visible": true, "props": {} },
        { "id": "guests", "type": "guests", "visible": true, "props": {} },
        { "id": "location", "type": "location", "visible": true, "props": {} },
        { "id": "whosgoing", "type": "whosgoing", "visible": true, "props": {} },
        { "id": "faq", "type": "faq", "visible": true, "props": {} }
      ],
      "sidebarBlocks": [
        { "id": "register", "type": "register", "visible": true, "props": {} },
        { "id": "goodtoknow", "type": "goodtoknow", "visible": true, "props": {} },
        { "id": "atregistration", "type": "atregistration", "visible": true, "props": {} },
        { "id": "guidelines", "type": "guidelines", "visible": true, "props": {} }
      ],
      "footer": {
        "showBranding": true,
        "text": "Garcia vs Benn · WBC Welterweight World Championship · T-Mobile Arena, Las Vegas · Saturday 12 September 2026",
        "links": [
          { "label": "Tickets", "url": "#tickets" },
          { "label": "The card", "url": "#sec-schedule" },
          { "label": "Getting there", "url": "#sec-location" },
          { "label": "Accessibility", "url": "mailto:access@zuffaboxing.example" }
        ],
        "socials": [
          { "platform": "website", "url": "https://www.t-mobilearena.com/" },
          { "platform": "email", "url": "mailto:boxoffice@t-mobilearena.example" }
        ]
      }
    }
  }$meta$::jsonb
)
on conflict (id) do update set
  project_id  = excluded.project_id,
  venue_id    = excluded.venue_id,
  name        = excluded.name,
  status      = excluded.status,
  type        = excluded.type,
  event_date  = excluded.event_date,
  event_time  = excluded.event_time,
  timezone    = excluded.timezone,
  venue       = excluded.venue,
  address     = excluded.address,
  city        = excluded.city,
  capacity    = excluded.capacity,
  sold        = excluded.sold,
  revenue     = excluded.revenue,
  visibility  = excluded.visibility,
  organizer   = excluded.organizer,
  summary     = excluded.summary,
  cover_url   = excluded.cover_url,
  gallery     = excluded.gallery,
  is_listable = excluded.is_listable,
  metadata    = excluded.metadata,
  deleted_at  = null;
