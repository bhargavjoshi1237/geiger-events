-- Demo event: UFC 333 — Volkanovski vs Evloev, Etihad Arena, Abu Dhabi, Saturday 24 October 2026.
-- The card, records, ranks, quotes, schedule, venue and entry rules are as publicly reported on 22 October 2026; sold/revenue and package prices are invented.
-- Ticket prices are the 17 August face values (AED 495–14,595) in US dollars at the 3.6725 peg, because the storefront prints "$".
-- The seat map follows the official UFC 2026 Etihad Arena plan: floor blocks A–C and E–G, lower bowl 101–116 in two banks, upper tier 301–332.
-- Images are Wikimedia Commons, every URL HEAD-checked 200; fighters are shown by flag because none of their portraits is licensed for reuse.
-- Run `npm run db:seed ufc-333`, then `node scripts/seed-event-seats.mjs c3332026-1024-4b33-9e00-000000000001` to generate the 13,568 chairs.

-- 1 · The venue
insert into events.venues (
  id, project_id, name, type, status, description,
  address, city, region, postcode, country, timezone, latitude, longitude,
  parking_notes, transit_notes,
  seated_capacity, standing_capacity, spaces, amenities,
  contact_name, contact_email, contact_phone, website,
  cover_url, gallery, metadata
) values (
  'e7112026-1024-4a33-9c00-000000000001',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'Etihad Arena',
  'Indoor',
  'Active',
  $vdesc$Abu Dhabi's arena on the water. Built on Yas Bay Waterfront to a design by HOK, owned by Miral and run by Ethara, Etihad Arena opened in January 2021 with a UFC card and has been the home of the promotion's Abu Dhabi nights ever since — UFC 333 is its twelfth. It holds 18,000 at full stretch and a little over 13,600 seated: the shape it takes for the Octagon, with six floor blocks, a two-bank lower bowl, an upper tier, six hospitality loges and a ring of seventeen suites.$vdesc$,
  'Yas Bay Waterfront, Yas Island',
  'Abu Dhabi',
  'Abu Dhabi',
  '',
  'United Arab Emirates',
  'Asia/Dubai',
  24.460300,
  54.604000,
  $vpark$Parking is allocated by ticket category. P1-A (suites and Categories 1–2) and P1-B (Categories 3–4) sit beside the arena; everyone else parks in P2, the twofour54 lot, C37, Lifestyle or the multi-storey, all within about a ten-minute walk. The underground car park connects straight into the arena and the Hilton Abu Dhabi Yas Island; the outdoor waterfront lots are about seven minutes on foot.$vpark$,
  $vtran$Zayed International Airport (AUH) is about seven minutes by road and central Abu Dhabi about twenty-five. From Dubai it is roughly 113 km on the E11 — around an hour and ten minutes in free-flowing traffic, with Salik tolls — or Etihad Rail from Al Yalayis to Mohamed Bin Zayed City and a taxi for the last leg. The free Yas Express shuttle calls at the Hilton Yas Island, a few minutes' walk from the gates. Public buses need a Nol card and may stop running before the main event ends, so plan the trip home.$vtran$,
  13600,
  4400,
  1,
  $amen$["Contactless payment only","Underground parking linked to the arena","Hospitality suites and loges","Aldar Club lounge","Licensed bars (21+)","Wheelchair seating","Stroller parks","Digital tickets in the Yas Island app"]$amen$::jsonb,
  'Etihad Arena Box Office',
  'boxoffice@etihadarena.example',
  '600 511 115',
  'https://www.etihadarena.ae/',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg',
  $vgal$["https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg/1920px-Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/3/31/Yas_Marina.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Yas_Marina_circuit_by_night.jpg/1920px-Yas_Marina_circuit_by_night.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Yas_Mall_Front.jpg/1920px-Yas_Mall_Front.jpg"]$vgal$::jsonb,
  $vmeta${
    "guidelines": [
      { "id": "vg1", "category": "accessibility", "label": "Wheelchair seating, booked by phone", "detail": "Wheelchair spaces must be purchased like any other seat; the box office books them on 600 511 115. Strollers stay in the stroller parks." },
      { "id": "vg2", "category": "safety", "label": "Bags up to 30 × 30 × 15 cm", "detail": "There is no cloakroom or bag storage on site, so anything larger goes back to the car or the hotel." },
      { "id": "vg3", "category": "safety", "label": "One entry, no flags", "detail": "There is no re-entry, and flags of any kind — including national flags — are refused at the gate." }
    ],
    "hospitality": {
      "suites": "201–217",
      "loges": ["101", "105", "106-A", "106-B", "108", "115"],
      "club": "Aldar Club, central lower bowl"
    },
    "capacity": { "full": 18000, "seated": 13600, "ufc": "13,220 at UFC 321; 13,400 at UFC 280" }
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

-- 2 · The seat map: the fight configuration, with the Octagon as the centre feature
insert into events.seat_maps (id, project_id, venue_id, name, status, config, metadata)
values (
  'e7112026-1024-4a33-9c00-000000000002',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'e7112026-1024-4a33-9c00-000000000001',
  'UFC fight night — Octagon',
  'Active',
  $cfg${
    "aspect": "16/10",
    "field": {
      "shape": "ring",
      "x": 44.69,
      "y": 47.5,
      "width": 10.63,
      "height": 17,
      "rotation": 0,
      "label": "The Octagon"
    }
  }$cfg$::jsonb,
  $smeta${
    "generatedBy": "lib/seating/bowl.js",
    "bowl": { "shape": "horseshoe", "tiers": 3, "perSide": 4, "gap": 1.6, "tierDepth": 8.5, "mirrored": true },
    "floor": "Blocks A–C and E–G placed by hand, each split into cageside rows A–E and rear rows F–L",
    "source": "Official UFC 2026 Etihad Arena 3D seating plan",
    "tiers": ["Floor", "Lower bowl (front bank A–M, back bank N–Z)", "Upper tier"]
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

-- 3 · 76 sections, frozen so the ids sectionTiers points at never move (sort 0s floor, 1000s/2000s lower banks, 3000s upper)
insert into events.seat_map_sections
  (id, seat_map_id, name, kind, x, y, width, height, rotation, layout, capacity, sort_order)
select v.id::uuid, 'e7112026-1024-4a33-9c00-000000000002'::uuid, v.name, v.kind,
       v.x, v.y, v.width, v.height, v.rotation, v.layout, v.capacity, v.sort_order
from (values
  ('e7112026-1024-4a33-9c01-000000000001', 'A', 'seated', 37.81, 45.04, 7.50, 3.00, 162.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 0),
  ('e7112026-1024-4a33-9c01-000000000002', 'A', 'seated', 37.04, 40.74, 7.50, 4.00, 162.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1),
  ('e7112026-1024-4a33-9c01-000000000003', 'B', 'seated', 46.25, 43.30, 7.50, 3.00, 180.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2),
  ('e7112026-1024-4a33-9c01-000000000004', 'B', 'seated', 46.25, 38.80, 7.50, 4.00, 180.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3),
  ('e7112026-1024-4a33-9c01-000000000005', 'C', 'seated', 54.69, 45.04, 7.50, 3.00, 198.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 4),
  ('e7112026-1024-4a33-9c01-000000000006', 'C', 'seated', 55.46, 40.74, 7.50, 4.00, 198.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 5),
  ('e7112026-1024-4a33-9c01-000000000007', 'G', 'seated', 37.81, 63.96, 7.50, 3.00, 18.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 6),
  ('e7112026-1024-4a33-9c01-000000000008', 'G', 'seated', 37.04, 67.26, 7.50, 4.00, 18.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 7),
  ('e7112026-1024-4a33-9c01-000000000009', 'F', 'seated', 46.25, 65.70, 7.50, 3.00, 0.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 8),
  ('e7112026-1024-4a33-9c01-000000000010', 'F', 'seated', 46.25, 69.20, 7.50, 4.00, 0.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 9),
  ('e7112026-1024-4a33-9c01-000000000011', 'E', 'seated', 54.69, 63.96, 7.50, 3.00, 342.00, '{"rows":5,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 10),
  ('e7112026-1024-4a33-9c01-000000000012', 'E', 'seated', 55.46, 67.26, 7.50, 4.00, 342.00, '{"rows":7,"seatsPerRow":24,"rowLabels":"alpha","rowLabelStart":"F","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 11),
  ('e7112026-1024-4a33-9c01-000000000013', '101', 'seated', 67.26, 65.18, 3.81, 7.45, 294.59, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1000),
  ('e7112026-1024-4a33-9c01-000000000014', '102', 'seated', 68.81, 56.87, 3.81, 7.45, 278.57, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1001),
  ('e7112026-1024-4a33-9c01-000000000015', '103', 'seated', 68.86, 48.19, 3.81, 7.45, 262.38, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1002),
  ('e7112026-1024-4a33-9c01-000000000016', '104', 'seated', 67.39, 39.84, 3.81, 7.45, 246.34, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1003),
  ('e7112026-1024-4a33-9c01-000000000017', '105', 'seated', 64.57, 32.46, 3.81, 7.46, 230.74, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1004),
  ('e7112026-1024-4a33-9c01-000000000018', '106', 'seated', 60.65, 26.58, 3.81, 7.46, 215.70, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1005),
  ('e7112026-1024-4a33-9c01-000000000019', '107', 'seated', 55.94, 22.50, 3.82, 7.46, 201.18, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1006),
  ('e7112026-1024-4a33-9c01-000000000020', '108', 'seated', 50.76, 20.41, 3.82, 7.47, 187.02, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1007),
  ('e7112026-1024-4a33-9c01-000000000021', '109', 'seated', 45.42, 20.41, 3.82, 7.47, 172.98, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1008),
  ('e7112026-1024-4a33-9c01-000000000022', '110', 'seated', 40.24, 22.50, 3.82, 7.46, 158.82, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1009),
  ('e7112026-1024-4a33-9c01-000000000023', '111', 'seated', 35.53, 26.58, 3.81, 7.46, 144.30, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1010),
  ('e7112026-1024-4a33-9c01-000000000024', '112', 'seated', 31.61, 32.46, 3.81, 7.46, 129.26, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1011),
  ('e7112026-1024-4a33-9c01-000000000025', '113', 'seated', 28.79, 39.84, 3.81, 7.45, 113.66, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1012),
  ('e7112026-1024-4a33-9c01-000000000026', '114', 'seated', 27.33, 48.19, 3.81, 7.45, 97.62, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1013),
  ('e7112026-1024-4a33-9c01-000000000027', '115', 'seated', 27.38, 56.87, 3.81, 7.45, 81.43, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1014),
  ('e7112026-1024-4a33-9c01-000000000028', '116', 'seated', 28.92, 65.18, 3.81, 7.45, 65.41, '{"rows":13,"seatsPerRow":18,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 1015),
  ('e7112026-1024-4a33-9c01-000000000029', '101', 'seated', 71.88, 68.62, 4.98, 7.41, 294.10, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2000),
  ('e7112026-1024-4a33-9c01-000000000030', '102', 'seated', 73.80, 58.09, 4.97, 7.41, 278.38, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2001),
  ('e7112026-1024-4a33-9c01-000000000031', '103', 'seated', 73.86, 47.13, 4.97, 7.41, 262.55, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2002),
  ('e7112026-1024-4a33-9c01-000000000032', '104', 'seated', 72.04, 36.56, 4.98, 7.41, 246.81, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2003),
  ('e7112026-1024-4a33-9c01-000000000033', '105', 'seated', 68.52, 27.16, 4.99, 7.41, 231.37, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2004),
  ('e7112026-1024-4a33-9c01-000000000034', '106', 'seated', 63.56, 19.57, 5.00, 7.41, 216.32, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2005),
  ('e7112026-1024-4a33-9c01-000000000035', '107', 'seated', 57.56, 14.26, 5.02, 7.41, 201.62, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2006),
  ('e7112026-1024-4a33-9c01-000000000036', '108', 'seated', 50.92, 11.53, 5.03, 7.42, 187.18, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2007),
  ('e7112026-1024-4a33-9c01-000000000037', '109', 'seated', 44.06, 11.53, 5.03, 7.42, 172.82, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2008),
  ('e7112026-1024-4a33-9c01-000000000038', '110', 'seated', 37.42, 14.26, 5.02, 7.41, 158.38, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2009),
  ('e7112026-1024-4a33-9c01-000000000039', '111', 'seated', 31.43, 19.57, 5.00, 7.41, 143.68, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2010),
  ('e7112026-1024-4a33-9c01-000000000040', '112', 'seated', 26.50, 27.16, 4.99, 7.41, 128.63, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2011),
  ('e7112026-1024-4a33-9c01-000000000041', '113', 'seated', 22.98, 36.56, 4.98, 7.41, 113.19, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2012),
  ('e7112026-1024-4a33-9c01-000000000042', '114', 'seated', 21.17, 47.13, 4.97, 7.41, 97.45, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2013),
  ('e7112026-1024-4a33-9c01-000000000043', '115', 'seated', 21.23, 58.09, 4.97, 7.41, 81.62, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2014),
  ('e7112026-1024-4a33-9c01-000000000044', '116', 'seated', 23.14, 68.62, 4.98, 7.41, 65.90, '{"rows":13,"seatsPerRow":22,"rowLabels":"alpha","rowLabelStart":"N","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 2015),
  ('e7112026-1024-4a33-9c01-000000000045', '301', 'seated', 77.17, 75.03, 3.07, 7.53, 297.65, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3000),
  ('e7112026-1024-4a33-9c01-000000000046', '302', 'seated', 78.85, 68.94, 3.08, 7.53, 289.94, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3001),
  ('e7112026-1024-4a33-9c01-000000000047', '303', 'seated', 80.01, 62.54, 3.07, 7.53, 282.16, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3002),
  ('e7112026-1024-4a33-9c01-000000000048', '304', 'seated', 80.60, 55.95, 3.07, 7.53, 274.37, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3003),
  ('e7112026-1024-4a33-9c01-000000000049', '305', 'seated', 80.64, 49.30, 3.07, 7.53, 266.55, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3004),
  ('e7112026-1024-4a33-9c01-000000000050', '306', 'seated', 80.11, 42.70, 3.07, 7.53, 258.75, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3005),
  ('e7112026-1024-4a33-9c01-000000000051', '307', 'seated', 79.01, 36.27, 3.08, 7.53, 250.97, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3006),
  ('e7112026-1024-4a33-9c01-000000000052', '308', 'seated', 77.40, 30.14, 3.07, 7.53, 243.25, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3007),
  ('e7112026-1024-4a33-9c01-000000000053', '309', 'seated', 75.26, 24.39, 3.09, 7.53, 235.58, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3008),
  ('e7112026-1024-4a33-9c01-000000000054', '310', 'seated', 72.69, 19.15, 3.08, 7.53, 227.98, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3009),
  ('e7112026-1024-4a33-9c01-000000000055', '311', 'seated', 69.68, 14.49, 3.11, 7.53, 220.45, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3010),
  ('e7112026-1024-4a33-9c01-000000000056', '312', 'seated', 66.33, 10.49, 3.10, 7.53, 212.98, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3011),
  ('e7112026-1024-4a33-9c01-000000000057', '313', 'seated', 62.67, 7.21, 3.12, 7.53, 205.58, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3012),
  ('e7112026-1024-4a33-9c01-000000000058', '314', 'seated', 58.78, 4.71, 3.11, 7.53, 198.23, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3013),
  ('e7112026-1024-4a33-9c01-000000000059', '315', 'seated', 54.71, 3.02, 3.13, 7.53, 190.92, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3014),
  ('e7112026-1024-4a33-9c01-000000000060', '316', 'seated', 50.54, 2.16, 3.12, 7.53, 183.64, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3015),
  ('e7112026-1024-4a33-9c01-000000000061', '317', 'seated', 46.34, 2.16, 3.12, 7.53, 176.36, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3016),
  ('e7112026-1024-4a33-9c01-000000000062', '318', 'seated', 42.17, 3.02, 3.13, 7.53, 169.08, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3017),
  ('e7112026-1024-4a33-9c01-000000000063', '319', 'seated', 38.11, 4.71, 3.11, 7.53, 161.77, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3018),
  ('e7112026-1024-4a33-9c01-000000000064', '320', 'seated', 34.21, 7.21, 3.12, 7.53, 154.42, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3019),
  ('e7112026-1024-4a33-9c01-000000000065', '321', 'seated', 30.57, 10.49, 3.10, 7.53, 147.02, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3020),
  ('e7112026-1024-4a33-9c01-000000000066', '322', 'seated', 27.21, 14.49, 3.11, 7.53, 139.55, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3021),
  ('e7112026-1024-4a33-9c01-000000000067', '323', 'seated', 24.23, 19.15, 3.08, 7.53, 132.02, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3022),
  ('e7112026-1024-4a33-9c01-000000000068', '324', 'seated', 21.64, 24.39, 3.09, 7.53, 124.42, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3023),
  ('e7112026-1024-4a33-9c01-000000000069', '325', 'seated', 19.53, 30.14, 3.07, 7.53, 116.75, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3024),
  ('e7112026-1024-4a33-9c01-000000000070', '326', 'seated', 17.91, 36.27, 3.08, 7.53, 109.03, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3025),
  ('e7112026-1024-4a33-9c01-000000000071', '327', 'seated', 16.83, 42.70, 3.07, 7.53, 101.25, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3026),
  ('e7112026-1024-4a33-9c01-000000000072', '328', 'seated', 16.29, 49.30, 3.07, 7.53, 93.45, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3027),
  ('e7112026-1024-4a33-9c01-000000000073', '329', 'seated', 16.33, 55.95, 3.07, 7.53, 85.63, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3028),
  ('e7112026-1024-4a33-9c01-000000000074', '330', 'seated', 16.93, 62.54, 3.07, 7.53, 77.84, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3029),
  ('e7112026-1024-4a33-9c01-000000000075', '331', 'seated', 18.07, 68.94, 3.08, 7.53, 70.06, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3030),
  ('e7112026-1024-4a33-9c01-000000000076', '332', 'seated', 19.75, 75.03, 3.07, 7.53, 62.35, '{"rows":10,"seatsPerRow":11,"rowLabels":"alpha","rowLabelStart":"A","numbering":"continental","curve":0,"rake":0,"aisleAfter":[]}'::jsonb, 0, 3031)
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

-- Drop sections a previous run created that this layout no longer has.
delete from events.seat_map_sections
 where seat_map_id = 'e7112026-1024-4a33-9c00-000000000002'
   and id not in ('e7112026-1024-4a33-9c01-000000000001', 'e7112026-1024-4a33-9c01-000000000002', 'e7112026-1024-4a33-9c01-000000000003', 'e7112026-1024-4a33-9c01-000000000004', 'e7112026-1024-4a33-9c01-000000000005', 'e7112026-1024-4a33-9c01-000000000006', 'e7112026-1024-4a33-9c01-000000000007', 'e7112026-1024-4a33-9c01-000000000008', 'e7112026-1024-4a33-9c01-000000000009', 'e7112026-1024-4a33-9c01-000000000010', 'e7112026-1024-4a33-9c01-000000000011', 'e7112026-1024-4a33-9c01-000000000012', 'e7112026-1024-4a33-9c01-000000000013', 'e7112026-1024-4a33-9c01-000000000014', 'e7112026-1024-4a33-9c01-000000000015', 'e7112026-1024-4a33-9c01-000000000016', 'e7112026-1024-4a33-9c01-000000000017', 'e7112026-1024-4a33-9c01-000000000018', 'e7112026-1024-4a33-9c01-000000000019', 'e7112026-1024-4a33-9c01-000000000020', 'e7112026-1024-4a33-9c01-000000000021', 'e7112026-1024-4a33-9c01-000000000022', 'e7112026-1024-4a33-9c01-000000000023', 'e7112026-1024-4a33-9c01-000000000024', 'e7112026-1024-4a33-9c01-000000000025', 'e7112026-1024-4a33-9c01-000000000026', 'e7112026-1024-4a33-9c01-000000000027', 'e7112026-1024-4a33-9c01-000000000028', 'e7112026-1024-4a33-9c01-000000000029', 'e7112026-1024-4a33-9c01-000000000030', 'e7112026-1024-4a33-9c01-000000000031', 'e7112026-1024-4a33-9c01-000000000032', 'e7112026-1024-4a33-9c01-000000000033', 'e7112026-1024-4a33-9c01-000000000034', 'e7112026-1024-4a33-9c01-000000000035', 'e7112026-1024-4a33-9c01-000000000036', 'e7112026-1024-4a33-9c01-000000000037', 'e7112026-1024-4a33-9c01-000000000038', 'e7112026-1024-4a33-9c01-000000000039', 'e7112026-1024-4a33-9c01-000000000040', 'e7112026-1024-4a33-9c01-000000000041', 'e7112026-1024-4a33-9c01-000000000042', 'e7112026-1024-4a33-9c01-000000000043', 'e7112026-1024-4a33-9c01-000000000044', 'e7112026-1024-4a33-9c01-000000000045', 'e7112026-1024-4a33-9c01-000000000046', 'e7112026-1024-4a33-9c01-000000000047', 'e7112026-1024-4a33-9c01-000000000048', 'e7112026-1024-4a33-9c01-000000000049', 'e7112026-1024-4a33-9c01-000000000050', 'e7112026-1024-4a33-9c01-000000000051', 'e7112026-1024-4a33-9c01-000000000052', 'e7112026-1024-4a33-9c01-000000000053', 'e7112026-1024-4a33-9c01-000000000054', 'e7112026-1024-4a33-9c01-000000000055', 'e7112026-1024-4a33-9c01-000000000056', 'e7112026-1024-4a33-9c01-000000000057', 'e7112026-1024-4a33-9c01-000000000058', 'e7112026-1024-4a33-9c01-000000000059', 'e7112026-1024-4a33-9c01-000000000060', 'e7112026-1024-4a33-9c01-000000000061', 'e7112026-1024-4a33-9c01-000000000062', 'e7112026-1024-4a33-9c01-000000000063', 'e7112026-1024-4a33-9c01-000000000064', 'e7112026-1024-4a33-9c01-000000000065', 'e7112026-1024-4a33-9c01-000000000066', 'e7112026-1024-4a33-9c01-000000000067', 'e7112026-1024-4a33-9c01-000000000068', 'e7112026-1024-4a33-9c01-000000000069', 'e7112026-1024-4a33-9c01-000000000070', 'e7112026-1024-4a33-9c01-000000000071', 'e7112026-1024-4a33-9c01-000000000072', 'e7112026-1024-4a33-9c01-000000000073', 'e7112026-1024-4a33-9c01-000000000074', 'e7112026-1024-4a33-9c01-000000000075', 'e7112026-1024-4a33-9c01-000000000076');

-- 4 · The event
insert into events.events (
  id, project_id, venue_id, name, status, type, event_date, event_time, timezone,
  venue, address, city, capacity, sold, revenue, visibility, organizer,
  summary, cover_url, gallery, is_listable, metadata
) values (
  'c3332026-1024-4b33-9e00-000000000001',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'e7112026-1024-4a33-9c00-000000000001',
  'UFC 333: Volkanovski vs Evloev',
  'On Sale',
  'In-person',
  '2026-10-24',
  '18:00',
  'Asia/Dubai',
  'Etihad Arena',
  'Yas Bay Waterfront, Yas Island, Abu Dhabi',
  'Abu Dhabi',
  13568,
  13344,
  9342404,
  'Public',
  'UFC',
  'Alexander Volkanovski defends the featherweight title against the unbeaten Movsar Evloev, and Petr Yan and Merab Dvalishvili settle their bantamweight trilogy — fourteen fights on Yas Island to close Abu Dhabi Showdown Week.',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg',
  $gallery$["https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Yas_Mall_Front.jpg/1920px-Yas_Mall_Front.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Yas_Marina_circuit_by_night.jpg/1920px-Yas_Marina_circuit_by_night.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Abu_Dhabi_Corniche_by_night.jpg/1920px-Abu_Dhabi_Corniche_by_night.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Ferrariworld_by_Flo_Ness.jpg/1920px-Ferrariworld_by_Flo_Ness.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Etihad_Airways_Flyover_-_Yas_Island%2C_Abu_Dhabi_Grand_Prix_%282%29.jpg/1920px-Etihad_Airways_Flyover_-_Yas_Island%2C_Abu_Dhabi_Grand_Prix_%282%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Sheikh_Zayed_Mosque_Silhouette.jpg/1920px-Sheikh_Zayed_Mosque_Silhouette.jpg"]$gallery$::jsonb,
  true,
  $meta${
    "description": "## Five rounds, one belt, and a 20-0 record on the line\n\n**Alexander Volkanovski (28-4)** is 38 years old and featherweight champion for the second time. He won the vacant belt back from Diego Lopes at UFC 314 in April 2025, beat Lopes again in Sydney in February, and on Saturday night on Yas Island he defends it against the man he said should be next more than a year ago.\n\n**Movsar Evloev (20-0)** has never lost. Ten fights in the UFC, ten wins, and a title shot that kept slipping away — a scrapped booking with Ilia Topuria, two cancelled fights with Bryce Mitchell, an injury that cost him his 2025 date with Aaron Pico on this island. He took the long way round instead: through Aljamain Sterling at UFC 310, then a disputed five-round majority decision over Lerone Murphy in London in March. \"I have been waiting seven years since I signed with the UFC for this moment,\" he said this week. \"In my mind, I won this fight 1,000 times.\"\n\nA win for Volkanovski is his ninth UFC featherweight title-fight win — one more than José Aldo, and a division record. \"I just think I'm a bit of a nightmare matchup for him,\" he says, \"but I'm expecting a hard challenge.\" The books cannot split them.\n\n### The co-main: one each, and this one settles it\n\n**Petr Yan (20-5)** defends the bantamweight title against **Merab Dvalishvili (21-5)**. Dvalishvili won the first fight in Las Vegas in March 2023, 50-45 on all three cards. Yan won the rematch at UFC 323 in December, stopping 27 of 29 takedown attempts to take the belt and end a fourteen-fight winning streak. \"First time when I beat him, he was cocky and I made him humble,\" says Dvalishvili. Yan's reply: \"Most important is he himself knows that I humbled him.\"\n\n### Fourteen fights across three cards\n\nDoors at 17:00. Early prelims from 18:00, prelims at 20:00, and the main card at 22:00 Gulf time — 2pm on the US East Coast. On the way to the title fights there is the No. 2 heavyweight in the world, **Alexander Volkov**, who turns 38 on fight night; a flyweight coin flip between **Lone'er Kavanagh** and **Ramazan Temirov**; and **Aaron Pico** against the former Oktagon double champion **Losene Keita**.\n\nIt is the UFC's 24th visit to Abu Dhabi and its 12th at Etihad Arena, the 18,000-capacity room on Yas Bay that sets up for the Octagon at a little over 13,500 seats. Every one of them is a specific chair on the arena plan, and you pick yours yourself.",
    "highlights": [
      { "id": "h1", "title": "Twenty and oh, for the belt", "detail": "Movsar Evloev is 20-0, 10-0 in the UFC, and gets his first title shot seven years after signing." },
      { "id": "h2", "title": "A division record on the line", "detail": "Volkanovski's ninth UFC featherweight title-fight win would take him one past José Aldo — at 38." },
      { "id": "h3", "title": "The trilogy decider", "detail": "Yan vs Dvalishvili III for the bantamweight title. One win each, both by decision, both over five rounds." },
      { "id": "h4", "title": "Fourteen fights, three cards", "detail": "Early prelims 18:00, prelims 20:00, main card 22:00 Gulf time. Two five-round title fights to close." },
      { "id": "h5", "title": "Abu Dhabi Showdown Week", "detail": "Free fan experiences at Yas Mall and Yas Bay, open workouts, the press conference and ceremonial weigh-ins at the arena." },
      { "id": "h6", "title": "Choose your exact seat", "detail": "13,568 seats across eight categories — from cageside blocks A–C and E–G to the top of the upper tier." }
    ],
    "schedule": [
      { "id": "s-fan", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19–25 Oct", "title": "UFC Fan Experience — Yas Mall & Yas Bay", "description": "Free all week. Yas Mall from 10:00 daily (to midnight Friday and Saturday); Yas Bay Waterfront from 16:00 Wednesday to Sunday, running late on fight night. Athlete meet-and-greets, screenings and the Showdown Week fan zone.", "by": "Abu Dhabi Showdown Week", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Yas_Mall_Front.jpg/1920px-Yas_Mall_Front.jpg", "imagePosition": "left", "imageFit": "cover", "sectionNote": "Fight-week events are free and open to the public. Fight-night times are Gulf Standard Time (UTC+4): only the segment starts are fixed by the broadcast — individual bouts move with the length of the fights before them." },
      { "id": "s-workouts", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "Wed 21 Oct · 18:00", "title": "Open workouts — Yas Mall, Town Centre", "description": "Volkanovski, Evloev, Yan and Dvalishvili work out in public. Doors 17:00; meet-and-greet with Kamaru Usman, Jean Silva and Marwan Rahiki at 19:00.", "by": "Abu Dhabi Showdown Week" },
      { "id": "s-presser", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "Thu 22 Oct · 17:00", "title": "Pre-fight press conference — Etihad Arena", "description": "All four title fighters on stage. Free entry, doors 16:00; 9am on the US East Coast.", "by": "Abu Dhabi Showdown Week" },
      { "id": "s-weighin", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "Fri 23 Oct · 18:00", "title": "Ceremonial weigh-ins — Etihad Arena", "description": "Fighters on the scale and the final face-offs, free to the public. Doors 16:00; fan Q&A with Aljamain Sterling and Marwan Rahiki at 17:00. The official weigh-ins are at 08:00 that morning, closed to the public.", "by": "Abu Dhabi Showdown Week" },
      { "id": "s-doors", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Doors open — Saturday 24 October", "description": "All gates. One entry only — there is no re-entry once you are scanned in. The Record Lounge pre-fight hospitality runs 17:00–20:00 for add-on holders.", "by": "Fight night", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s-bout-1", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:00", "title": "Iasmin Lucindo vs Nicolle Caliari", "description": "Women's strawweight, 3 rounds. Lucindo 18-6 (Brazil) vs Caliari 9-4 (Brazil). First fight of the night.", "by": "Early prelims" },
      { "id": "s-bout-2", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:25", "title": "Kody Steele vs Noah Gugnon", "description": "Lightweight, 3 rounds. Steele 8-1 (United States) vs Gugnon 10-2 (France). Gugnon has finished every opponent he has ever beaten.", "by": "Early prelims" },
      { "id": "s-bout-3", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:50", "title": "Bolaji Oki vs Daniel Santos", "description": "Featherweight, 3 rounds. Oki 10-4 (Belgium) vs Santos 14-3 (Brazil). Oki's first UFC fight at featherweight.", "by": "Early prelims" },
      { "id": "s-bout-4", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:15", "title": "Abubakar Vagaev vs Jacob Malkoun", "description": "Middleweight, 3 rounds. Vagaev 25-4 (Russia) vs Malkoun 10-3 (Australia). A two-time ACA champion against an Australian on a three-fight winning streak.", "by": "Early prelims" },
      { "id": "s-bout-5", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:35", "title": "Colby Thicknesse vs Asaf Chopurov", "description": "Bantamweight, 3 rounds. Thicknesse 9-1 (Australia) vs Chopurov 11-0 (Russia). Chopurov's UFC debut, against a man who trains alongside the main-event champion.", "by": "Early prelims" },
      { "id": "s-bout-6", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "20:00", "title": "Grant Dawson vs Nurullo Aliev", "description": "Lightweight, 3 rounds. Dawson 24-3-1 (United States) vs Aliev 12-0 (Tajikistan). Aliev's 12-0 against Dawson's 28 professional fights. Opens the prelims at 20:00.", "by": "Prelims" },
      { "id": "s-bout-7", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "20:30", "title": "Abus Magomedov vs Cam Rowston", "description": "Middleweight, 3 rounds. Magomedov 29-7-1 (Germany, No. 12 middleweight) vs Rowston 15-3 (Australia). Rowston, 3-0 in the UFC, gets his first ranked opponent.", "by": "Prelims" },
      { "id": "s-bout-8", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "21:00", "title": "Nikita Krylov vs Abdul Rakhman Yakhyaev", "description": "Light heavyweight, 3 rounds. Krylov 31-12 (Russia, No. 15 light heavyweight) vs Yakhyaev 10-0 (Türkiye). A 31-win veteran against an unbeaten 25-year-old — and the books make Yakhyaev a heavy favourite.", "by": "Prelims" },
      { "id": "s-bout-9", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "21:30", "title": "Azamat Murzakanov vs Dominick Reyes", "description": "Light heavyweight, 3 rounds. Murzakanov 16-1 (Russia, No. 7 light heavyweight) vs Reyes 16-5 (United States, No. 8 light heavyweight). Both fought at UFC 327 in April: Murzakanov lost for the first time, Reyes won.", "by": "Prelims" },
      { "id": "s-bout-10", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "22:00", "title": "Aaron Pico vs Losene Keita", "description": "Featherweight, 3 rounds. Pico 14-5 (United States, No. 11 featherweight) vs Keita 17-2 (Belgium). Opens the main card at 22:00 Gulf time — 2pm on the US East Coast.", "by": "Main card" },
      { "id": "s-bout-11", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "22:30", "title": "Alexander Volkov vs Rizvan Kuniev", "description": "Heavyweight, 3 rounds. Volkov 40-11 (Russia, No. 2 heavyweight) vs Kuniev 14-3-1 (Russia, No. 7 heavyweight). Both men have beaten Jailton Almeida in the past year — Volkov on a split, Kuniev unanimously.", "by": "Main card" },
      { "id": "s-bout-12", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "23:00", "title": "Lone'er Kavanagh vs Ramazan Temirov", "description": "Flyweight, 3 rounds. Kavanagh 10-2 (England, No. 6 flyweight) vs Temirov 20-3 (Uzbekistan, No. 10 flyweight). The coin flip of the card: the favourite changes depending on the book.", "by": "Main card" },
      { "id": "s-bout-13", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "23:35", "title": "CO-MAIN: Petr Yan vs Merab Dvalishvili", "description": "Bantamweight, 5 rounds, for the UFC bantamweight title. Yan 20-5 (Russia, Champion · No. 4 pound-for-pound) vs Dvalishvili 21-5 (Georgia, No. 1 bantamweight · former champion). The trilogy decider: Dvalishvili won in March 2023, Yan in December 2025.", "by": "Main card", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/PLMMA_Cage-Octagon_MMA.JPG/1920px-PLMMA_Cage-Octagon_MMA.JPG", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s-bout-14", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "00:30", "title": "MAIN EVENT: Alexander Volkanovski vs Movsar Evloev", "description": "Featherweight, 5 rounds, for the UFC featherweight title. Volkanovski 28-4 (Australia, Champion · No. 2 pound-for-pound) vs Evloev 20-0 (Russia, No. 1 featherweight). Volkanovski's second defence of his second reign. Evloev's first title fight. Odds: a pick'em at most books.", "by": "Main event", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg", "imagePosition": "background", "imageFit": "cover" },
      { "id": "s-after", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "After the main event", "title": "Decision, belt and Octagon interviews", "description": "Scorecards, the belt and the in-cage interviews. Yas Bay's fan zone stays open late on fight night.", "by": "Main event" }
    ],
    "guests": [
      { "id": "g1", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Australia.svg/330px-Flag_of_Australia.svg.png", "name": "Alexander Volkanovski", "role": "Main event · UFC featherweight title, 5 rounds", "company": "28-4 · Australia · Champion · No. 2 pound-for-pound", "bio": "\"The Great\", out of Freestyle Fighting Gym in Windang, New South Wales. A two-time featherweight champion: he won the vacant belt back from Diego Lopes at UFC 314 in April 2025 and beat Lopes again in Sydney in February. A ninth UFC featherweight title-fight win would take him one past José Aldo for the division record. 5'6\", 71.5\" reach, 38 years old. \"For me to still be taking out an undefeated guy at 38 years old, they're the stories I think are real special.\"" },
      { "id": "g2", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Movsar Evloev", "role": "Main event · UFC featherweight title, 5 rounds", "company": "20-0 · Russia · No. 1 featherweight", "bio": "From Sunzha, Ingushetia, fighting out of American Top Team. Twenty professional fights, twenty wins, ten of them in the UFC — over Aljamain Sterling at UFC 310, and Lerone Murphy in a five-round title eliminator in London in March. 5'7\", 72.5\" reach. \"I have been waiting seven years since I signed with the UFC for this moment. In my mind, I won this fight 1,000 times.\"" },
      { "id": "g3", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Petr Yan", "role": "Co-main event · UFC bantamweight title, 5 rounds", "company": "20-5 · Russia · Champion · No. 4 pound-for-pound", "bio": "\"No Mercy\", from Yekaterinburg. Won the vacant title against José Aldo on Fight Island in 2020, and won it again at UFC 323 in December, stopping 27 of Dvalishvili's 29 takedown attempts and ending his fourteen-fight winning streak. A switch-hitter, 5'7.5\" with a 67\" reach. \"I know what to expect from him this time, and I know how to counter it.\"" },
      { "id": "g4", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Flag_of_Georgia.svg/330px-Flag_of_Georgia.svg.png", "name": "Merab Dvalishvili", "role": "Co-main event · UFC bantamweight title, 5 rounds", "company": "21-5 · Georgia · No. 1 bantamweight · former champion", "bio": "\"The Machine\", out of Serra-Longo on Long Island. Won the first fight with Yan 50-45 on all three cards in 2023, then defended the title three times in 2025 — Umar Nurmagomedov, Sean O'Malley, Cory Sandhagen — before Yan took it back. His first fight in Abu Dhabi. \"I'm ready for a 25-minute war.\"" },
      { "id": "g5", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Flag_of_England.svg/330px-Flag_of_England.svg.png", "name": "Lone'er Kavanagh", "role": "Main card · flyweight, 3 rounds", "company": "10-2 · England · No. 6 flyweight", "bio": "London, GB Top Team. Took a five-round decision off former champion Brandon Moreno on short notice in Mexico City in February, then lost to Brandon Royval at UFC 329 in July. 27 years old." },
      { "id": "g6", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Flag_of_Uzbekistan.svg/330px-Flag_of_Uzbekistan.svg.png", "name": "Ramazan Temirov", "role": "Main card · flyweight, 3 rounds", "company": "20-3 · Uzbekistan · No. 10 flyweight", "bio": "\"Temurlan\", from Qarshi, fighting for Muradov Legion. Knocked out Steve Erceg in the first round on this island in July — a Performance of the Night." },
      { "id": "g7", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Alexander Volkov", "role": "Main card · heavyweight, 3 rounds", "company": "40-11 · Russia · No. 2 heavyweight", "bio": "\"Drago\", from Moscow. Forty professional wins, a split decision over Jailton Almeida at UFC 321 here last October and a unanimous one over Waldo Cortes-Acosta in May. 6'7\" with an 80\" reach, and he turns 38 on fight night." },
      { "id": "g8", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Rizvan Kuniev", "role": "Main card · heavyweight, 3 rounds", "company": "14-3-1 · Russia · No. 7 heavyweight", "bio": "From Makhachkala, Dagestan. Outpointed Jailton Almeida in February, then finished Tyrell Fortune with knees in the third round on Yas Island in July." },
      { "id": "g9", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Aaron Pico", "role": "Main card · featherweight, 3 rounds", "company": "14-5 · United States · No. 11 featherweight", "bio": "Whittier, California, training at Jackson Wink. Lost his UFC debut to Lerone Murphy in August 2025, then beat Patricio Pitbull over three rounds at UFC 327 in April." },
      { "id": "g10", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Flag_of_Belgium.svg/330px-Flag_of_Belgium.svg.png", "name": "Losene Keita", "role": "Main card · featherweight, 3 rounds", "company": "17-2 · Belgium · Replaced Arnold Allen", "bio": "\"Black Panther\", from Kortrijk, Lamiro Fight Club. A former Oktagon MMA lightweight and featherweight champion who knocked out Muhammad Naimov in the first round in Paris in September, then took this fight when Arnold Allen withdrew injured." },
      { "id": "g11", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Azamat Murzakanov", "role": "Prelims · light heavyweight, 3 rounds", "company": "16-1 · Russia · No. 7 light heavyweight", "bio": "\"The Professional\", fighting out of Fairfield, New Jersey. Stopped Aleksandar Rakić in the first round at UFC 321 here last October; his only career loss came against Paulo Costa in April." },
      { "id": "g12", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Dominick Reyes", "role": "Prelims · light heavyweight, 3 rounds", "company": "16-5 · United States · No. 8 light heavyweight", "bio": "\"The Devastator\", from Victorville, California. Twice a light heavyweight title challenger; knocked out Nikita Krylov at UFC 314 and beat Johnny Walker on a split decision in April." },
      { "id": "g13", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Nikita Krylov", "role": "Prelims · light heavyweight, 3 rounds", "company": "31-12 · Russia · No. 15 light heavyweight", "bio": "\"The Miner\". Thirty-one wins; knocked out Modestas Bukauskas at UFC 324 in January before losing to Robert Whittaker at UFC 329 in July." },
      { "id": "g14", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/330px-Flag_of_Turkey.svg.png", "name": "Abdul Rakhman Yakhyaev", "role": "Prelims · light heavyweight, 3 rounds", "company": "10-0 · Türkiye · Unbeaten", "bio": "\"The Hunter\", out of Nuremberg MMA. A former Ares FC champion, 3-0 in the UFC since the 2025 Contender Series — and his last fight, in Baku in June, lasted eight seconds." },
      { "id": "g15", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/330px-Flag_of_Germany.svg.png", "name": "Abus Magomedov", "role": "Prelims · middleweight, 3 rounds", "company": "29-7-1 · Germany · No. 12 middleweight", "bio": "Düsseldorf, UFD Gym. Twenty-nine wins; guillotined Michał Oleksiejczuk in the first round in Baku in June." },
      { "id": "g16", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Australia.svg/330px-Flag_of_Australia.svg.png", "name": "Cam Rowston", "role": "Prelims · middleweight, 3 rounds", "company": "15-3 · Australia · 3-0 in the UFC", "bio": "City Kickboxing, Auckland. Stopped Andre Petroski and Cody Brundage, then outpointed Robert Bryczek in Perth in May." },
      { "id": "g17", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Grant Dawson", "role": "Prelims · lightweight, 3 rounds", "company": "24-3-1 · United States · American Top Team", "bio": "\"KGD\", from Coconut Creek, Florida. Back on track with a third-round rear-naked choke of Mateusz Rębecki at UFC 328 in May." },
      { "id": "g18", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Flag_of_Tajikistan.svg/330px-Flag_of_Tajikistan.svg.png", "name": "Nurullo Aliev", "role": "Prelims · lightweight, 3 rounds", "company": "12-0 · Tajikistan · Unbeaten", "bio": "\"Tajik Eagle\", from Dushanbe. Twelve fights, twelve wins, four of them in the UFC — the latest over Mike Davis on Yas Island in July." },
      { "id": "g19", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Australia.svg/330px-Flag_of_Australia.svg.png", "name": "Colby Thicknesse", "role": "Early prelims · bantamweight, 3 rounds", "company": "9-1 · Australia · Freestyle Fighting Gym", "bio": "\"Slickness\", from Windang — Volkanovski's own gym, on the same card. Back-to-back decision wins in Perth, the latest over Vince Morales in May." },
      { "id": "g20", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Asaf Chopurov", "role": "Early prelims · bantamweight, 3 rounds", "company": "11-0 · Russia · UFC debut", "bio": "\"The Honey Badger\". The reigning UAE Warriors bantamweight champion, signed straight from the Abu Dhabi promotion after a first-round stoppage of Reece McLaren in July." },
      { "id": "g21", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/330px-Flag_of_Russia.svg.png", "name": "Abubakar Vagaev", "role": "Early prelims · middleweight, 3 rounds", "company": "25-4 · Russia · Akhmat Fight Club", "bio": "A two-time ACA welterweight champion from Grozny. Won his UFC debut on this island in July against Saygid Izagakhmaev." },
      { "id": "g22", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Australia.svg/330px-Flag_of_Australia.svg.png", "name": "Jacob Malkoun", "role": "Early prelims · middleweight, 3 rounds", "company": "10-3 · Australia · Three straight wins", "bio": "\"Mamba\", from Sydney. Beat Torrez Finney at UFC 325 and Gerald Meerschaert in Perth in May." },
      { "id": "g23", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Flag_of_Belgium.svg/330px-Flag_of_Belgium.svg.png", "name": "Bolaji Oki", "role": "Early prelims · featherweight, 3 rounds", "company": "10-4 · Belgium · Featherweight debut", "bio": "\"Zulu Warrior\", Valon Team, Brussels. Drops from lightweight to featherweight for this one." },
      { "id": "g24", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/330px-Flag_of_Brazil.svg.png", "name": "Daniel Santos", "role": "Early prelims · featherweight, 3 rounds", "company": "14-3 · Brazil · Chute Boxe Diego Lima", "bio": "\"Willycat\", from São Paulo. Stopped JooSang Yoo at UFC 320; his fight with Dooho Choi in May won Fight of the Night." },
      { "id": "g25", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/330px-Flag_of_the_United_States.svg.png", "name": "Kody Steele", "role": "Early prelims · lightweight, 3 rounds", "company": "8-1 · United States · Syndicate MMA", "bio": "Las Vegas. Heel-hooked Dom Mar Fan in the first round in Perth in May." },
      { "id": "g26", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/330px-Flag_of_France.svg.png", "name": "Noah Gugnon", "role": "Early prelims · lightweight, 3 rounds", "company": "10-2 · France · Ten wins, ten finishes", "bio": "\"Guns\", Bulgarian Top Team. Every one of his ten wins has been a finish, the latest a 1:21 rear-naked choke in his UFC debut in Belgrade in August." },
      { "id": "g27", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/330px-Flag_of_Brazil.svg.png", "name": "Iasmin Lucindo", "role": "Early prelims · women's strawweight, 3 rounds", "company": "18-6 · Brazil · Academia Fight House", "bio": "From Feira de Santana, eighteen wins at 24. Last fought in August 2025, a decision over Angela Hill." },
      { "id": "g28", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/330px-Flag_of_Brazil.svg.png", "name": "Nicolle Caliari", "role": "Early prelims · women's strawweight, 3 rounds", "company": "9-4 · Brazil · Thai Brasil", "bio": "Florianópolis. Won her strawweight debut in May with a third-round arm-triangle choke of Shauna Bannon." }
    ],
    "guestsDisplay": {
      "layout": "list",
      "columns": 4,
      "imageShape": "square",
      "imageFit": "contain",
      "cardStyle": "card",
      "align": "left",
      "showBio": true
    },
    "faq": [
      { "id": "f1", "q": "What time should I get there?", "a": "Doors open at **17:00** and the early prelims start at **18:00**. The prelims follow at **20:00** and the main card at **22:00**. The co-main title fight is expected around **23:35** and the main event walkouts after midnight — both move with the length of the fights ahead of them. There is **no re-entry**, so arrive with everything you need." },
      { "id": "f2", "q": "Do I choose my own seat?", "a": "Yes. Every seat is sold as a specific chair. Pick a category, then pick the seat on the arena plan — it is held for ten minutes while you check out and released automatically if you do not finish." },
      { "id": "f3", "q": "What is the difference between the categories?", "a": "**Categories 1–4** are on the arena floor, in blocks A–C and E–G either side of the Octagon: rows A–E are cageside, rows F–L behind them. **Categories 5 and 6** are the lower bowl, sections 101–116 — rows A–M and N–Z. **Categories 7 and 8** are the upper tier, sections 301–332. Prices are face value at the 17 August on-sale, in US dollars at the dirham's fixed rate." },
      { "id": "f4", "q": "Is there an age limit?", "a": "No. Children under 2 go free on an adult's lap. Anyone **under 16 must be accompanied by an adult aged 21 or over**. Alcohol is served only to guests aged 21 and over with valid photo ID." },
      { "id": "f5", "q": "Can I transfer or resell my ticket?", "a": "Tickets are non-refundable, non-transferable and non-exchangeable. A ticket resold above face value can be cancelled, and tickets bought through unofficial resale sites may be refused at the gate. Bring photo ID — the holder's identity can be checked on entry." },
      { "id": "f6", "q": "What can I bring in?", "a": "One bag no larger than **30 × 30 × 15 cm** — there is no cloakroom. Not permitted: **flags of any kind, including national flags**, outside food and drink, laptops and tablets, power banks, perfume, lighters, selfie sticks and tripods, air horns, drones, glass and professional cameras. The arena is cashless: contactless payment only." },
      { "id": "f7", "q": "Is there a dress code?", "a": "No formal one. Dress and behave in keeping with the UAE's traditions and culture — clothing with offensive slogans or images is refused. The Record Lounge asks for smart casual chic." },
      { "id": "f8", "q": "Are fight-week events free?", "a": "Yes. The UFC Fan Experience at Yas Mall (19–25 October) and Yas Bay (21–25 October), Wednesday's open workouts at Yas Mall, Thursday's press conference and Friday's ceremonial weigh-ins at Etihad Arena are all free and open to the public." },
      { "id": "f9", "q": "How do I watch from home?", "a": "In the US the whole card streams on **Paramount+**, with no CBS simulcast. In the UAE it is on **STARZPLAY**; in the UK on **TNT Sports**. Main card times: 22:00 in Abu Dhabi, 2pm ET, 7pm in London, and 5am Sunday in Sydney." },
      { "id": "f10", "q": "What accessibility provision is there?", "a": "Wheelchair spaces with a companion seat alongside are marked on the arena plan and sell as a pair. Accessible seating can also be booked by phone with the Etihad Arena box office on **600 511 115**. Strollers are not allowed into the bowl; stroller parks are provided." }
    ],
    "map": {
      "coords": { "lat": 24.4603, "lng": 54.604 },
      "transport": "Zayed International Airport (AUH) is about seven minutes by road and central Abu Dhabi about twenty-five. From Dubai it is roughly 113 km on the E11 — around an hour and ten minutes in free-flowing traffic, with Salik tolls — or Etihad Rail from Al Yalayis to Mohamed Bin Zayed City and a taxi for the last leg. The free Yas Express shuttle calls at the Hilton Yas Island, a few minutes' walk from the gates. Public buses need a Nol card and may stop running before the main event ends, so plan the trip home.",
      "parking": "Parking is allocated by ticket category. P1-A (suites and Categories 1–2) and P1-B (Categories 3–4) sit beside the arena; everyone else parks in P2, the twofour54 lot, C37, Lifestyle or the multi-storey, all within about a ten-minute walk. The underground car park connects straight into the arena and the Hilton Abu Dhabi Yas Island; the outdoor waterfront lots are about seven minutes on foot.",
      "photo": {
        "key": "24.46030,54.60400",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg",
        "place": "Yas Bay Waterfront",
        "author": "Oleg Yunakov",
        "license": "CC BY-SA 4.0",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Yas_Bay_Waterfront,_Yas_Island,_Abu_Dhabi.jpg"
      },
      "nearbyHotels": [
        { "name": "Hilton Abu Dhabi Yas Island", "kind": "Hotel", "detail": "On Yas Bay, linked to the arena car park", "walkMin": 5, "lat": 24.45929, "lng": 54.60142 },
        { "name": "W Abu Dhabi – Yas Island", "kind": "Hotel", "detail": "The lattice-roofed hotel over the Yas Marina Circuit", "walkMin": 13, "lat": 24.46742, "lng": 54.60571 },
        { "name": "Centro Yas Island", "kind": "Hotel", "detail": "Yas Plaza — on the Yas Express shuttle", "walkMin": 12, "lat": 24.46527, "lng": 54.5989 },
        { "name": "Staybridge Suites Yas Island", "kind": "Hotel", "detail": "Yas Plaza, apartment-style rooms", "walkMin": 13, "lat": 24.4648, "lng": 54.59775 },
        { "name": "Yas Island Rotana", "kind": "Hotel", "detail": "Yas Plaza", "walkMin": 13, "lat": 24.46631, "lng": 54.59936 },
        { "name": "Crowne Plaza Abu Dhabi Yas Island", "kind": "Hotel", "detail": "Yas Plaza, beside Yas Links", "walkMin": 15, "lat": 24.46567, "lng": 54.59743 },
        { "name": "Radisson Blu Hotel Abu Dhabi Yas Island", "kind": "Hotel", "detail": "Yas Plaza", "walkMin": 16, "lat": 24.46722, "lng": 54.59775 },
        { "name": "Park Inn by Radisson Abu Dhabi Yas Island", "kind": "Hotel", "detail": "Yas Plaza, the budget end of the cluster", "walkMin": 17, "lat": 24.468, "lng": 54.59833 }
      ],
      "nearbyFood": [
        { "name": "Central", "kind": "Restaurant", "detail": "New York-style burgers, bowling and an arcade — closest to the doors", "walkMin": 4, "lat": 24.45886, "lng": 54.60233 },
        { "name": "Lock, Stock & Barrel", "kind": "Bar", "detail": "Late-night bar with live music on the waterfront", "walkMin": 3, "lat": 24.45893, "lng": 54.60258 },
        { "name": "EL&N", "kind": "Café", "detail": "Café beside the arena", "walkMin": 1, "lat": 24.45949, "lng": 54.60385 },
        { "name": "NURI Grill & Bar", "kind": "Restaurant", "detail": "Korean barbecue and omakase at the Hilton", "walkMin": 4, "lat": 24.45922, "lng": 54.60222 },
        { "name": "Asia Asia", "kind": "Restaurant", "detail": "Pan-Asian on Pier 71: dim sum, sushi and wok dishes", "walkMin": 7, "lat": 24.4582, "lng": 54.60045 },
        { "name": "Paradiso", "kind": "Restaurant", "detail": "Mediterranean on Pier 71, created with Pierre Gagnaire", "walkMin": 8, "lat": 24.45785, "lng": 54.60025 },
        { "name": "Hunter & Barrel", "kind": "Restaurant", "detail": "Australian charcoal-grill steakhouse on Pier 71", "walkMin": 8, "lat": 24.45747, "lng": 54.6001 },
        { "name": "The Trilogy by Buddha-Bar", "kind": "Bar", "detail": "Rooftop lounge, tapas and cocktails", "walkMin": 7, "lat": 24.45737, "lng": 54.60097 },
        { "name": "Zeera by Buddha-Bar", "kind": "Restaurant", "detail": "Modern Indian sharing plates", "walkMin": 8, "lat": 24.4573, "lng": 54.60059 },
        { "name": "Daikan Izakaya", "kind": "Restaurant", "detail": "Ramen and yakitori, quick before doors", "walkMin": 7, "lat": 24.45849, "lng": 54.60027 },
        { "name": "Bua Thai Café", "kind": "Restaurant", "detail": "Thai, on the waterfront", "walkMin": 6, "lat": 24.45849, "lng": 54.60093 }
      ],
      "nearbyTransit": [
        { "name": "Yas Express — Hilton Yas Island", "kind": "Transit stop", "detail": "Free shuttle: route Y2 starts here and Y3 calls here, 09:00–23:35", "walkMin": 5, "lat": 24.45929, "lng": 54.60142 },
        { "name": "Yas Mall", "kind": "Transit stop", "detail": "Yas Express and public bus interchange; UFC Fan Experience all week", "walkMin": 52, "lat": 24.48852, "lng": 54.60868 },
        { "name": "Zayed International Airport (AUH)", "kind": "Airport", "detail": "About seven minutes by road", "walkMin": 92, "lat": 24.4331, "lng": 54.6511 }
      ],
      "nearbyParking": [
        { "name": "P1-A", "kind": "Car park", "detail": "Suites, Categories 1 and 2", "walkMin": 3, "lat": 24.46053, "lng": 54.60203 },
        { "name": "Multi-storey car park", "kind": "Car park", "detail": "All other categories", "walkMin": 4, "lat": 24.46186, "lng": 54.60569 },
        { "name": "twofour54 car park", "kind": "Car park", "detail": "All other categories", "walkMin": 5, "lat": 24.46042, "lng": 54.60092 },
        { "name": "P2", "kind": "Car park", "detail": "All other categories", "walkMin": 8, "lat": 24.46081, "lng": 54.59931 },
        { "name": "P1-B", "kind": "Car park", "detail": "Categories 3 and 4", "walkMin": 8, "lat": 24.45986, "lng": 54.59886 },
        { "name": "C37", "kind": "Car park", "detail": "All other categories", "walkMin": 8, "lat": 24.4645, "lng": 54.60256 },
        { "name": "Lifestyle car park", "kind": "Car park", "detail": "All other categories — the furthest out", "walkMin": 12, "lat": 24.459, "lng": 54.59711 }
      ],
      "nearbyTaxi": [
        { "name": "Taxi and rideshare drop-off", "kind": "Taxi rank", "detail": "Drop-off and rideshare zones sit by the arena entrances; expect queues after the main event", "walkMin": 1, "lat": 24.4603, "lng": 54.604 }
      ]
    },
    "ticketGroups": [
      { "tierId": "t-floor", "name": "Floor — cageside", "color": "rose", "rank": 1 },
      { "tierId": "t-lower", "name": "Lower bowl", "color": "amber", "rank": 2 },
      { "tierId": "t-upper", "name": "Upper tier", "color": "slate", "rank": 3 }
    ],
    "tickets": [
      { "id": "tk-cat1", "groupId": "t-floor", "name": "Category 1 — Cageside centre", "price": 3974, "qty": 240, "description": "Floor blocks B and F, rows A–E: the middle of the long sides, level with the Octagon apron and the judges' table. Face value AED 14,595.", "discountIds": [] },
      { "id": "tk-cat2", "groupId": "t-floor", "name": "Category 2 — Cageside", "price": 2885, "qty": 480, "description": "Floor blocks A, C, E and G, rows A–E. The front of the floor, angled in on the cage either side of centre. Face value AED 10,595.", "discountIds": [] },
      { "id": "tk-cat3", "groupId": "t-floor", "name": "Category 3 — Floor centre", "price": 2340, "qty": 336, "description": "Blocks B and F, rows F–L. Directly behind the cageside rows, square to the Octagon, still on the arena floor. Face value AED 8,595.", "discountIds": [] },
      { "id": "tk-cat4", "groupId": "t-floor", "name": "Category 4 — Floor", "price": 1796, "qty": 672, "description": "Blocks A, C, E and G, rows F–L. The last of the floor seating — below the bowl, and the cheapest way onto the floor. Face value AED 6,595.", "discountIds": [] },
      { "id": "tk-cat5", "groupId": "t-lower", "name": "Category 5 — Lower bowl front", "price": 707, "qty": 3744, "description": "Sections 101–116, rows A–M. The first bank of the bowl, closest to the event floor. The Aldar Club seats sit in the middle of this tier. Face value AED 2,595.", "discountIds": [] },
      { "id": "tk-cat6", "groupId": "t-lower", "name": "Category 6 — Lower bowl rear", "price": 434, "qty": 4576, "description": "Sections 101–116, rows N–Z. The back bank of the lower bowl, directly above Category 5 — the whole cage in view, mid-arena. Face value AED 1,595.", "discountIds": [] },
      { "id": "tk-cat7", "groupId": "t-upper", "name": "Category 7 — Upper tier centre", "price": 216, "qty": 1760, "description": "Sections 309–324. The elevated tier, facing the Octagon square-on, with the big screens directly opposite. Face value AED 795.", "discountIds": [], "releases": [{ "id": "rel-c7-1", "name": "General on-sale — 17 August", "qty": 1710, "startMode": "date", "startAt": "2026-08-17T13:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }, { "id": "rel-c7-2", "name": "Fight-week release", "qty": 50, "startMode": "date", "startAt": "2026-10-21T10:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }] },
      { "id": "tk-cat8", "groupId": "t-upper", "name": "Category 8 — Upper tier ends", "price": 135, "qty": 1760, "description": "Sections 301–308 and 325–332, round the ends of the upper tier. The cheapest seat in the building at face value. Face value AED 495.", "discountIds": [], "releases": [{ "id": "rel-c8-1", "name": "General on-sale — 17 August", "qty": 1700, "startMode": "date", "startAt": "2026-08-17T13:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }, { "id": "rel-c8-2", "name": "Fight-week release", "qty": 60, "startMode": "date", "startAt": "2026-10-21T10:00", "afterReleaseId": "", "delayDays": 0, "endAt": "", "released": true, "paused": false }] }
    ],
    "ticketSold": {
      "tk-cat1": 226,
      "tk-cat2": 461,
      "tk-cat3": 322,
      "tk-cat4": 655,
      "tk-cat5": 3701,
      "tk-cat6": 4519,
      "tk-cat7": 1722,
      "tk-cat8": 1738
    },
    "releaseSoldOutAt": { "rel-c7-1": "2026-10-21T09:12:00.000Z", "rel-c8-1": "2026-10-21T08:47:00.000Z" },
    "seating": {
      "seatMapId": "e7112026-1024-4a33-9c00-000000000002",
      "mode": "type-first",
      "holdMinutes": 10,
      "sectionTiers": {
        "e7112026-1024-4a33-9c01-000000000001": "tk-cat2",
        "e7112026-1024-4a33-9c01-000000000002": "tk-cat4",
        "e7112026-1024-4a33-9c01-000000000003": "tk-cat1",
        "e7112026-1024-4a33-9c01-000000000004": "tk-cat3",
        "e7112026-1024-4a33-9c01-000000000005": "tk-cat2",
        "e7112026-1024-4a33-9c01-000000000006": "tk-cat4",
        "e7112026-1024-4a33-9c01-000000000007": "tk-cat2",
        "e7112026-1024-4a33-9c01-000000000008": "tk-cat4",
        "e7112026-1024-4a33-9c01-000000000009": "tk-cat1",
        "e7112026-1024-4a33-9c01-000000000010": "tk-cat3",
        "e7112026-1024-4a33-9c01-000000000011": "tk-cat2",
        "e7112026-1024-4a33-9c01-000000000012": "tk-cat4",
        "e7112026-1024-4a33-9c01-000000000013": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000014": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000015": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000016": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000017": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000018": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000019": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000020": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000021": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000022": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000023": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000024": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000025": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000026": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000027": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000028": "tk-cat5",
        "e7112026-1024-4a33-9c01-000000000029": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000030": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000031": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000032": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000033": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000034": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000035": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000036": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000037": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000038": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000039": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000040": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000041": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000042": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000043": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000044": "tk-cat6",
        "e7112026-1024-4a33-9c01-000000000045": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000046": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000047": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000048": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000049": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000050": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000051": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000052": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000053": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000054": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000055": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000056": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000057": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000058": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000059": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000060": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000061": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000062": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000063": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000064": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000065": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000066": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000067": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000068": "tk-cat7",
        "e7112026-1024-4a33-9c01-000000000069": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000070": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000071": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000072": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000073": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000074": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000075": "tk-cat8",
        "e7112026-1024-4a33-9c01-000000000076": "tk-cat8"
      }
    },
    "ticketRules": {
      "earlybird": false,
      "donation": false,
      "accessCode": false,
      "reservedSeating": true,
      "groupPurchase": false,
      "bundles": false,
      "releases": true
    },
    "purchasables": [
      { "id": "pu-lounge", "name": "Record Lounge — pre-fight hospitality", "description": "17:00–20:00: a three-hour premium drinks package, plated and pass-around dining and a live DJ, then open until midnight with food and drink to buy. Unreserved seating, smart casual chic. Alcohol for guests 21+ with ID. AED 599.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg", "price": 163, "priceType": "flat", "pickType": "quantity", "required": false, "stock": 400, "maxPerOrder": 4, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-parking", "name": "Car park pass", "description": "Free, and it follows your category: P1-A for Categories 1–2, P1-B for Categories 3–4, and P2, twofour54, C37, Lifestyle or the multi-storey for everyone else. Tick it so we send your lot and directions with your tickets.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "price": 0, "priceType": "flat", "pickType": "toggle", "required": false, "stock": null, "maxPerOrder": 1, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } },
      { "id": "pu-shirt", "name": "UFC 333 fight-week T-shirt", "description": "Printed for Abu Dhabi Showdown Week and collected at the merchandise stand on arrival. Sizes are chosen at the stand.", "image": "", "price": 45, "priceType": "flat", "pickType": "quantity", "required": false, "stock": 1500, "maxPerOrder": 4, "enabled": true, "showIf": { "match": "all", "bands": [], "slotIds": [], "tickets": "all", "minQty": null, "maxQty": null, "membersOnly": false, "cutoffHours": null, "requiresPurchasableId": null, "excludesPurchasableId": null } }
    ],
    "purchaseDisclaimer": {
      "enabled": true,
      "title": "Before you buy — Etihad Arena ticket conditions",
      "text": "Tickets are non-refundable, non-transferable and non-exchangeable, and may be cancelled if resold above face value. Bring photo ID: the ticket holder's identity can be checked at the gate.\n\nAnyone under 16 must be accompanied by an adult aged 21 or over. Alcohol is served only to guests 21 and over.\n\nThere is no re-entry. Bags are limited to 30 × 30 × 15 cm with no cloakroom, and flags of any kind — including national flags — are not permitted.\n\nThe card can change. A bout being changed or withdrawn is not grounds for a refund.",
      "appliesTo": "all",
      "requireCheck": true,
      "checkLabel": "I have read the ticket conditions and the entry rules",
      "confirmLabel": "Agree & continue to payment"
    },
    "ticketSelection": {
      "enabled": true,
      "mode": "seats",
      "seatsLabel": "Pick your seat on the arena plan",
      "priceLabel": "Browse by category",
      "features": ["plan", "digital"],
      "autoAssignNote": "Choose a category, then choose the exact seat. It is held for ten minutes while you check out and released automatically if you do not finish — so a seat you can see is a seat you can have.",
      "soldOutNote": "This category is sold out. Returned seats and released production holds go back on sale here first."
    },
    "regSettings": { "showRemaining": true },
    "questions": [
      { "id": "q1", "label": "Who are you supporting in the main event?" },
      { "id": "q2", "label": "Accessible seating or companion seat required" },
      { "id": "q3", "label": "Dietary requirements (Record Lounge holders)" },
      { "id": "q4", "label": "Mobile number for fight-day updates" }
    ],
    "guidelines": [
      { "id": "gl1", "category": "accessibility", "label": "Wheelchair spaces sell as a pair", "detail": "Each wheelchair space on the plan has a companion seat beside it, and the two are sold together so nobody is separated from the person they came with. Phone bookings: 600 511 115." },
      { "id": "gl2", "category": "accessibility", "label": "Under-16s with an adult aged 21+", "detail": "There is no minimum age, but anyone under 16 must be accompanied by an adult aged 21 or over. Under-2s go free on a lap." },
      { "id": "gl3", "category": "dietary", "label": "Record Lounge plates to requirement", "detail": "Plated and pass-around dining from 17:00 to 20:00 for Record Lounge add-on holders. Tell us your dietary requirements in the booking questions." },
      { "id": "gl4", "category": "safety", "label": "Bag limit 30 × 30 × 15 cm, no cloakroom", "detail": "Anything larger is refused at the gate and there is nowhere on site to leave it." },
      { "id": "gl5", "category": "safety", "label": "No flags, no re-entry", "detail": "Flags of any kind — including national flags — are not permitted in the arena. Entry is once only: leave the building and your ticket is spent." }
    ],
    "organizerAvatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg",
    "team": [
      { "name": "UFC", "role": "Promoter" },
      { "name": "Department of Culture and Tourism – Abu Dhabi", "role": "Host partner" },
      { "name": "Etihad Arena", "role": "Venue" },
      { "name": "Ethara", "role": "Venue operator" }
    ],
    "languages": [
      { "name": "English", "isDefault": true },
      { "name": "العربية" }
    ],
    "tags": ["UFC", "Featherweight title", "Bantamweight title", "Reserved seating", "Abu Dhabi Showdown Week"],
    "galleryDisplay": {
      "layout": "carousel",
      "slidesPerView": 3,
      "autoplay": true,
      "autoplaySeconds": 5,
      "loop": true,
      "arrows": true,
      "dots": true
    },
    "sectionNotes": [
      { "id": "n1", "target": "schedule", "enabled": true, "text": "Fight-night times are Gulf Standard Time (UTC+4). Only the segment starts — 18:00, 20:00 and 22:00 — are fixed by the broadcast; every bout after the first moves with the fights before it." },
      { "id": "n2", "target": "register", "enabled": true, "text": "Prices are face value at the 17 August on-sale, shown in US dollars at the dirham's fixed rate (USD 1 = AED 3.6725). The event sold out on 21 October; remaining seats are fight-week releases of production and partner holds." },
      { "id": "n3", "target": "guests", "enabled": true, "text": "All 28 fighters on the card, with records, ranks and flags as UFC.com listed them on 22 October. Fighters are shown by flag: no portrait here is licensed for reuse, so we use flags rather than borrow one." },
      { "id": "n4", "target": "guidelines", "enabled": true, "text": "Etihad Arena's own entry rules apply on the night, and they are strict on bags and flags." }
    ],
    "ctas": {
      "primaryLabel": "Choose your seat",
      "items": [
        { "id": "cta-packages", "label": "VIP & hospitality", "url": "/e/c3332026-1024-4b33-9e00-000000000001/packages", "style": "primary" },
        { "id": "cta-card", "label": "See the full card", "url": "#sec-schedule", "style": "outline" },
        { "id": "cta-guide", "label": "Fight-week guide", "url": "https://www.ufc.com/ufc-333-fight-week-guide", "style": "ghost" }
      ]
    },
    "disclaimer": {
      "enabled": true,
      "text": "This is a demonstration event page built on Geiger Events. UFC, the Octagon, Etihad Arena and the Department of Culture and Tourism – Abu Dhabi are the marks of their respective owners; this page is not affiliated with, endorsed by or sponsored by any of them. The card, records, ranks, quotes, venue details and fight-week schedule are as publicly reported on 22 October 2026 and may change. Ticket prices are the published face values converted to US dollars. Photographs are freely licensed Wikimedia Commons images of Abu Dhabi and of other MMA events — none shows UFC 333. Sales figures, seat availability and package prices are illustrative, and no transaction here is real.",
      "placements": ["hero", "above-footer"]
    },
    "infographics": [
      { "id": "ig-tape", "type": "showcase", "props": { "title": "Tale of the tape", "titleAlign": "left", "layoutMode": "grid", "columns": "2", "showOne": false, "clickOpen": true, "items": [{ "title": "Main event — Volkanovski vs Evloev", "text": "UFC featherweight title, five rounds. The champion at 38 against the unbeaten No. 1 contender.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg", "textSide": "top", "ctaLabel": "Meet the fighters", "ctaUrl": "#sec-guests", "details": "Alexander Volkanovski: 28-4, Australia, orthodox, 5'6\" with a 71.5\" reach. Champion, No. 2 pound-for-pound. Movsar Evloev: 20-0, Russia, orthodox, 5'7\" with a 72.5\" reach. No. 1 featherweight. All ten of Evloev's UFC wins have gone to the judges; Volkanovski says he can finish it \"inside the five\". Evloev: \"I can beat anyone by decision because of my style.\" The odds are a pick'em." }, { "title": "Co-main — Yan vs Dvalishvili III", "text": "UFC bantamweight title, five rounds. One win each, and both of them went the full twenty-five minutes.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/PLMMA_Cage-Octagon_MMA.JPG/1920px-PLMMA_Cage-Octagon_MMA.JPG", "textSide": "top", "ctaLabel": "Meet the fighters", "ctaUrl": "#sec-guests", "details": "Petr Yan: 20-5, Russia, switch stance, 5'7.5\" with a 67\" reach. Champion, No. 4 pound-for-pound. Merab Dvalishvili: 21-5, Georgia, orthodox, 5'6\" with a 68\" reach. No. 1 bantamweight. Fight one, March 2023: Dvalishvili 50-45 ×3, eleven takedowns from a record 49 attempts. Fight two, UFC 323, December 2025: Yan 49-46, 49-46, 48-47, stopping 27 of 29 takedown attempts. Yan is a modest favourite." }, { "title": "Heavyweights — Volkov vs Kuniev", "text": "No. 2 against No. 7, three rounds, on the main card.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg", "textSide": "top", "ctaLabel": "See the card", "ctaUrl": "#sec-schedule", "details": "Alexander Volkov: 40-11, 6'7\" with an 80\" reach, a split-decision winner over Jailton Almeida in this arena last October — and 38 on fight night. Rizvan Kuniev: 14-3-1, 6'4\" with a 76\" reach, who beat the same Almeida in February and stopped Tyrell Fortune here in July." }, { "title": "Flyweights — Kavanagh vs Temirov", "text": "No. 6 against No. 10. The closest odds on the card.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Abu_Dhabi_Corniche_by_night.jpg/1920px-Abu_Dhabi_Corniche_by_night.jpg", "textSide": "top", "ctaLabel": "See the card", "ctaUrl": "#sec-schedule", "details": "Lone'er Kavanagh: 10-2, England, beat Brandon Moreno over five rounds in February. Ramazan Temirov: 20-3, Uzbekistan, knocked out Steve Erceg in the first round in Abu Dhabi in July. The favourite depends on which book you ask." }] } },
      { "id": "ig-levels", "type": "showcase", "props": { "title": "Eight categories, three levels", "titleAlign": "left", "layoutMode": "grid", "columns": "3", "showOne": false, "clickOpen": true, "items": [{ "title": "The floor — Categories 1–4", "text": "Six blocks, A–C and E–G, either side of the Octagon.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/PLMMA_Cage-Octagon_MMA.JPG/1920px-PLMMA_Cage-Octagon_MMA.JPG", "textSide": "top", "ctaLabel": "Choose a floor seat", "ctaUrl": "#tickets", "details": "1,728 seats. Rows A–E are cageside — Category 1 in the centre blocks B and F, Category 2 in the angled blocks either side — and rows F–L sit directly behind them as Categories 3 and 4. The two ends of the floor carry no seating." }, { "title": "Lower bowl — Categories 5 and 6", "text": "Sections 101–116 in two banks, wrapped round three sides of the floor.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg", "textSide": "top", "ctaLabel": "Choose a lower bowl seat", "ctaUrl": "#tickets", "details": "8,320 seats. Category 5 is the front bank, rows A–M, the closest seats to the event floor off it; Category 6 the back bank, rows N–Z. The Aldar Club seats sit centrally on the main concourse, and the hospitality loges — 101, 105, 106 A and B, 108 and 115 — are set into this tier." }, { "title": "Upper tier — Categories 7 and 8", "text": "Sections 301–332, high above the cage, with the screens opposite.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "textSide": "top", "ctaLabel": "Choose an upper tier seat", "ctaUrl": "#tickets", "details": "3,520 seats from AED 495 at face value. Category 7 is the sixteen sections square-on to the Octagon; Category 8 the eight at each end. This is where the fight-week releases of production holds are." }] } },
      { "id": "ig-history", "type": "carousel", "props": { "title": "The UFC on Yas Island", "titleAlign": "left", "autoplay": true, "mode": "row", "items": [{ "title": "2010 — UFC 112", "text": "The first UFC event in the Middle East, in a temporary outdoor arena beside Ferrari World. 11,008 watched Anderson Silva beat Demian Maia.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Ferrariworld_by_Flo_Ness.jpg/1920px-Ferrariworld_by_Flo_Ness.jpg", "textSide": "bottom" }, { "title": "2019 — UFC 242", "text": "Khabib Nurmagomedov submits Dustin Poirier in the third round, months after a five-year deal with the Department of Culture and Tourism promised a title fight on every Abu Dhabi card.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg", "textSide": "bottom" }, { "title": "2020 — Fight Island", "text": "A Yas Island safe zone carries the sport through the pandemic. UFC 251: Volkanovski beats Max Holloway; Yan wins the vacant bantamweight title against José Aldo.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg/1920px-Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg", "textSide": "bottom" }, { "title": "2021 — UFC 257", "text": "Etihad Arena's first UFC crowd, about 2,600 strong, sees Dustin Poirier stop Conor McGregor in the second round.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg", "textSide": "bottom" }, { "title": "2023 — UFC 294", "text": "On eleven days' notice, Volkanovski moves up to fight Islam Makhachev for the lightweight title and is knocked out in the first round. The partnership is extended to 2028.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Abu_Dhabi_Corniche_by_night.jpg/1920px-Abu_Dhabi_Corniche_by_night.jpg", "textSide": "bottom" }, { "title": "2024 — UFC 308", "text": "Ilia Topuria becomes the first man to knock out Max Holloway; Khamzat Chimaev submits Robert Whittaker in the co-main.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Etihad_Airways_Flyover_-_Yas_Island%2C_Abu_Dhabi_Grand_Prix_%282%29.jpg/1920px-Etihad_Airways_Flyover_-_Yas_Island%2C_Abu_Dhabi_Grand_Prix_%282%29.jpg", "textSide": "bottom" }, { "title": "2025 — UFC 321", "text": "13,220 in the building. Alexander Volkov edges Jailton Almeida — and is back a year later, on his 38th birthday.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Yas_Marina_circuit_by_night.jpg/1920px-Yas_Marina_circuit_by_night.jpg", "textSide": "bottom" }] } },
      { "id": "ig-split", "type": "split", "props": { "title": "How the seat picker works", "titleAlign": "left", "text": "Choose a category, then choose your chair.\n\nThe arena plan shows all 13,568 seats coloured by category, with sold and held seats greyed out as they go. Click the ones you want — they are held for ten minutes while you check out, and handed back automatically if you walk away.\n\nWheelchair spaces and their companion seats are marked on the plan and sell together, so nobody is separated from the person they came with.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg", "imageSide": "right", "ctaLabel": "Open the arena plan", "ctaUrl": "#tickets" } },
      { "id": "ig-quotes", "type": "quotes", "props": { "title": "Fight week, in their words", "titleAlign": "left", "layout": "grid", "columns": "3", "items": [{ "quote": "I love the fact that I'm 38 years old.", "name": "Alexander Volkanovski", "role": "To ESPN, 21 October" }, { "quote": "I prefer explaining when I win the belt, not before.", "name": "Movsar Evloev", "role": "To The National, 21 October" }, { "quote": "I'm prepared for an absolute war. That's just how it is.", "name": "Alexander Volkanovski", "role": "To The National, 21 October" }, { "quote": "We'll see whose fans are louder.", "name": "Movsar Evloev", "role": "To Yahoo Sports, 21 October" }, { "quote": "The biggest difference between fights was that I could punch him.", "name": "Petr Yan", "role": "To Yahoo Sports, 20 October" }, { "quote": "This time will be a much different fight.", "name": "Merab Dvalishvili", "role": "To CBS Sports, 21 October" }] } },
      { "id": "ig-footer", "type": "footer", "props": { "title": "Before you travel", "titleAlign": "left", "note": "UFC 333 · Etihad Arena, Yas Bay Waterfront, Yas Island, Abu Dhabi · Saturday 24 October 2026, doors 17:00 GST. Demonstration page — see the disclaimer.", "items": [{ "title": "Etihad Arena — plan your visit", "link": "https://www.etihadarena.ae/en/plan-your-visit/ticketing-policy" }, { "title": "Prohibited items", "link": "https://www.etihadarena.ae/en/plan-your-visit/prohibited-items" }, { "title": "Fight-week guide", "link": "https://www.ufc.com/ufc-333-fight-week-guide" }, { "title": "Accessible seating: 600 511 115", "link": "tel:600511115" }] } }
    ],
    "badge": { "enabled": true, "templateId": "" },
    "packagesPage": {
      "enabled": true,
      "title": "UFC 333 — VIP & hospitality",
      "subtitle": "Five ways to spend fight night closer than a ticket gets you.",
      "introHeading": "The Octagon, the athletes, the room before the first bell",
      "introBody": "A package is a seat plus the night around it: the private lounge before the main card, the athletes you meet, the cage you stand inside afterwards. The tiers follow the UFC VIP Experience ladder; the suite and the loge are the arena's own, booked directly with the venue. Every one is capped by how many people the room actually holds.",
      "introLinkLabel": "Back to the event",
      "introLinkUrl": "",
      "gridHeading": "VIP packages",
      "pitchEnabled": true,
      "pitchHeading": "Hosting a company?",
      "pitchBody": "Etihad Arena's seventeen suites sit in a ring above the far side of the bowl, each with its own entrance, catering team and seats outside the door. Tell us the size of the group and we will come back with what is left.",
      "pitchImage": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg",
      "pitchCtaLabel": "Talk to the hospitality team",
      "leadsEnabled": true,
      "leadsHeading": "Ask about a package",
      "leadsConsent": "We will use these details only to answer this enquiry about UFC 333.",
      "leadsRecipient": "vip@ufc333.example"
    },
    "packages": {
      "intro": "Tier prices follow the last published Abu Dhabi ladder (UFC 294) and are illustrative here; the suite and loge are priced by the venue on enquiry. Every package includes a reserved seat.",
      "items": [
        {
          "id": "pkg-elite",
          "name": "Elite",
          "tagline": "Front row of the floor, and fight week from the inside",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/BRAVE_Darius-7.jpg/1920px-BRAVE_Darius-7.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Front-row floor seat, cageside" },
            { "id": "i2", "icon": "access", "text": "Side-stage access at Friday's ceremonial weigh-ins" },
            { "id": "i3", "icon": "gift", "text": "Custom fight kit and an autographed, framed fight poster" },
            { "id": "i4", "icon": "access", "text": "Private entrance under the arena" },
            { "id": "i5", "icon": "hospitality", "text": "All-inclusive VIP lounge from doors until the main card" }
          ],
          "details": "The top of the ladder, sold on application. Availability depends on the floor allocation left after the athletes' and promotion's seats are set.",
          "price": null,
          "priceSuffix": "",
          "stock": 12,
          "ctaLabel": "Apply",
          "mode": "enquire",
          "visible": true
        },
        {
          "id": "pkg-champion",
          "name": "Champion",
          "tagline": "A premium floor seat and a step inside the Octagon",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/PLMMA_Cage-Octagon_MMA.JPG/1920px-PLMMA_Cage-Octagon_MMA.JPG",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Premium floor seat (Categories 3–4)" },
            { "id": "i2", "icon": "photo", "text": "Post-fight Octagon experience and photograph" },
            { "id": "i3", "icon": "meet", "text": "Meet-and-greet with a UFC athlete" },
            { "id": "i4", "icon": "hospitality", "text": "Private all-inclusive lounge before the main card" },
            { "id": "i5", "icon": "gift", "text": "UFC VIP gift" }
          ],
          "details": "Floor seat, lounge, and the cage itself once the arena empties.",
          "price": 4000,
          "priceSuffix": "/pp",
          "stock": 60,
          "ctaLabel": "Buy package",
          "mode": "buy",
          "visible": true
        },
        {
          "id": "pkg-challenger",
          "name": "Challenger",
          "tagline": "Lower bowl seat, weigh-in access and the VIP lounge",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg/1920px-Yas_Bay_Waterfront%2C_Yas_Island%2C_Abu_Dhabi.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Lower bowl seat (Category 5)" },
            { "id": "i2", "icon": "access", "text": "Reserved access to Friday's ceremonial weigh-ins" },
            { "id": "i3", "icon": "meet", "text": "Fighter appearances in the lounge" },
            { "id": "i4", "icon": "hospitality", "text": "VIP lounge with open bar and food from doors until the main card" },
            { "id": "i5", "icon": "gift", "text": "UFC VIP gift" }
          ],
          "details": "The entry to the ladder: everything around the fight, with a seat in the front bank of the bowl.",
          "price": 2000,
          "priceSuffix": "/pp",
          "stock": 150,
          "ctaLabel": "Buy package",
          "mode": "buy",
          "visible": true
        },
        {
          "id": "pkg-loge",
          "name": "Loge 108",
          "tagline": "A private box for thirteen in the middle of the bowl",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Thirteen seats in hospitality loge 108, centre lower bowl" },
            { "id": "i2", "icon": "access", "text": "Private entrance through the VIP suite entrance" },
            { "id": "i3", "icon": "location", "text": "Three VIP parking passes in car park P1" },
            { "id": "i4", "icon": "hospitality", "text": "Premium food and non-alcoholic drinks, with a dedicated box and catering administrator" }
          ],
          "details": "Booked as a whole box through Etihad Arena's hospitality team. Loges 101, 105, 106 A and B and 115 are set into the same tier.",
          "price": null,
          "priceSuffix": "",
          "stock": 1,
          "ctaLabel": "Enquire",
          "mode": "enquire",
          "visible": true
        },
        {
          "id": "pkg-suite",
          "name": "Suite 202",
          "tagline": "Twelve guests, a private entrance and seats outside the door",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Abu_Dhabi_Corniche_by_night.jpg/1920px-Abu_Dhabi_Corniche_by_night.jpg",
          "inclusions": [
            { "id": "i1", "icon": "seat", "text": "Luxury seats directly outside the suite, for twelve" },
            { "id": "i2", "icon": "location", "text": "Secure underground VIP parking and a private entrance" },
            { "id": "i3", "icon": "hospitality", "text": "Event-themed gourmet buffet with a dedicated F&B team" },
            { "id": "i4", "icon": "star", "text": "Ushers and on-site concierge all night" }
          ],
          "details": "One of seventeen suites numbered 201–217 in a continuous ring above the far side of the bowl. Booked as a whole suite through the venue.",
          "price": null,
          "priceSuffix": "",
          "stock": 1,
          "ctaLabel": "Enquire",
          "mode": "enquire",
          "visible": true
        }
      ]
    },
    "sponsorship": {
      "spots": [
        { "id": "spot-fanzone", "name": "Yas Bay Fan Zone — presenting partner", "tier": "Presenting", "description": "Naming rights on the Showdown Week fan zone at Yas Bay Waterfront, 21–25 October.", "benefits": ["Fan zone naming and main-stage branding", "Logo on the event page and every fight-week schedule", "Twenty Category 5 tickets"], "price": 250000, "quantity": 1, "reserved": 0, "open": true, "sourcePackageId": null, "fills": [] },
        { "id": "spot-activation", "name": "Fan Zone activation space", "tier": "Activation", "description": "A branded 6 × 6 m space inside the fan zone for the five days of Showdown Week.", "benefits": ["6 × 6 m activation footprint with power", "Listing in the fan-zone map", "Four Category 6 tickets"], "price": 35000, "quantity": 6, "reserved": 4, "open": true, "sourcePackageId": null, "fills": [] },
        { "id": "spot-watch", "name": "Official watch party venue", "tier": "Venue partner", "description": "Host a ticketed or free screening of the main card, listed on the event page as an official watch party.", "benefits": ["Official watch party listing", "Broadcast screening rights for the venue", "Fight-week promotional assets"], "price": 12000, "quantity": 3, "reserved": 1, "open": true, "sourcePackageId": null, "fills": [] }
      ]
    },
    "sponsorshipPage": {
      "enabled": true,
      "title": "Partner with UFC 333 fight week",
      "subtitle": "Abu Dhabi Showdown Week, 19–25 October — Yas Mall, Yas Bay and Etihad Arena.",
      "intro": "Five days of free fan events build to a sold-out fight night. The spots below are for brands and venues that want to be part of the week around it; we agree every deal directly, then list confirmed partners on the event page.",
      "showPrices": true,
      "showFilled": true,
      "contactHeading": "Talk to the partnerships team",
      "contactEmail": "partners@ufc333.example",
      "contactPhone": "",
      "contactWhatsapp": "",
      "bookingUrl": "",
      "bookingLabel": "Book a call",
      "contactNote": "We answer every enquiry within one working day during fight week.",
      "formEnabled": true,
      "formHeading": "Register your interest",
      "formIntro": "Tell us which spot you are after and we will come back with availability.",
      "fields": [
        { "id": "q-spot", "label": "Which spot?", "type": "select", "required": true, "options": ["Fan Zone presenting partner", "Fan Zone activation space", "Official watch party venue"] },
        { "id": "q-budget", "label": "Budget (AED)", "type": "text", "required": false }
      ],
      "consent": "We will use these details only to answer this enquiry.",
      "successMessage": "Thanks — the partnerships team will be in touch within one working day."
    },
    "pageDesign": {
      "mode": "themed",
      "accent": "rose",
      "cover": "accent",
      "font": "sans",
      "showGallery": true,
      "viewerMode": "dark",
      "theme": {
        "base": "dark",
        "colors": {
          "brand": "#D20A0A",
          "brandText": "#FFFFFF",
          "accent": "#C9A44C",
          "link": "#FF4D4D",
          "brandHover": "#EF1C1C",
          "brandTo": "#7A0505",
          "bg": "#070708",
          "surface": "#111114",
          "text": "#F4F4F5",
          "muted": "#9A9AA3",
          "border": "#25252B"
        },
        "font": {
          "heading": "custom",
          "body": "sans",
          "scale": "md",
          "headingFamily": "Oswald",
          "bodyFamily": "",
          "webfonts": [
            { "family": "Oswald", "css": "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap" }
          ],
          "faces": []
        },
        "logo": { "url": "", "height": 26, "link": "", "showBar": true, "showInFooter": true },
        "footerLogo": { "url": "", "height": 24, "link": "" },
        "source": { "url": "", "siteName": "", "importedAt": "" },
        "header": {
          "show": true,
          "links": [
            { "label": "The fight", "url": "#sec-top" },
            { "label": "Fight card", "url": "#sec-schedule" },
            { "label": "Fighters", "url": "#sec-guests" },
            { "label": "Getting there", "url": "#sec-location" },
            { "label": "FAQ", "url": "#sec-faq" }
          ],
          "cta": { "label": "Choose your seat", "url": "#tickets" },
          "align": "split",
          "sticky": true,
          "background": "#070708",
          "border": true,
          "navUpper": true,
          "navTracking": 0.1,
          "navWeight": "600",
          "navSize": 12
        },
        "headingWeight": "bold",
        "headingUpper": true,
        "headingTracking": 0.01,
        "headingLineHeight": 1,
        "bodyWeight": "",
        "radius": "sharp",
        "radiusPx": 0,
        "button": "solid",
        "buttonRadiusPx": 0,
        "buttonUpper": true,
        "buttonWeight": "700",
        "buttonTracking": 0.08,
        "borderWidth": 1,
        "elevation": "lifted",
        "width": "wide",
        "density": "spacious",
        "layout": "spotlight",
        "hero": "banner",
        "coverOverlay": "scrim",
        "sidebar": "right",
        "background": {
          "type": "image",
          "value": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Skyline_of_Abu_Dhabi_by_night.jpg/1920px-Skyline_of_Abu_Dhabi_by_night.jpg",
          "overlay": "base",
          "dim": 92
        },
        "footerStyle": { "background": "#040405", "text": "#E7E7EA" },
        "favicon": "",
        "tagline": "Volkanovski defends the featherweight title against the unbeaten Evloev, and Yan and Dvalishvili settle their trilogy. Etihad Arena, Abu Dhabi — Saturday 24 October.",
        "themeColor": "#070708"
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
        "text": "UFC 333: Volkanovski vs Evloev · Etihad Arena, Yas Island, Abu Dhabi · Saturday 24 October 2026",
        "links": [
          { "label": "Tickets", "url": "#tickets" },
          { "label": "Fight card", "url": "#sec-schedule" },
          { "label": "Getting there", "url": "#sec-location" },
          { "label": "VIP & hospitality", "url": "/e/c3332026-1024-4b33-9e00-000000000001/packages" }
        ],
        "socials": [
          { "platform": "website", "url": "https://www.etihadarena.ae/en/event-booking/ufc-333" }
        ]
      }
    }
  }$meta$::jsonb
)
on conflict (id) do update set
  project_id        = excluded.project_id,
  venue_id          = excluded.venue_id,
  name              = excluded.name,
  status            = excluded.status,
  type              = excluded.type,
  event_date        = excluded.event_date,
  event_time        = excluded.event_time,
  timezone          = excluded.timezone,
  venue             = excluded.venue,
  address           = excluded.address,
  city              = excluded.city,
  capacity          = excluded.capacity,
  sold              = excluded.sold,
  revenue           = excluded.revenue,
  visibility        = excluded.visibility,
  organizer         = excluded.organizer,
  summary           = excluded.summary,
  cover_url         = excluded.cover_url,
  gallery           = excluded.gallery,
  is_listable       = excluded.is_listable,
  metadata          = excluded.metadata,
  deleted_at  = null;
