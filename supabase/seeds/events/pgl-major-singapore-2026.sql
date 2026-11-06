-- PGL Major Singapore 2026 — independent Geiger Events showcase (CS2, Counter-Strike 2).
-- Status: synthetic demo seed built at parent request. No tickets, no payments, no seats.
-- Run: npm run db:seed -- pgl-major-singapore-2026 (or: node scripts/run-seed.js supabase/seeds/events/pgl-major-singapore-2026.sql)
-- File: supabase/seeds/events/pgl-major-singapore-2026.sql
-- Idempotent: both INSERTs end ON CONFLICT (id) DO UPDATE; reruns refresh only these two IDs.
-- Owns only: venue 6c5a2026-1205-4e11-8c00-000000000002 and event 6c5a2026-1205-4e11-8c00-000000000001.
-- IDs verified unused prior to authoring: grep for "6c5a2026-1205" across supabase/seeds/ returned no matches.
-- project_id ebcc7910-1a0e-4e91-8c3b-752f3c4292d3 matches the other demo seeds.
-- Shape mirrors supabase/seeds/events/singapore-grand-prix-2026.sql (venues insert, then events insert,
-- both via jsonb_populate_record with $seed$ blocks) and ubc-2026 conventions. No application changes.
--
-- SOURCES (researched 2026-11-04 via local webfetch; websearch was unavailable, Liquipedia returned 403):
-- https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026
-- https://en.wikipedia.org/wiki/Counter-Strike_Major_Championships
-- https://en.wikipedia.org/wiki/Singapore_Indoor_Stadium
-- https://www.pgl.gg/ (fetch failed with HTTP 525 on 2026-11-04; linked as the official homepage only)
-- Real (publicly verifiable): Singapore 2026 runs 25 Nov – 13 Dec 2026 for Counter-Strike 2 (CS2);
-- 32 directly-invited teams by Valve Regional Standings (VRS); US$1,250,000 prize pool (NOT $1.75M);
-- three 16-team Swiss-system stages, then an 8-team single-elimination playoffs; playoffs 10–13 Dec
-- at the Singapore Indoor Stadium; playoff matches are best-of-three except the grand final (best-of-five),
-- plus a first-ever third-place decider before the final; defending champions Team Falcons (won IEM
-- Cologne Major 2026, 3–0 over FURIA); announced 8 Dec 2025 by PGL (PGL's fifth Major after Copenhagen
-- 2024); billed as the first Major in Southeast Asia; Active Duty map pool Ancient/Anubis/Cache/Dust II/
-- Inferno/Mirage/Nuke (Cache replaced Overpass 6 Jul 2026); invite distribution Europe 12/6/6 across
-- Stages 1/2/3, Americas 6/1/2 plus Asia 4/1/0 — cited in FAQs/accordion, not as a guarantee; every
-- invited team was named in Wikipedia's invites table (see guest list). Venue: 2 Stadium Walk,
-- Singapore 397691; coordinates 1.3006, 103.8744; Singapore Indoor Stadium capacity roughly 12,000
-- seated / 15,000 maximum; MRT CC6 Stadium and EW10 Kallang, plus TE23 Tanjong Rhu via sheltered
-- walkways; Singapore Indoor Stadium hosted The International 2022 Dota 2 finals. A new indoor arena
-- (18,000 capacity) is planned to replace the Indoor Stadium, announced Aug 2024 — not the venue here.
-- Starting-point claims checked: late Nov–Dec window CORRECT; Singapore Indoor Stadium CORRECT (final
-- four days only); 32 teams CORRECT; CS2 CORRECT; first Major in Southeast Asia per announcement copy;
-- $1.75M prize pool NOT verified and is NOT used (real figure is $1,250,000).
--
-- INVENTED / EDITORIAL: ALL ticket names, SGD prices, GST-included prices, groupings, bundle price,
-- hospitality packages, and ticketSold counts; capacity 12000 / sold 8470 / revenue 3845000 on the
-- event row, venue standing_capacity 15000, tier quantities [9000, 9000, 9000, 4000, 4000, 3500], sold
-- [6010, 4980, 5230, 890, 760, 620], and all stage dates/times (Opening Stage 5–8 Dec, Elimination
-- Stage 9–10 Dec, Playoffs 11–13 Dec, Grand Final 13 Dec with a 3rd-place decider that afternoon) —
-- plausible demo times labelled "subject to change" on page. The 8 "guests" are real invited teams
-- but their bios/regions/taglines are editorial and do NOT quote any player; flags are region hints
-- only. FAQs Q1–Q8, copy/design, and CTA labels are editorial. Only verified third-party Wikimedia
-- images are used for pure visuals. No PGL logos, no real buy buttons, no real quotes, no real
-- players — the demo must never be mistaken for a real sale (see disclaimer + FAQ #7).
-- Independent public demo, deliberately is_listable=false. Payments disabled; do not submit native
-- ticket/enquiry forms. Official links are supplied for real info.
--
-- IMAGES: verified Commons images (HEAD-checked 2026-11-04, all HTTP 200, image/jpeg with nonzero
-- byte sizes; URL list retained in the provenance block below). Related note: two Commons files in
-- the search results (File:Singapore Indoor Stadium, Dec 05.JPG and File:Singapore Indoor Stadium
-- and Oasis Building, Dec 05.JPG, both "Copyrighted free use") were DELIBERATELY EXCLUDED because
-- they are not freely licensed. Every URL below is a 1280px thumb.wikimedia.org thumbnail except
-- one unscaled original (Entrance to the Singapore Indoor Stadium.jpg, CC BY-SA 2.0) — flagged as
-- unscaled in the provenance. Image source/author/license links are retained in the on-page
-- provenance block.
--
-- LIMITS: no official seat geometry (seat_map pattern in ufc-333-2026.sql is NOT used here because
-- no official Singapore Indoor Stadium esports seating plan was published); no official day-by-day
-- stage dates/times (real window is 25 Nov–13 Dec but exact stage dates are not public on Wikipedia,
-- so demo dates are invented and labelled); no real team invites guarantee (VRS snapshot 2 Nov 2026);
-- payment-disabled checkout still renders payment/Stripe copy; gallery lightbox omits captions; hero
-- omits end date; Add/Share are toast-only in tested build. Those need application changes, outside
-- this data-only task.
--
-- ============================================================================
-- 1. venue row (id matches the event's venue_id)
-- ============================================================================
INSERT INTO events.venues
("id","city","name","type","region","spaces","status","address","country","gallery","website","latitude","metadata","postcode","timezone","amenities","cover_url","longitude","deleted_at","project_id","description","contact_name","contact_email","contact_phone","parking_notes","transit_notes","seated_capacity","standing_capacity")
SELECT "id","city","name","type","region","spaces","status","address","country","gallery","website","latitude","metadata","postcode","timezone","amenities","cover_url","longitude","deleted_at","project_id","description","contact_name","contact_email","contact_phone","parking_notes","transit_notes","seated_capacity","standing_capacity"
FROM jsonb_populate_record(NULL::events.venues, $seed$
{
  "id": "6c5a2026-1205-4e11-8c00-000000000002",
  "city": "Singapore",
  "name": "Singapore Indoor Stadium",
  "type": "Indoor",
  "region": "Kallang",
  "spaces": 1,
  "status": "Active",
  "address": "2 Stadium Walk",
  "country": "Singapore",
  "gallery": [],
  "website": "https://www.sport.gov.sg/",
  "latitude": 1.3006,
  "metadata": {
    "showcase": true,
    "capacityInvented": true,
    "coordinatesNote": "Published venue coordinates (1.3006, 103.8744); not a gate."
  },
  "postcode": "397691",
  "timezone": "Asia/Singapore",
  "amenities": [
    "Wheelchair-accessible seating",
    "First aid",
    "Information counters",
    "Concourse food and beverage",
    "Air-conditioned bowl",
    "Pillarless arena bowl"
  ],
  "cover_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
  "longitude": 103.8744,
  "deleted_at": null,
  "project_id": "ebcc7910-1a0e-4e91-8c3b-752f3c4292d3",
  "description": "The Singapore Indoor Stadium in Kallang — the pillarless indoor arena that will host the PGL Major Singapore 2026 playoffs (10–13 December) and that previously hosted The International 2022 Dota 2 finals. Capacity is roughly 12,000 seated (the 15,000 standing figure below and the event's 12,000 / 8,470 / SGD 3,845,000 numbers are invented demo figures, not promoter data). Archival 1280px Wikimedia Commons photographs; full credits live in the event page's Photography & provenance block.",
  "contact_name": null,
  "contact_email": null,
  "contact_phone": null,
  "parking_notes": "Limited on-site parking at the Sports Hub. Public parking is generally at the Singapore Sports Hub / National Stadium car parks; follow event-day signage. No parking reservation is included in these demo ticket products.",
  "transit_notes": "CC6 Stadium (Stadium Walk) is the closest station; EW10 Kallang and TE23 Tanjong Rhu connect via sheltered walkways to the Sports Hub. Avoid driving on match days — use the MRT and the sheltered walkway network.",
  "seated_capacity": 12000,
  "standing_capacity": 15000
}
$seed$::jsonb)
ON CONFLICT (id) DO UPDATE SET
  "city" = EXCLUDED."city",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "region" = EXCLUDED."region",
  "spaces" = EXCLUDED."spaces",
  "status" = EXCLUDED."status",
  "address" = EXCLUDED."address",
  "country" = EXCLUDED."country",
  "gallery" = EXCLUDED."gallery",
  "website" = EXCLUDED."website",
  "latitude" = EXCLUDED."latitude",
  "metadata" = EXCLUDED."metadata",
  "postcode" = EXCLUDED."postcode",
  "timezone" = EXCLUDED."timezone",
  "amenities" = EXCLUDED."amenities",
  "cover_url" = EXCLUDED."cover_url",
  "longitude" = EXCLUDED."longitude",
  "deleted_at" = EXCLUDED."deleted_at",
  "project_id" = EXCLUDED."project_id",
  "description" = EXCLUDED."description",
  "contact_name" = EXCLUDED."contact_name",
  "contact_email" = EXCLUDED."contact_email",
  "contact_phone" = EXCLUDED."contact_phone",
  "parking_notes" = EXCLUDED."parking_notes",
  "transit_notes" = EXCLUDED."transit_notes",
  "seated_capacity" = EXCLUDED."seated_capacity",
  "standing_capacity" = EXCLUDED."standing_capacity";

-- ============================================================================
-- 2. event row
-- ============================================================================
INSERT INTO events.events
("id","city","name","sold","type","venue","status","address","gallery","revenue","summary","capacity","metadata","timezone","venue_id","cover_url","organizer","series_id","deleted_at","event_date","event_time","project_id","visibility","is_listable")
SELECT "id","city","name","sold","type","venue","status","address","gallery","revenue","summary","capacity","metadata","timezone","venue_id","cover_url","organizer","series_id","deleted_at","event_date","event_time","project_id","visibility","is_listable"
FROM jsonb_populate_record(NULL::events.events, $seed$
{
  "id": "6c5a2026-1205-4e11-8c00-000000000001",
  "city": "Singapore",
  "name": "PGL Major Singapore 2026",
  "sold": 8470,
  "type": "In-person",
  "venue": "Singapore Indoor Stadium",
  "status": "On sale",
  "address": "2 Stadium Walk, Singapore 397691",
  "gallery": [
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
      "type": "image",
      "caption": "Singapore Indoor Stadium · Exec8 · CC BY-SA 4.0 · archival venue photograph"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Singapore_Indoor_Stadium%2C_Aug_07.JPG/1280px-Singapore_Indoor_Stadium%2C_Aug_07.JPG",
      "type": "image",
      "caption": "Singapore Indoor Stadium, 2007 · Sengkang · CC BY-SA 3.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Kallang_Indoor_Stadium_%288151029247%29.jpg/1280px-Kallang_Indoor_Stadium_%288151029247%29.jpg",
      "type": "image",
      "caption": "Kallang Indoor Stadium · Erwin Soo · CC BY 2.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg",
      "type": "image",
      "caption": "Singapore National Stadium from Kallang Footbridge · Exec8 · CC BY-SA 4.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/ESport_IFNG_Munich_20-Nov-11_Stage3.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage3.jpg",
      "type": "image",
      "caption": "Esports stage, Munich 2011 · Peshay159 · CC BY-SA 3.0 · archival LAN image"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/ESport_IFNG_Munich_20-Nov-11_Stage4.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage4.jpg",
      "type": "image",
      "caption": "Esports stage wide, Munich 2011 · Peshay159 · CC BY-SA 3.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/IEM_2015_San_Jose_Day_2_-_17.jpg/1280px-IEM_2015_San_Jose_Day_2_-_17.jpg",
      "type": "image",
      "caption": "IEM 2015 San Jose Day 2 · Kevin Chang for Team Liquid · CC BY-SA 4.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg/1280px-SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg",
      "type": "image",
      "caption": "ESL One Cologne 2016 group stage · VaKarM · CC BY 3.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Merli%C3%B3n%2C_Marina_Bay%2C_Singapur%2C_2023-08-18%2C_DD_45-47_HDR.jpg/1280px-Merli%C3%B3n%2C_Marina_Bay%2C_Singapur%2C_2023-08-18%2C_DD_45-47_HDR.jpg",
      "type": "image",
      "caption": "Marina Bay at dusk, Merlion, 2023 · Diego Delso · CC BY-SA 4.0 · city context"
    },
    {
      "url": "https://upload.wikimedia.org/wikipedia/commons/6/64/Entrance_to_the_Singapore_Indoor_Stadium.jpg",
      "type": "image",
      "caption": "Entrance to the Singapore Indoor Stadium · William Cho · CC BY-SA 2.0 · unscaled original"
    }
  ],
  "revenue": 3845000,
  "summary": "25 Nov – 13 Dec 2026: the first CS2 Major in Southeast Asia — 32 invited teams, US$1.25M prize pool, three Swiss stages and playoffs at Singapore Indoor Stadium. Independent showcase; do not buy here.",
  "capacity": 12000,
  "metadata": {
    "faq": [
      {
        "q": "When is the Major, and where?",
        "a": "The real window is **25 November to 13 December 2026**, with the **final four days (10–13 December) at Singapore Indoor Stadium, 2 Stadium Walk, 397691**. Early Swiss stages may not all be arena shows; this page shows an invented demo schedule (Opening 5–8 Dec, Playoffs 11–13 Dec) labelled 'subject to change' — check PGL for the official day-by-day."
      },
      {
        "q": "What format does the Major use?",
        "a": "**32 directly-invited teams** by Valve Regional Standings (VRS). Three **16-team Swiss-system stages** (8 teams advance from each) then an **8-team single-elimination playoffs**. Playoff matches are **best-of-three** except the **grand final (best-of-five)**, plus a **first-ever third-place decider** before the final."
      },
      {
        "q": "What is the prize pool?",
        "a": "**US$1,250,000** — published in the tournament infobox. One early draft of this seed used an invented SGD $1,750,000; that figure appears nowhere real and is not used. Currency here: the app prints '$' but ticket prices on this page are **SGD including 9% GST**."
      },
      {
        "q": "Who are the defending champions?",
        "a": "**Team Falcons** — they won the IEM Cologne Major 2026 **3–0 over FURIA Esports**. PGL's Singapore 2026 is their first Major to defend. Falcons are also listed in the Stage 3 invite bracket on Wikipedia."
      },
      {
        "q": "Is this the first Major in Southeast Asia?",
        "a": "Yes — PGL's announcement (8 December 2025) billed it as the **first Major in Southeast Asia**. The region's Stage 1 pool includes **BC.Game Esports, FlyQuest, Chinggis Warriors and Lynn Vision**, with **The MongolZ** invited to Stage 2."
      },
      {
        "q": "What map pool will they play?",
        "a": "The Active Duty pool is **Ancient, Anubis, Cache, Dust II, Inferno, Mirage and Nuke**. Cache replaced Overpass in the pool on **6 July 2026** (Valve announced 22 June 2026)."
      },
      {
        "q": "Is this page selling real tickets?",
        "a": "No. This is an **independent Geiger Events demonstration**. **Payment is disabled**, ticket prices are invented demo SGD, and counts are invented. Use the **official PGL site (pgl.gg)** and **[Liquipedia](https://liquipedia.net/counterstrike/PGL/Major/2026)** for real info. Do not submit personal details here."
      },
      {
        "q": "How do I get to the Indoor Stadium?",
        "a": "Take **CC6 Stadium** (closest) or **EW10 Kallang** / **TE23 Tanjong Rhu** and follow the sheltered walkways to the Sports Hub. Driving is discouraged on event days; see the venue's transit notes on this page."
      }
    ],
    "map": {
      "coords": {
        "lat": 1.3006,
        "lng": 103.8744
      },
      "transport": "CC6 Stadium (closest) plus EW10 Kallang and TE23 Tanjong Rhu via sheltered walkways to the Sports Hub. The map pin is the published venue coordinate, not a specific gate.",
      "parking": "Very limited on-site parking at the Sports Hub on event days; public parking at the National Stadium car parks. No parking reservation is included in these demo ticket products."
    },
    "ctas": {
      "items": [
        {
          "id": "official",
          "url": "https://www.pgl.gg/",
          "label": "Official PGL site (info only)",
          "style": "primary"
        },
        {
          "id": "liquipedia",
          "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
          "label": "Liquipedia — bracket & teams",
          "style": "outline"
        },
        {
          "id": "hltv",
          "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
          "label": "HLTV — results & rankings",
          "style": "ghost"
        }
      ],
      "primaryLabel": "Preview ticket form"
    },
    "rsvp": {
      "waitlist": false,
      "requireApproval": false,
      "blockWaitlistedRebook": false
    },
    "tags": [
      "25 Nov–13 Dec 2026",
      "Counter-Strike 2",
      "32 invited teams",
      "US$1.25M prize pool",
      "Southeast Asia"
    ],
    "guests": [
      {
        "id": "g1",
        "bio": "Defending Major champions (Cologne 2026, 3–0 over FURIA). Editorial demo bio; no player quotes.",
        "name": "🇪🇺 Team Falcons",
        "role": "Stage 3 invite · Europe",
        "company": "Defending champions",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/IEM_2015_San_Jose_Day_2_-_17.jpg/1280px-IEM_2015_San_Jose_Day_2_-_17.jpg"
      },
      {
        "id": "g2",
        "bio": "Back-to-back 2025 Major winners (Austin + Budapest) heading into 2026. Editorial demo bio.",
        "name": "🇪🇺 Team Vitality",
        "role": "Stage 3 invite · Europe",
        "company": "Three-time Major winners",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg/1280px-SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg"
      },
      {
        "id": "g3",
        "bio": "Three-time Major winners invited directly to Stage 3. Editorial demo bio.",
        "name": "🇪🇺 MOUZ",
        "role": "Stage 3 invite · Europe",
        "company": "Europe Stage 3",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/ESport_IFNG_Munich_20-Nov-11_Stage3.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage3.jpg"
      },
      {
        "id": "g4",
        "bio": "One-time Major winners aiming for a second title in Singapore. Editorial demo bio.",
        "name": "🇪🇺 FaZe Clan",
        "role": "Stage 1 invite · Europe",
        "company": "Challenger path",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/ESport_IFNG_Munich_20-Nov-11_Stage4.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage4.jpg"
      },
      {
        "id": "g5",
        "bio": "Two-time Major winners from the 2024–2025 cycles. Editorial demo bio.",
        "name": "🇪🇺 Team Spirit",
        "role": "Stage 3 invite · Europe",
        "company": "Europe Stage 3",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/IEM_2015_San_Jose_Day_2_-_17.jpg/1280px-IEM_2015_San_Jose_Day_2_-_17.jpg"
      },
      {
        "id": "g6",
        "bio": "Austin 2025 finalists — one of Asia-Pacific's strongest lines in 2025. Editorial demo bio.",
        "name": "🇲🇳 The MongolZ",
        "role": "Stage 2 invite · Asia",
        "company": "Asia-Pacific Stage 2",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg"
      },
      {
        "id": "g7",
        "bio": "Long-standing European top-16 side entering via Stage 1. Editorial demo bio.",
        "name": "🇪🇺 HEROIC",
        "role": "Stage 1 invite · Europe",
        "company": "Challenger path",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Kallang_Indoor_Stadium_%288151029247%29.jpg/1280px-Kallang_Indoor_Stadium_%288151029247%29.jpg"
      },
      {
        "id": "g8",
        "bio": "One of China's most notable invited teams in this VRS snapshot. Editorial demo bio.",
        "name": "🇨🇳 TYLOO",
        "role": "Not listed in 2 Nov 2026 snapshot — shown as a qualified-team placeholder",
        "company": "Asia (invite via earlier cycle)",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Singapore_Indoor_Stadium%2C_Aug_07.JPG/1280px-Singapore_Indoor_Stadium%2C_Aug_07.JPG"
      }
    ],
    "bundles": [
      {
        "id": "playoffs-wknd",
        "name": "Playoffs Weekend Bundle",
        "items": [
          {
            "qty": 1,
            "ticketId": "gs-fri"
          },
          {
            "qty": 1,
            "ticketId": "gs-sat"
          },
          {
            "qty": 1,
            "ticketId": "gs-sun"
          }
        ],
        "price": 798,
        "enabled": true,
        "description": "SGD 798 incl. GST · Fri 11 + Sat 12 + Sun 13 Dec (demo). One admission per day for the same guest across the playoffs weekend. Not 3 guests on one day; the Sun includes the demo third-place decider + Grand Final.",
        "pricingMode": "fixed"
      }
    ],
    "tickets": [
      {
        "id": "opening-2d",
        "qty": 9000,
        "name": "Opening Stage — 2-Day Pass",
        "price": 168,
        "groupId": "opening",
        "description": "SGD · GST included · demo authoring · Opening Swiss stage (invented demo dates) · general admission. Demo inventory; book officially via PGL."
      },
      {
        "id": "gs-fri",
        "qty": 9000,
        "name": "Grandstand Single Day — Fri",
        "price": 288,
        "groupId": "grandstand",
        "description": "SGD · GST included · Fri (demo) · playoffs lower-bowl grandstand. Demo inventory."
      },
      {
        "id": "gs-sat",
        "qty": 9000,
        "name": "Grandstand Single Day — Sat",
        "price": 328,
        "groupId": "grandstand",
        "description": "SGD · GST included · Sat (demo) · semifinals. Demo inventory."
      },
      {
        "id": "gs-sun",
        "qty": 9000,
        "name": "Grandstand Single Day — Sun",
        "price": 388,
        "groupId": "grandstand",
        "description": "SGD · GST included · Sun (demo) · 3rd-place decider + Grand Final. Demo inventory."
      },
      {
        "id": "prem-gs",
        "qty": 4000,
        "name": "Premium Grandstand — Playoffs 3-Day",
        "price": 1288,
        "groupId": "premium",
        "description": "SGD · GST included · Fri–Sun (demo) · premium lower-bowl, best sightlines. Demo inventory."
      },
      {
        "id": "vip-3d",
        "qty": 3500,
        "name": "VIP Hospitality — 3-Day",
        "price": 2888,
        "groupId": "vip",
        "description": "SGD · GST included · Fri–Sun (demo) · hospitality centre with food & beverage; this tier is also offered as an enquire-mode package below. Demo inventory."
      }
    ],
    "packages": {
      "intro": "Hospitality is an enquire-mode preview only — no real booking happens on this page.",
      "items": [
        {
          "id": "vip-hosp",
          "mode": "enquire",
          "name": "VIP Hospitality · 3-Day Playoffs",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
          "price": 2888,
          "stock": null,
          "details": "SGD 2,888 incl. GST (demo). Fri–Sun 11–13 Dec (invented demo dates). Archive venue photo by Exec8, CC BY-SA 4.0 — not a photograph of the hospitality area. Use the official PGL link for real enquiries.",
          "tagline": "Hospitality centre · 11–13 Dec (demo)",
          "visible": true,
          "ctaLabel": "Preview enquiry fields",
          "inclusions": [
            {
              "id": "o1",
              "icon": "access",
              "text": "Premium grandstand seat for all 3 playoff days"
            },
            {
              "id": "o2",
              "icon": "hospitality",
              "text": "Hospitality centre food & beverage (licensed)"
            },
            {
              "id": "o3",
              "icon": "star",
              "text": "Player meet-and-greet lounge access (demo)"
            },
            {
              "id": "o4",
              "icon": "location",
              "text": "Dedicated VIP entrance & concierge"
            }
          ],
          "priceSuffix": " SGD / person · 3 days"
        },
        {
          "id": "prem-hosp",
          "mode": "enquire",
          "name": "Premium Lounge · Playoffs 3-Day",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg",
          "price": 1688,
          "stock": null,
          "details": "SGD 1,688 incl. GST (demo). Premium lower-bowl + lounge snacks. Archive Kallang photo by Exec8, CC BY-SA 4.0 — not a lounge interior. Use the official PGL link for real enquiries.",
          "tagline": "Premium bowl + lounge · 11–13 Dec (demo)",
          "visible": true,
          "ctaLabel": "Preview enquiry fields",
          "inclusions": [
            {
              "id": "i1",
              "icon": "access",
              "text": "Premium grandstand seat"
            },
            {
              "id": "i2",
              "icon": "hospitality",
              "text": "Lounge snacks & beverage package"
            },
            {
              "id": "i3",
              "icon": "star",
              "text": "Exclusive merch pack (demo)"
            }
          ],
          "priceSuffix": " SGD / person · 3 days"
        }
      ]
    },
    "payments": {
      "enabled": false
    },
    "schedule": [
      {
        "by": "Opening Stage · 16 teams (Swiss)",
        "id": "s1",
        "time": "12:00–21:00",
        "frame": "card",
        "title": "Dec 5 (demo) · Opening Stage Day 1",
        "layout": "timeline",
        "spacing": "normal",
        "description": "Swiss rounds 1–2: 8 teams advance, 8 eliminated. Demo times; may not be an arena show.",
        "sectionNote": "Invented demo stage times (Dec 5–13) labelled 'subject to change'. Real window is 25 Nov–13 Dec 2026; exact stage dates are not public on Wikipedia."
      },
      {
        "by": "Opening Stage (Swiss)",
        "id": "s2",
        "time": "12:00–21:00",
        "title": "Dec 6 (demo) · Opening Stage Day 2",
        "description": "Swiss rounds continue. Real dates/times unconfirmed."
      },
      {
        "by": "Opening Stage (Swiss)",
        "id": "s3",
        "time": "12:00–21:00",
        "title": "Dec 7–8 (demo) · Opening Stage Deciders",
        "description": "Best-of-three progression/elimination matches decide the 8 advancing teams."
      },
      {
        "by": "Elimination Stage · Stage 2 (Swiss)",
        "id": "s4",
        "time": "12:00–21:00",
        "title": "Dec 9 (demo) · Stage 2 Day 1",
        "description": "Team Falcons / Vitality path — demo schedule."
      },
      {
        "by": "Singapore Indoor Stadium (playoffs)",
        "id": "s5",
        "time": "14:00–21:00",
        "title": "Dec 11 (demo) · Quarterfinals",
        "description": "Best-of-three quarterfinals. Real playoffs are 10–13 Dec at the Indoor Stadium."
      },
      {
        "by": "Singapore Indoor Stadium (playoffs)",
        "id": "s6",
        "time": "14:00–21:00",
        "title": "Dec 12 (demo) · Semifinals",
        "description": "Best-of-three semifinals."
      },
      {
        "by": "Singapore Indoor Stadium (playoffs)",
        "id": "s7",
        "time": "12:00–16:00",
        "title": "Dec 13 (demo) · Third-Place Decider — FIRST EVER",
        "description": "New format element: a decider match for third place before the final (announced by PGL)."
      },
      {
        "by": "Singapore Indoor Stadium (playoffs)",
        "id": "s8",
        "time": "17:00–22:00",
        "title": "Dec 13 (demo) · GRAND FINAL — Best-of-Five",
        "description": "The $1,250,000 champion is crowned. Demo time; official start TBA."
      }
    ],
    "languages": [
      {
        "code": "en",
        "name": "English",
        "isDefault": true
      },
      {
        "code": "zh",
        "name": "Chinese (Simplified)",
        "isDefault": false
      }
    ],
    "questions": [
      {
        "id": "demo-dietary",
        "type": "long",
        "label": "Dietary requirements — optional demo field; not sent to PGL",
        "required": false
      },
      {
        "id": "demo-access",
        "type": "long",
        "label": "Accessibility questions — optional demo field; arrange access with the venue box office",
        "required": false
      },
      {
        "id": "demo-ack",
        "type": "checkbox",
        "label": "I understand this is a showcase, not a valid ticket booking",
        "required": true
      }
    ],
    "disclaimer": {
      "text": "INDEPENDENT PRODUCT SHOWCASE — not an official PGL sales page. No tickets are issued here; online payment is disabled. All $ prices are Singapore dollars (SGD), including 9% GST, invented for demonstration (researched 4 November 2026). The 12,000 capacity, 8,470 going and remaining-ticket counts are invented demo figures. Photographs are archival Wikimedia Commons venue/LAN/city images, not photos of this future event. Stage dates/times are invented demo placeholders (subject to change) within the real 25 Nov–13 Dec 2026 window. Use the official links to book.",
      "enabled": true,
      "placements": [
        "top",
        "content",
        "checkout-top",
        "checkout-pay"
      ]
    },
    "guidelines": [
      {
        "id": "a1",
        "label": "Wheelchair-accessible seating",
        "detail": "Singapore Indoor Stadium offers wheelchair-accessible seating. Contact the venue box office to arrange specific accessible seats; do not substitute a general-admission ticket.",
        "category": "accessibility"
      },
      {
        "id": "a2",
        "label": "Plan an accessible route",
        "detail": "Use CC6 Stadium MRT (closest) with step-free access via the Stadium Walk entrance and sheltered walkways. Check current MRT lift status before travelling.",
        "category": "accessibility"
      },
      {
        "id": "a3",
        "label": "Bag policy",
        "detail": "Bags must fit under the seat or in the venue's bag-size limit. Oversized bags may be refused at the gate; there is no cloakroom on event days.",
        "category": "safety"
      },
      {
        "id": "a4",
        "label": "No re-entry after exit",
        "detail": "Once you exit the arena bowl, re-entry requires a scan of your ticket. Keep your ticket handy for the 3rd-place decider + Grand Final double-header.",
        "category": "safety"
      },
      {
        "id": "a5",
        "label": "Alcohol (21+) in hospitality",
        "detail": "Hospitality beverage service is licensed and 21+ only. Standard grandstand tickets do not include hospitality food/beverage.",
        "category": "dietary"
      }
    ],
    "highlights": [
      {
        "id": "h1",
        "title": "First Major in Southeast Asia",
        "detail": "25 Nov–13 Dec 2026, CS2, 32 invited teams by VRS."
      },
      {
        "id": "h2",
        "title": "US$1,250,000 prize pool",
        "detail": "Published in the tournament infobox (not $1.75M)."
      },
      {
        "id": "h3",
        "title": "Three Swiss stages",
        "detail": "16 → 16 → 16 teams; 8 advance from each Swiss stage."
      },
      {
        "id": "h4",
        "title": "Best-of-five Grand Final",
        "detail": "Playoffs at Singapore Indoor Stadium; first-ever 3rd-place decider."
      }
    ],
    "pageDesign": {
      "mode": "themed",
      "theme": {
        "base": "dark",
        "font": {
          "body": "sans",
          "scale": "md",
          "heading": "grotesk"
        },
        "hero": "classic",
        "cover": "accent",
        "width": "wide",
        "button": "solid",
        "colors": {
          "bg": "#070a12",
          "link": "#22d3ee",
          "text": "#e8eaf0",
          "brand": "#22d3ee",
          "muted": "#9aa4b8",
          "accent": "#e879f9",
          "border": "#1e293b",
          "surface": "#0d1322",
          "brandText": "#061018",
          "brandHover": "#67e8f9"
        },
        "header": {
          "cta": {
            "url": "https://www.pgl.gg/",
            "label": "Official PGL info"
          },
          "show": true,
          "links": [
            {
              "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
              "label": "Liquipedia bracket"
            },
            {
              "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
              "label": "HLTV results"
            },
            {
              "url": "https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026",
              "label": "Wikipedia overview"
            }
          ],
          "border": true,
          "sticky": true
        },
        "layout": "classic",
        "radius": "rounded",
        "source": {
          "url": "https://www.pgl.gg/",
          "siteName": "Independent Geiger showcase"
        },
        "density": "comfortable",
        "sidebar": "right",
        "tagline": "25 Nov–13 Dec · First CS2 Major in Southeast Asia · Singapore Indoor Stadium",
        "radiusPx": 12,
        "elevation": "subtle",
        "background": {
          "type": "gradient"
        },
        "borderWidth": 1,
        "footerStyle": {
          "text": "#c9d1de",
          "background": "#04060c"
        },
        "buttonWeight": "600",
        "coverOverlay": "scrim",
        "headingWeight": "bold",
        "buttonRadiusPx": 8
      },
      "blocks": [
        {
          "id": "about",
          "type": "about",
          "visible": true
        },
        {
          "id": "expect",
          "type": "expect",
          "visible": true
        },
        {
          "id": "editorial-heading",
          "type": "heading",
          "props": {
            "text": "Three Swiss stages. One arena final."
          },
          "visible": true
        },
        {
          "id": "editorial-columns",
          "type": "columns",
          "props": {
            "align": "center",
            "ratio": "1:1",
            "leftUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
            "leftKind": "image",
            "rightKind": "text",
            "rightText": "### How the Major works\n\n- **Stage 1:** 16 invited teams (Swiss) — 8 advance, 8 out.\n- **Stage 2:** 16 teams (Swiss) — 8 advance.\n- **Stage 3:** 16 teams (Swiss, all Bo3) — 8 advance.\n- **Playoffs:** 8-team single-elimination, Bo3 except the **Bo5 Grand Final**.\n- **NEW:** first-ever **3rd-place decider** before the final.\n\nThe arena photo shows Singapore Indoor Stadium (Exec8, CC BY-SA 4.0).",
            "leftCaption": "Singapore Indoor Stadium · Exec8 · CC BY-SA 4.0. Archival venue photo; not the 2026 set."
          },
          "visible": true
        },
        {
          "id": "schedule",
          "type": "schedule",
          "visible": true
        },
        {
          "id": "schedule-links",
          "type": "buttons",
          "props": {
            "items": [
              {
                "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
                "label": "Bracket & teams (Liquipedia)",
                "style": "solid"
              },
              {
                "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
                "label": "Results & rankings (HLTV)",
                "style": "outline"
              }
            ]
          },
          "visible": true
        },
        {
          "id": "guests",
          "type": "guests",
          "visible": true
        },
        {
          "id": "location",
          "type": "location",
          "visible": true
        },
        {
          "id": "location-image",
          "type": "image",
          "props": {
            "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg",
            "caption": "Singapore National Stadium from Kallang Footbridge · Exec8 · CC BY-SA 4.0. Historical Kallang photograph."
          },
          "visible": true
        },
        {
          "id": "guide-embed",
          "type": "embed",
          "props": {
            "code": "<aside aria-label='Official resources' style='border:1px solid #334155;padding:24px;border-radius:12px'><h3>Official PGL info</h3><p>Format, invites and schedules: check PGL and Liquipedia. This page is an independent demo.</p><a href='https://www.pgl.gg/' target='_blank' rel='noopener noreferrer'>Open PGL ↗</a> · <a href='https://liquipedia.net/counterstrike/PGL/Major/2026' target='_blank' rel='noopener noreferrer'>Liquipedia ↗</a></aside>"
          },
          "visible": true
        },
        {
          "id": "whosgoing",
          "type": "whosgoing",
          "visible": true
        },
        {
          "id": "inventory-note",
          "type": "text",
          "props": {
            "text": "Demo inventory, not a real gate report: 8,470 going / 12,000 capacity. The ticket-level stock is an illustrative allocation; actual sales and availability are not inferred from these numbers."
          },
          "layout": {
            "align": "left",
            "width": "full",
            "background": "surface"
          },
          "visible": true
        },
        {
          "id": "faq",
          "type": "faq",
          "visible": true
        },
        {
          "id": "policy-accordion",
          "type": "accordion",
          "props": {
            "items": [
              {
                "a": "Demo SGD prices incl. GST: Opening 2-Day **168**, Grandstand Fri **288** / Sat **328** / Sun **388**, Premium 3-Day **1,288**, VIP 3-Day **2,888**, Playoffs Weekend Bundle **798**. All invented; availability may change.",
                "q": "Published price snapshot (demo)"
              },
              {
                "a": "VRS snapshot 2 Nov 2026: Europe 12 Stage-1 invites (6+6 to Stages 2/3), Americas 6/1/2, Asia 4/1/0. Stage 3 headliners: Falcons, Vitality, MOUZ, Spirit, Aurora, BetBoom, FURIA, Legacy. See Liquipedia for the live table.",
                "q": "Invite distribution (real)"
              },
              {
                "a": "Read PGL's terms and privacy policy on pgl.gg before any real purchase. Liquipedia and HLTV are community references, not sellers.",
                "q": "Official conditions"
              }
            ],
            "title": "Before you book"
          },
          "visible": true
        },
        {
          "id": "breathing-room",
          "type": "spacer",
          "props": {
            "size": "sm"
          },
          "visible": true
        },
        {
          "id": "official-cta",
          "type": "cta",
          "props": {
            "url": "https://www.pgl.gg/",
            "label": "Check official PGL info",
            "title": "Ready for the first Southeast Asia Major?"
          },
          "visible": true
        },
        {
          "id": "credits-divider",
          "type": "divider",
          "visible": true
        },
        {
          "id": "credits",
          "type": "richtext",
          "props": {
            "text": "## Photography & provenance\n\nAll photographs are archival, resized and CSS-cropped. No image depicts this future event. Credits apply to every reuse on this page, including cover, gallery, schedule, team and hospitality cards. No PGL logos, no official team photos, no real player portraits are used.\n\n- [Singapore Indoor Stadium](https://commons.wikimedia.org/wiki/File:Singapore_Indoor_Stadium.jpg) — Exec8, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Singapore Indoor Stadium, Aug 07](https://commons.wikimedia.org/wiki/File:Singapore_Indoor_Stadium,_Aug_07.JPG) — Sengkang, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [Kallang Indoor Stadium (8151029247)](https://commons.wikimedia.org/wiki/File:Kallang_Indoor_Stadium_(8151029247).jpg) — Erwin Soo, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [Singapore National Stadium from Kallang Footbridge](https://commons.wikimedia.org/wiki/File:Singapore_National_Stadium_from_Kallang_Footbridge.jpg) — Exec8, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Entrance to the Singapore Indoor Stadium (unscaled original)](https://commons.wikimedia.org/wiki/File:Entrance_to_the_Singapore_Indoor_Stadium.jpg) — William Cho, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).\n- [Esport IFNG Munich Stage3](https://commons.wikimedia.org/wiki/File:ESport_IFNG_Munich_20-Nov-11_Stage3.jpg) — Peshay159, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [Esport IFNG Munich Stage4](https://commons.wikimedia.org/wiki/File:ESport_IFNG_Munich_20-Nov-11_Stage4.jpg) — Peshay159, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [IEM 2015 San Jose Day 2 – 17](https://commons.wikimedia.org/wiki/File:IEM_2015_San_Jose_Day_2_-_17.jpg) — Kevin Chang for Team Liquid, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [SK Gaming vs. G2 Esports – ESL One Cologne 2016 groups](https://commons.wikimedia.org/wiki/File:SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg) — VaKarM, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).\n- [Merlión, Marina Bay, Singapur, 2023-08-18](https://commons.wikimedia.org/wiki/File:Merli%C3%B3n,_Marina_Bay,_Singapur,_2023-08-18,_DD_45-47_HDR.jpg) — Diego Delso, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n\nFacts: [PGL Major Singapore 2026 (Wikipedia)](https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026), [Counter-Strike Major Championships (Wikipedia)](https://en.wikipedia.org/wiki/Counter-Strike_Major_Championships), [Singapore Indoor Stadium (Wikipedia)](https://en.wikipedia.org/wiki/Singapore_Indoor_Stadium), [PGL](https://www.pgl.gg/), [Liquipedia bracket](https://liquipedia.net/counterstrike/PGL/Major/2026), [HLTV event](https://www.hltv.org/events/8502/pgl-major-singapore-2026/). Independent Geiger showcase; PGL, Valve and Counter-Strike names belong to their respective owners. Capacity, sales, prices and schedule times are invented demo data."
          },
          "visible": true
        }
      ],
      "footer": {
        "text": "Independent reference page. PGL, Valve and Counter-Strike names belong to their respective owners. No affiliation or endorsement. Archival photographs credited above; capacity, sales, prices and schedule times are demo data.",
        "links": [
          {
            "url": "https://www.pgl.gg/",
            "label": "PGL official site"
          },
          {
            "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
            "label": "Liquipedia"
          },
          {
            "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
            "label": "HLTV"
          }
        ],
        "socials": [
          {
            "url": "https://www.pgl.gg/",
            "platform": "instagram"
          },
          {
            "url": "https://www.youtube.com/@pglesports",
            "platform": "youtube"
          },
          {
            "url": "https://www.twitch.tv/pglesports",
            "platform": "twitch"
          }
        ],
        "showBranding": true
      },
      "viewerMode": "dark",
      "showGallery": true,
      "sidebarBlocks": [
        {
          "id": "register",
          "type": "register",
          "visible": true
        },
        {
          "id": "goodtoknow",
          "type": "goodtoknow",
          "visible": true
        },
        {
          "id": "atregistration",
          "type": "atregistration",
          "visible": true
        },
        {
          "id": "guidelines",
          "type": "guidelines",
          "visible": true
        },
        {
          "id": "help",
          "type": "cta",
          "props": {
            "url": "https://www.pgl.gg/",
            "label": "Official PGL info",
            "title": "Ticket or access questions?"
          },
          "visible": true
        }
      ]
    },
    "ticketSold": {
      "opening-2d": 6010,
      "gs-fri": 4980,
      "gs-sat": 5230,
      "gs-sun": 890,
      "prem-gs": 760,
      "vip-3d": 620
    },
    "description": "## The first CS2 Major in Southeast Asia. 32 teams. One arena.\n\nFrom **25 November to 13 December 2026**, PGL brings the Counter-Strike 2 Major to Singapore — the fifth Major organised by PGL, after Copenhagen 2024. The **playoffs (10–13 December)** are held at the **Singapore Indoor Stadium** in Kallang, the pillarless arena that hosted The International 2022 Dota 2 finals.\n\n**32 directly-invited teams** (by Valve Regional Standings) fight through **three 16-team Swiss-system stages** — 8 advance from each — into an **8-team single-elimination playoffs**. Playoff matches are best-of-three except the **grand final (best-of-five)**. And for the first time ever, there is a **third-place decider** before the final.\n\nThe **Active Duty map pool** is Ancient, Anubis, Cache (new — replaced Overpass in July 2026), Dust II, Inferno, Mirage and Nuke. The **prize pool is US$1,250,000**. Defending champions **Team Falcons** (Cologne 2026, 3–0 over FURIA) headline a Stage 3 pool that also includes Vitality, MOUZ, Spirit and Aurora.\n\n**Independent Geiger Events showcase:** facts are reproduced for reference; ticket names, SGD prices, quantities, hospitality packages and schedule times are invented demonstration figures. The form below is a UI preview, not a PGL booking. Real information belongs on the [official PGL website](https://www.pgl.gg/), [Liquipedia](https://liquipedia.net/counterstrike/PGL/Major/2026) and [HLTV](https://www.hltv.org/events/8502/pgl-major-singapore-2026/).",
    "regSettings": {
      "showRemaining": true
    },
    "ticketRules": {
      "bundles": true,
      "donation": false,
      "earlybird": false,
      "groupPurchase": false
    },
    "infographics": [
      {
        "id": "info-carousel",
        "type": "carousel",
        "props": {
          "mode": "row",
          "items": [
            {
              "link": "https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026",
              "text": "Stage 1 · 25 Nov–early Dec (guess). 8 advance.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/ESport_IFNG_Munich_20-Nov-11_Stage3.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage3.jpg",
              "title": "Stage 1 · 16 teams",
              "ctaLabel": "Format on Wikipedia"
            },
            {
              "link": "https://liquipedia.net/counterstrike/PGL/Major/2026",
              "text": "Stages 2–3 · Falcons / Vitality enter here.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/IEM_2015_San_Jose_Day_2_-_17.jpg/1280px-IEM_2015_San_Jose_Day_2_-_17.jpg",
              "title": "Stages 2–3 · 32 teams total",
              "ctaLabel": "Liquipedia bracket"
            },
            {
              "link": "https://en.wikipedia.org/wiki/Singapore_Indoor_Stadium",
              "text": "10–13 Dec · Bo5 final + first-ever 3rd-place decider.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
              "title": "Playoffs · Indoor Stadium",
              "ctaLabel": "Venue info"
            }
          ],
          "title": "Three stages at a glance",
          "autoplay": false
        }
      },
      {
        "id": "info-split",
        "type": "split",
        "props": {
          "text": "Singapore Indoor Stadium (2 Stadium Walk, 397691) seats roughly 12,000 and is served by CC6 Stadium MRT. It hosted The International 2022 and will host the Major playoffs. Archival photo by Exec8 (CC BY-SA 4.0) — not the 2026 set.",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
          "title": "The arena",
          "ctaUrl": "https://en.wikipedia.org/wiki/Singapore_Indoor_Stadium",
          "ctaLabel": "Read about the venue",
          "imageSide": "left"
        }
      },
      {
        "id": "info-quotes",
        "type": "quotes",
        "props": {
          "items": [
            {
              "name": "PGL (via Wikipedia, 8 Dec 2025)",
              "role": "Singapore 2026 announcement",
              "quote": "The event will take place between November 25 and December 13, 2026, bringing together 32 of the world's best teams… The final four days will take place in the Singapore Indoor [Stadium]."
            },
            {
              "name": "PGL (2026 format note)",
              "role": "3rd-place decider introduction",
              "quote": "For the first time, the Major will feature a decider match for third-place."
            }
          ],
          "title": "From the organiser's published guidance",
          "columns": 2
        }
      },
      {
        "id": "info-showcase",
        "type": "showcase",
        "props": {
          "items": [
            {
              "link": "https://www.pgl.gg/",
              "text": "Single-day grandstand from SGD 288 (demo)",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/ESport_IFNG_Munich_20-Nov-11_Stage4.jpg/1280px-ESport_IFNG_Munich_20-Nov-11_Stage4.jpg",
              "title": "Grandstand",
              "details": "Fri 288 / Sat 328 / Sun 388 (demo, GST included). Lower-bowl arena seats for the playoffs. Archival LAN photo, not a seat preview.",
              "ctaLabel": "Official PGL info"
            },
            {
              "link": "https://www.pgl.gg/",
              "text": "VIP hospitality SGD 2,888 (demo, enquire only)",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
              "title": "VIP Hospitality",
              "details": "3-day Fri–Sun (demo). Premium seat + hospitality centre F&B. Archive venue photo, not a hospitality interior. Enquire-mode preview only.",
              "ctaLabel": "Official PGL info"
            }
          ],
          "title": "Choose the experience (demo)",
          "columns": 2,
          "clickOpen": true
        }
      },
      {
        "id": "info-footer",
        "type": "footer",
        "props": {
          "note": "Research snapshot: 4 November 2026. Stage dates/times, prices and availability are demo placeholders. Not an official PGL microsite.",
          "items": [
            {
              "link": "https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026",
              "title": "Wikipedia overview",
              "ctaLabel": "Read"
            },
            {
              "link": "https://liquipedia.net/counterstrike/PGL/Major/2026",
              "title": "Liquipedia",
              "ctaLabel": "Bracket"
            },
            {
              "link": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
              "title": "HLTV",
              "ctaLabel": "Results"
            },
            {
              "link": "https://en.wikipedia.org/wiki/Singapore_Indoor_Stadium",
              "title": "Venue",
              "ctaLabel": "Plan"
            }
          ],
          "title": "Keep the official resources close"
        }
      }
    ],
    "packagesPage": {
      "title": "Three days of arena hospitality",
      "enabled": true,
      "subtitle": "11–13 December 2026 (demo) · Independent showcase · SGD including GST",
      "introBody": "Two enquire-mode hospitality previews with premium grandstand seats and a lounge (F&B in the VIP tier). This is a demonstration page: do not submit personal details or attempt payment. Photos show the venue and the city, not the hospitality areas. Real accessibility and travel info is in the venue's parking/transit notes on the main event page.",
      "pitchBody": "The playoffs at Singapore Indoor Stadium are the arena phase of the Major — the Bo5 Grand Final and the first-ever third-place decider land on the same Sunday. Prices are an invented demo snapshot. Venue photo credit: Exec8, CC BY-SA 4.0; Kallang photo credit: Exec8, CC BY-SA 4.0. Full source and license links are in the main event page's Photography & provenance section.",
      "pitchImage": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
      "gridHeading": "Published options (demo)",
      "introHeading": "VIP Hospitality (enquire)",
      "introLinkUrl": "https://www.pgl.gg/",
      "leadsConsent": "I understand this showcase is not an official booking or enquiry channel.",
      "leadsEnabled": true,
      "leadsHeading": "Demo enquiry form — not sent to PGL; please do not submit",
      "pitchEnabled": true,
      "pitchHeading": "Watch the decider, then the final",
      "pitchCtaLabel": "Compare the two options",
      "introLinkLabel": "Official PGL info & booking",
      "leadsRecipient": ""
    },
    "sectionNotes": [
      {
        "text": "Source: Wikipedia PGL Major Singapore 2026 (researched 4 Nov 2026) + Singapore Indoor Stadium venue page.",
        "target": "about"
      },
      {
        "text": "32 teams / US$1.25M / Bo5 final / 3rd-place decider are published format facts, not demo metrics.",
        "target": "expect"
      },
      {
        "text": "INVENTED demo days/times (Dec 5–13) within the real 25 Nov–13 Dec window. All times SGT (UTC+8). Subject to change.",
        "target": "schedule"
      },
      {
        "text": "Published venue coordinates (1.3006, 103.8744); not a gate. Use CC6/TE23/EW10 MRT directions.",
        "target": "location"
      },
      {
        "text": "INVENTED DEMO DATA: 8,470 going; capacity 12,000. No real attendee records were created.",
        "target": "whosgoing"
      },
      {
        "text": "Invited-team names are real; bios/regions/taglines are editorial demo copy. No player quotes. Photos are archival Commons images.",
        "target": "guests"
      },
      {
        "text": "Summarised from Wikipedia's Singapore 2026 article, the Major Championships overview and the Indoor Stadium page; prize/formats are cited facts.",
        "target": "faq"
      },
      {
        "text": "Editorial cards use real published facts and historical photographs. They do not imply endorsement.",
        "target": "infographics"
      },
      {
        "text": "SGD including GST. Per-tier stock and remaining values are fictional. Real info link opens PGL's website.",
        "target": "register"
      },
      {
        "text": "Capacity is an invented demo allocation; English (+ Simplified Chinese) is the language of this reference page.",
        "target": "goodtoknow"
      },
      {
        "text": "These optional questions and the acknowledgement are invented for demonstrating the form. No information goes to PGL.",
        "target": "atregistration"
      },
      {
        "text": "Official PGL site plus published accessibility and venue guidance. Contact the venue box office for individual accommodations.",
        "target": "guidelines"
      }
    ],
    "ticketGroups": [
      {
        "name": "Opening Stage · 2-day pass",
        "rank": 1,
        "color": "cyan",
        "tierId": "opening"
      },
      {
        "name": "Grandstand · single-day",
        "rank": 2,
        "color": "amber",
        "tierId": "grandstand"
      },
      {
        "name": "Premium Grandstand · 3-day",
        "rank": 3,
        "color": "violet",
        "tierId": "premium"
      },
      {
        "name": "VIP Hospitality · 3-day",
        "rank": 4,
        "color": "magenta",
        "tierId": "vip"
      }
    ],
    "guestsDisplay": {
      "align": "left",
      "layout": "grid",
      "columns": 2,
      "showBio": true,
      "imageFit": "cover",
      "cardStyle": "card",
      "imageShape": "square"
    },
    "galleryDisplay": {
      "dots": true,
      "loop": true,
      "arrows": true,
      "layout": "carousel",
      "autoplay": false,
      "slidesPerView": 2
    },
    "packagesDesign": {
      "mode": "themed",
      "theme": {
        "base": "dark",
        "font": {
          "body": "sans",
          "scale": "md",
          "heading": "grotesk"
        },
        "hero": "classic",
        "cover": "accent",
        "width": "wide",
        "button": "solid",
        "colors": {
          "bg": "#070a12",
          "link": "#22d3ee",
          "text": "#e8eaf0",
          "brand": "#22d3ee",
          "muted": "#9aa4b8",
          "accent": "#e879f9",
          "border": "#1e293b",
          "surface": "#0d1322",
          "brandText": "#061018",
          "brandHover": "#67e8f9"
        },
        "header": {
          "cta": {
            "url": "https://www.pgl.gg/",
            "label": "Official PGL info"
          },
          "show": true,
          "links": [
            {
              "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
              "label": "Liquipedia bracket"
            },
            {
              "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
              "label": "HLTV results"
            },
            {
              "url": "https://en.wikipedia.org/wiki/PGL_Major_Singapore_2026",
              "label": "Wikipedia overview"
            }
          ],
          "border": true,
          "sticky": true
        },
        "layout": "classic",
        "radius": "rounded",
        "source": {
          "url": "https://www.pgl.gg/",
          "siteName": "Independent Geiger showcase"
        },
        "density": "comfortable",
        "sidebar": "right",
        "tagline": "25 Nov–13 Dec · First CS2 Major in Southeast Asia · Singapore Indoor Stadium",
        "radiusPx": 12,
        "elevation": "subtle",
        "background": {
          "type": "gradient"
        },
        "borderWidth": 1,
        "footerStyle": {
          "text": "#c9d1de",
          "background": "#04060c"
        },
        "buttonWeight": "600",
        "coverOverlay": "scrim",
        "headingWeight": "bold",
        "buttonRadiusPx": 8
      },
      "blocks": [
        {
          "id": "about",
          "type": "about",
          "visible": true
        },
        {
          "id": "expect",
          "type": "expect",
          "visible": true
        },
        {
          "id": "editorial-heading",
          "type": "heading",
          "props": {
            "text": "Three Swiss stages. One arena final."
          },
          "visible": true
        },
        {
          "id": "editorial-columns",
          "type": "columns",
          "props": {
            "align": "center",
            "ratio": "1:1",
            "leftUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
            "leftKind": "image",
            "rightKind": "text",
            "rightText": "### How the Major works\n\n- **Stage 1:** 16 invited teams (Swiss) — 8 advance, 8 out.\n- **Stage 2:** 16 teams (Swiss) — 8 advance.\n- **Stage 3:** 16 teams (Swiss, all Bo3) — 8 advance.\n- **Playoffs:** 8-team single-elimination, Bo3 except the **Bo5 Grand Final**.\n- **NEW:** first-ever **3rd-place decider** before the final.\n\nThe arena photo shows Singapore Indoor Stadium (Exec8, CC BY-SA 4.0).",
            "leftCaption": "Singapore Indoor Stadium · Exec8 · CC BY-SA 4.0. Archival venue photo."
          },
          "visible": true
        },
        {
          "id": "schedule",
          "type": "schedule",
          "visible": true
        },
        {
          "id": "schedule-links",
          "type": "buttons",
          "props": {
            "items": [
              {
                "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
                "label": "Bracket & teams (Liquipedia)",
                "style": "solid"
              },
              {
                "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
                "label": "Results & rankings (HLTV)",
                "style": "outline"
              }
            ]
          },
          "visible": true
        },
        {
          "id": "guests",
          "type": "guests",
          "visible": true
        },
        {
          "id": "location",
          "type": "location",
          "visible": true
        },
        {
          "id": "location-image",
          "type": "image",
          "props": {
            "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Singapore_National_Stadium_from_Kallang_Footbridge.jpg/1280px-Singapore_National_Stadium_from_Kallang_Footbridge.jpg",
            "caption": "Singapore National Stadium from Kallang Footbridge · Exec8 · CC BY-SA 4.0."
          },
          "visible": true
        },
        {
          "id": "guide-embed",
          "type": "embed",
          "props": {
            "code": "<aside aria-label='Official resources' style='border:1px solid #334155;padding:24px;border-radius:12px'><h3>Official PGL info</h3><p>Format, invites and schedules: check PGL and Liquipedia. This page is an independent demo.</p><a href='https://www.pgl.gg/' target='_blank' rel='noopener noreferrer'>Open PGL ↗</a> · <a href='https://liquipedia.net/counterstrike/PGL/Major/2026' target='_blank' rel='noopener noreferrer'>Liquipedia ↗</a></aside>"
          },
          "visible": true
        },
        {
          "id": "whosgoing",
          "type": "whosgoing",
          "visible": true
        },
        {
          "id": "inventory-note",
          "type": "text",
          "props": {
            "text": "Demo inventory, not a real gate report: 8,470 going / 12,000 capacity. The ticket-level stock is an illustrative allocation; actual sales and availability are not inferred from these numbers."
          },
          "layout": {
            "align": "left",
            "width": "full",
            "background": "surface"
          },
          "visible": true
        },
        {
          "id": "faq",
          "type": "faq",
          "visible": true
        },
        {
          "id": "policy-accordion",
          "type": "accordion",
          "props": {
            "items": [
              {
                "a": "Demo SGD prices incl. GST: Opening 2-Day **168**, Grandstand Fri **288** / Sat **328** / Sun **388**, Premium 3-Day **1,288**, VIP 3-Day **2,888**, Playoffs Weekend Bundle **798**. All invented; availability may change.",
                "q": "Published price snapshot (demo)"
              },
              {
                "a": "VRS snapshot 2 Nov 2026: Europe 12 Stage-1 invites (6+6 to Stages 2/3), Americas 6/1/2, Asia 4/1/0. Stage 3 headliners: Falcons, Vitality, MOUZ, Spirit, Aurora, BetBoom, FURIA, Legacy. See Liquipedia for the live table.",
                "q": "Invite distribution (real)"
              },
              {
                "a": "Read PGL's terms and privacy policy on pgl.gg before any real purchase. Liquipedia and HLTV are community references, not sellers.",
                "q": "Official conditions"
              }
            ],
            "title": "Before you book"
          },
          "visible": true
        },
        {
          "id": "breathing-room",
          "type": "spacer",
          "props": {
            "size": "sm"
          },
          "visible": true
        },
        {
          "id": "official-cta",
          "type": "cta",
          "props": {
            "url": "https://www.pgl.gg/",
            "label": "Check official PGL info",
            "title": "Ready for the first Southeast Asia Major?"
          },
          "visible": true
        },
        {
          "id": "credits-divider",
          "type": "divider",
          "visible": true
        },
        {
          "id": "credits",
          "type": "richtext",
          "props": {
            "text": "## Photography & provenance\n\nAll photographs are archival, resized and CSS-cropped. No image depicts this future event. No PGL logos, no official team photos, no real player portraits are used.\n\n- [Singapore Indoor Stadium](https://commons.wikimedia.org/wiki/File:Singapore_Indoor_Stadium.jpg) — Exec8, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Singapore Indoor Stadium, Aug 07](https://commons.wikimedia.org/wiki/File:Singapore_Indoor_Stadium,_Aug_07.JPG) — Sengkang, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [Kallang Indoor Stadium (8151029247)](https://commons.wikimedia.org/wiki/File:Kallang_Indoor_Stadium_(8151029247).jpg) — Erwin Soo, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [Singapore National Stadium from Kallang Footbridge](https://commons.wikimedia.org/wiki/File:Singapore_National_Stadium_from_Kallang_Footbridge.jpg) — Exec8, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Entrance to the Singapore Indoor Stadium (unscaled original)](https://commons.wikimedia.org/wiki/File:Entrance_to_the_Singapore_Indoor_Stadium.jpg) — William Cho, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).\n- [Esport IFNG Munich Stage3](https://commons.wikimedia.org/wiki/File:ESport_IFNG_Munich_20-Nov-11_Stage3.jpg) — Peshay159, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [Esport IFNG Munich Stage4](https://commons.wikimedia.org/wiki/File:ESport_IFNG_Munich_20-Nov-11_Stage4.jpg) — Peshay159, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).\n- [IEM 2015 San Jose Day 2 – 17](https://commons.wikimedia.org/wiki/File:IEM_2015_San_Jose_Day_2_-_17.jpg) — Kevin Chang for Team Liquid, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [SK Gaming vs. G2 Esports – ESL One Cologne 2016 groups](https://commons.wikimedia.org/wiki/File:SK_Gaming_vs._G2_Esports_-_ESL_One_Cologne_2016_groups.jpg) — VaKarM, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).\n- [Merlión, Marina Bay, Singapur, 2023-08-18](https://commons.wikimedia.org/wiki/File:Merli%C3%B3n,_Marina_Bay,_Singapur,_2023-08-18,_DD_45-47_HDR.jpg) — Diego Delso, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)."
          },
          "visible": true
        }
      ],
      "footer": {
        "text": "Independent reference page. PGL, Valve and Counter-Strike names belong to their respective owners. No affiliation or endorsement. Archival photographs credited above; capacity, sales, prices and schedule times are demo data.",
        "links": [
          {
            "url": "https://www.pgl.gg/",
            "label": "PGL official site"
          },
          {
            "url": "https://liquipedia.net/counterstrike/PGL/Major/2026",
            "label": "Liquipedia"
          },
          {
            "url": "https://www.hltv.org/events/8502/pgl-major-singapore-2026/",
            "label": "HLTV"
          }
        ],
        "socials": [
          {
            "url": "https://www.pgl.gg/",
            "platform": "instagram"
          },
          {
            "url": "https://www.youtube.com/@pglesports",
            "platform": "youtube"
          },
          {
            "url": "https://www.twitch.tv/pglesports",
            "platform": "twitch"
          }
        ],
        "showBranding": true
      },
      "viewerMode": "dark",
      "showGallery": true,
      "sidebarBlocks": [
        {
          "id": "register",
          "type": "register",
          "visible": true
        },
        {
          "id": "goodtoknow",
          "type": "goodtoknow",
          "visible": true
        },
        {
          "id": "atregistration",
          "type": "atregistration",
          "visible": true
        },
        {
          "id": "guidelines",
          "type": "guidelines",
          "visible": true
        },
        {
          "id": "help",
          "type": "cta",
          "props": {
            "url": "https://www.pgl.gg/",
            "label": "Official PGL info",
            "title": "Ticket or access questions?"
          },
          "visible": true
        }
      ]
    },
    "organizerAvatar": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg"
  },
  "timezone": "Asia/Singapore",
  "venue_id": "6c5a2026-1205-4e11-8c00-000000000002",
  "cover_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1280px-Singapore_Indoor_Stadium.jpg",
  "organizer": "PGL (Geiger demo showcase)",
  "series_id": null,
  "deleted_at": null,
  "event_date": "2026-12-05",
  "event_time": "12:00",
  "project_id": "ebcc7910-1a0e-4e91-8c3b-752f3c4292d3",
  "visibility": "Public",
  "is_listable": false
}
$seed$::jsonb)
ON CONFLICT (id) DO UPDATE SET
  "city" = EXCLUDED."city",
  "name" = EXCLUDED."name",
  "sold" = EXCLUDED."sold",
  "type" = EXCLUDED."type",
  "venue" = EXCLUDED."venue",
  "status" = EXCLUDED."status",
  "address" = EXCLUDED."address",
  "gallery" = EXCLUDED."gallery",
  "revenue" = EXCLUDED."revenue",
  "summary" = EXCLUDED."summary",
  "capacity" = EXCLUDED."capacity",
  "metadata" = EXCLUDED."metadata",
  "timezone" = EXCLUDED."timezone",
  "venue_id" = EXCLUDED."venue_id",
  "cover_url" = EXCLUDED."cover_url",
  "organizer" = EXCLUDED."organizer",
  "series_id" = EXCLUDED."series_id",
  "deleted_at" = EXCLUDED."deleted_at",
  "event_date" = EXCLUDED."event_date",
  "event_time" = EXCLUDED."event_time",
  "project_id" = EXCLUDED."project_id",
  "visibility" = EXCLUDED."visibility",
  "is_listable" = EXCLUDED."is_listable";
