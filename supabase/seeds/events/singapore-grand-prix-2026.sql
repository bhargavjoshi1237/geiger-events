-- Formula 1 Singapore Airlines Singapore Grand Prix 2026, 9-11 October 2026.
-- Reconstructed 2026-09-18 from the previously seeded database rows after the
-- original untracked SQL file disappeared. This is not a byte-for-byte recovery.
-- Owns only the two fixed event/venue IDs below. No application code changes.
-- Run: npm run db:seed -- singapore-grand-prix-2026
-- Repeated runs upsert the same records; unrelated records are untouched.
-- Audit timestamps/actors are deliberately excluded from this data snapshot.
--
-- SOURCES (researched 2026-09-17; programme/stock subject to change):
-- https://singaporegp.sg/en/on-track/f1
-- https://singaporegp.sg/en/entertainment
-- https://singaporegp.sg/en/tickets
-- https://singaporegp.sg/en/event-info/eventguide
-- https://singaporegp.sg/en/hospitality/drivers-right-lounge
-- https://singaporegp.sg/en/contact-us/tickets
-- https://singaporegp.sg/en/news/2026/singapore-gp-completes-star-studded-entertainment-line-up-for-the-formula-1-singapore-airlines-singapore-grand-prix-2026
-- Real: published dates, UTC+8 programme, ticket products/prices including GST,
-- hospitality products and entertainment. Friday 14:30 is the Drivers' Fan
-- Forum, NOT a published gate opening. Prices are SGD despite renderer '$'.
--
-- INVENTED / EDITORIAL: capacity 62000, sold 41760, revenue SGD24860000;
-- tier quantities [8000,8000,8000,6000], sold [5360,5800,5900,4700]. These are
-- demonstration figures, not promoter figures. Two optional checkout questions
-- and one required acknowledgement, layout/theme, explanatory copy and block
-- arrangement are editorial. Circuit map pin is approximate, not an entrance.
-- Host avatar is an illustrative credited circuit photo, not an organiser logo.
-- Independent public demo, deliberately is_listable=false. Payments disabled;
-- do not submit native ticket/enquiry forms. Official booking links are supplied.
--
-- IMAGES: seven archival Wikimedia Commons photographs, not 2026 event photos.
-- Image source/author/license links are retained in the on-page provenance block.
-- Verified 2026-09-17 by third-party-Referer GET (200/JPEG/decoded dimensions)
-- and prior Chromium loading. No promoter photos/logo are used.
--
-- LIMITS: no official seat geometry, unpublished offers or invented discounts.
-- Payment-disabled checkout still renders payment/Stripe copy; gallery lightbox
-- omits captions; hero omits end date; Add/Share are toast-only in tested build.
-- These require application changes, outside this data-only task.

-- venues: Marina Bay Street Circuit
INSERT INTO events.venues ("id", "city", "name", "type", "region", "spaces", "status", "address", "country", "gallery", "website", "latitude", "metadata", "postcode", "timezone", "amenities", "cover_url", "longitude", "deleted_at", "project_id", "description", "contact_name", "contact_email", "contact_phone", "parking_notes", "transit_notes", "seated_capacity", "standing_capacity")
SELECT "id", "city", "name", "type", "region", "spaces", "status", "address", "country", "gallery", "website", "latitude", "metadata", "postcode", "timezone", "amenities", "cover_url", "longitude", "deleted_at", "project_id", "description", "contact_name", "contact_email", "contact_phone", "parking_notes", "transit_notes", "seated_capacity", "standing_capacity"
FROM jsonb_populate_record(NULL::events.venues, $seed$
{
  "id": "5a9f2026-1009-4e11-8c00-000000000002",
  "city": "Singapore",
  "name": "Marina Bay Street Circuit",
  "type": "Outdoor",
  "region": null,
  "spaces": 1,
  "status": "Active",
  "address": "Marina Bay Street Circuit",
  "country": "Singapore",
  "gallery": [],
  "website": "https://singaporegp.sg/en/event-info/eventguide",
  "latitude": 1.2914,
  "metadata": {
    "showcase": true,
    "coordinatesNote": "Approximate circuit-area pin; not a gate.",
    "capacityInvented": true
  },
  "postcode": null,
  "timezone": "Asia/Singapore",
  "amenities": [
    "Wheelchair-accessible platforms",
    "First aid",
    "Information booths",
    "Power bank rental stations",
    "Pit Stop Shop"
  ],
  "cover_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg",
  "longitude": 103.864,
  "deleted_at": null,
  "project_id": "ebcc7910-1a0e-4e91-8c3b-752f3c4292d3",
  "description": "The Singapore Grand Prix city circuit around Marina Bay. The F1 Pit Building is shown in an archival 2019 photograph by Dietmar Rabich (CC BY-SA 4.0; full credit on the event page). The 62,000 capacity below is an invented demonstration figure, not an official limit. Use the official guide for ticket-specific gate access.",
  "contact_name": null,
  "contact_email": null,
  "contact_phone": "+65 6042 5066",
  "parking_notes": "This is a city street circuit. Consult the official Getting Here guide before driving: the map pin identifies the circuit area, not a bookable parking space. No parking reservation is included in these listed walkabout products.",
  "transit_notes": "Choose your route for the gate and zone printed on your official ticket. The organiser's Event Guide contains nearest drop-off points, routes to grandstands/walkabout, accessible routes and getting-out advice; follow those rather than treating the pit-building pin as a universal entrance.",
  "seated_capacity": 0,
  "standing_capacity": 62000
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

-- events: Formula 1 Singapore Airlines Singapore Grand Prix 2026
INSERT INTO events.events ("id", "city", "name", "sold", "type", "venue", "status", "address", "gallery", "revenue", "summary", "capacity", "metadata", "timezone", "venue_id", "cover_url", "organizer", "series_id", "deleted_at", "event_date", "event_time", "project_id", "visibility", "is_listable")
SELECT "id", "city", "name", "sold", "type", "venue", "status", "address", "gallery", "revenue", "summary", "capacity", "metadata", "timezone", "venue_id", "cover_url", "organizer", "series_id", "deleted_at", "event_date", "event_time", "project_id", "visibility", "is_listable"
FROM jsonb_populate_record(NULL::events.events, $seed$
{
  "id": "5a9f2026-1009-4e11-8c00-000000000001",
  "city": "Singapore",
  "name": "Formula 1 Singapore Airlines Singapore Grand Prix 2026",
  "sold": 41760,
  "type": "In-person",
  "venue": "Marina Bay Street Circuit",
  "status": "On sale",
  "address": "Marina Bay Street Circuit, Singapore",
  "gallery": [
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
      "type": "image",
      "caption": "Esplanade Bridge · Basile Morin · CC BY-SA 4.0 · archive city photograph"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg",
      "type": "image",
      "caption": "F1 Pit Building, 2019 · Dietmar Rabich · CC BY-SA 4.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/The_Killers_performing_in_Las_Vegas.jpg/1280px-The_Killers_performing_in_Las_Vegas.jpg",
      "type": "image",
      "caption": "The Killers, Las Vegas 2019 · Brettandelle · CC BY-SA 4.0"
    },
    {
      "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Lana_Del_Rey_%282024%29.jpg/1280px-Lana_Del_Rey_%282024%29.jpg",
      "type": "image",
      "caption": "Lana Del Rey, Barcelona 2024 · Raph_PH · CC BY 2.0"
    }
  ],
  "revenue": 24860000,
  "summary": "9–11 October 2026: Singapore’s first F1 Sprint weekend, night racing and live music across 10 stages. Independent showcase; book via Singapore GP.",
  "capacity": 62000,
  "metadata": {
    "faq": [
      {
        "a": "Friday **9 October to Sunday 11 October 2026**, in **Asia/Singapore (UTC+8)**. Sunday's F1 race is 20:00–22:00. The 14:30 Friday timestamp on this page is the Drivers' Fan Forum, not a published gate-opening time.",
        "q": "Which dates and timezone should I use?"
      },
      {
        "a": "All valid event tickets provide access to Zone 4 performances on the corresponding day, including the Padang Stage. A Zone 1 ticket is required for the Wharf and Barge Stage performances. Check your day and zone before buying.",
        "q": "Are concerts included in my race ticket?"
      },
      {
        "a": "The **Zone 4 Walkabout Sprint Bundle** is a Friday-and-Saturday admission product, listed at **SGD 368** including GST. It does not include Sunday. This page represents it with the product's native ticket-bundle UI.",
        "q": "What does the Sprint Bundle include?"
      },
      {
        "a": "No. Every **$** on this page means **Singapore dollars (SGD)**. Singapore GP states that listed prices include GST; the current rate is 9%. The application uses a dollar sign without a currency label.",
        "q": "Are these US dollar prices?"
      },
      {
        "a": "Call the official ticket team at **+65 6042 5066**. The organiser explicitly directs wheelchair-platform purchases to this number. Use the accessible routes in the [Event Guide](https://singaporegp.sg/en/event-info/eventguide).",
        "q": "How do I arrange wheelchair platform access?"
      },
      {
        "a": "The official 2026 ticket page says premium hospitality is sold exclusively as **3-day experiences**; single-day options are not offered.",
        "q": "Can I buy a one-day hospitality package?"
      },
      {
        "a": "No. This is an independent Geiger Events demonstration. Payment is disabled and the counts are invented. Use [Singapore GP's ticket page](https://singaporegp.sg/en/tickets) for real availability and booking. Do not submit personal details here.",
        "q": "Is this page selling real tickets?"
      },
      {
        "a": "The [official entertainment page](https://singaporegp.sg/en/entertainment) lists the wider line-up and timed performances. The [race page](https://singaporegp.sg/en/on-track/f1) lists the F1 sessions. All are subject to change.",
        "q": "Where can I find the full programme?"
      }
    ],
    "map": {
      "coords": {
        "lat": 1.2914,
        "lng": 103.864
      },
      "parking": "This is a city street circuit. Consult the official Getting Here guide before driving: the map pin identifies the circuit area, not a bookable parking space. No parking reservation is included in these listed walkabout products.",
      "transport": "Choose your route for the gate and zone printed on your official ticket. The organiser's Event Guide contains nearest drop-off points, routes to grandstands/walkabout, accessible routes and getting-out advice; follow those rather than treating the pit-building pin as a universal entrance."
    },
    "ctas": {
      "items": [
        {
          "id": "official",
          "url": "https://singaporegp.sg/en/tickets",
          "label": "Book on official Singapore GP site",
          "style": "primary"
        },
        {
          "id": "packages",
          "url": "https://geiger.studio/events/e/5a9f2026-1009-4e11-8c00-000000000001/packages",
          "label": "Explore 3-day hospitality",
          "style": "outline"
        },
        {
          "id": "access",
          "url": "tel:+6560425066",
          "label": "Wheelchair booking · +65 6042 5066",
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
      "9–11 October 2026",
      "Formula 1",
      "Sprint weekend",
      "Night race"
    ],
    "guests": [
      {
        "id": "g1",
        "bio": "Returning to the Padang after eight years. Archive image: Las Vegas, 2019; Brettandelle, CC BY-SA 4.0.",
        "name": "The Killers",
        "role": "Saturday · 22:30–23:45",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/The_Killers_performing_in_Las_Vegas.jpg/1280px-The_Killers_performing_in_Las_Vegas.jpg",
        "company": "Padang Stage · Zone 4"
      },
      {
        "id": "g2",
        "bio": "First Singapore concert. Archive image: Primavera Sound, Barcelona, 2024; Raph_PH, CC BY 2.0.",
        "name": "Lana Del Rey",
        "role": "Sunday · 22:25–23:55",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Lana_Del_Rey_%282024%29.jpg/1280px-Lana_Del_Rey_%282024%29.jpg",
        "company": "Padang Stage · Zone 4"
      },
      {
        "id": "g3",
        "bio": "Appearing in the published Zone 1 line-up. Archive image: Dallas, 2025; LeslieM2347, CC BY-SA 4.0.",
        "name": "Janet Jackson",
        "role": "Sunday · 18:15–19:15",
        "image": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Janet_Jackson_United_Way_Metropolitan_Dallas_Centennial_Concert_2025.jpg",
        "company": "Wharf Stage · Zone 1"
      },
      {
        "id": "g4",
        "bio": "Appearing before Saturday's qualifying session. Archive image: Santa Ana, May 2019; Justin Higuchi, CC BY 2.0.",
        "name": "Zara Larsson",
        "role": "Saturday · 18:45–19:45",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Zara_Larsson_May_2019.jpg/1280px-Zara_Larsson_May_2019.jpg",
        "company": "Padang Stage · Zone 4"
      }
    ],
    "bundles": [
      {
        "id": "z4-sprint",
        "name": "Sprint Bundle · Zone 4 Walkabout",
        "items": [
          {
            "qty": 1,
            "ticketId": "z4-fri"
          },
          {
            "qty": 1,
            "ticketId": "z4-sat"
          }
        ],
        "price": 368,
        "enabled": true,
        "description": "SGD 368 incl. GST · 9 & 10 October · one admission for each day; not two guests on one day. No Sunday admission.",
        "pricingMode": "fixed"
      }
    ],
    "tickets": [
      {
        "id": "z4-fri",
        "qty": 8000,
        "name": "Zone 4 Walkabout · Friday",
        "price": 198,
        "groupId": "z4",
        "description": "SGD · GST included · 9 Oct only · Zone 4 performances. Demo inventory; book officially."
      },
      {
        "id": "z4-sat",
        "qty": 8000,
        "name": "Zone 4 Walkabout · Saturday",
        "price": 298,
        "groupId": "z4",
        "description": "SGD · GST included · 10 Oct only · Sprint, qualifying and Zone 4 performances. Demo inventory."
      },
      {
        "id": "z4-sun",
        "qty": 8000,
        "name": "Zone 4 Walkabout · Sunday",
        "price": 368,
        "groupId": "z4",
        "description": "SGD · GST included · 11 Oct only · Grand Prix and Zone 4 performances. Demo inventory."
      },
      {
        "id": "prem-fri",
        "qty": 6000,
        "name": "Premier Walkabout · Friday",
        "price": 298,
        "groupId": "allzones",
        "description": "SGD · GST included · 9 Oct only · Access to Zones 1, 2, 3 and 4. Demo inventory."
      }
    ],
    "packages": {
      "intro": "Official three-day products, represented for comparison only.",
      "items": [
        {
          "id": "lounge-outdoor",
          "mode": "enquire",
          "name": "Driver's Right Lounge · Outdoor",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
          "price": 5110,
          "stock": null,
          "details": "Published regular price: SGD 5,110 including GST. A three-day experience; no single-day hospitality option.\nArchive city image by Basile Morin, CC BY-SA 4.0 — not a photograph of the lounge.\nUse the official hospitality link above for a real booking.",
          "tagline": "Air-cooler · 9–11 October",
          "visible": true,
          "ctaLabel": "Preview enquiry fields",
          "inclusions": [
            {
              "id": "o1",
              "icon": "access",
              "text": "Access to Zones 1, 2, 3 and 4"
            },
            {
              "id": "o2",
              "icon": "location",
              "text": "Fourth floor of Esplanade – Theatres on the Bay"
            },
            {
              "id": "o3",
              "icon": "hospitality",
              "text": "International cuisine and beverage selection"
            },
            {
              "id": "o4",
              "icon": "star",
              "text": "Padang and Wharf Stage entertainment access"
            }
          ],
          "priceSuffix": " SGD / person · 3 days"
        },
        {
          "id": "lounge-indoor",
          "mode": "enquire",
          "name": "Driver's Right Lounge · Indoor",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/1280px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
          "price": 5655,
          "stock": null,
          "details": "Published regular price: SGD 5,655 including GST. The terrace overlooks the section between Turns 14 and 16.\nArchive skyline by Benh LIEU SONG, CC BY-SA 4.0 — not a photograph of the lounge.\nUse the official hospitality link above for a real booking.",
          "tagline": "Air-conditioned · 9–11 October",
          "visible": true,
          "ctaLabel": "Preview enquiry fields",
          "inclusions": [
            {
              "id": "i1",
              "icon": "access",
              "text": "Access to Zones 1, 2, 3 and 4"
            },
            {
              "id": "i2",
              "icon": "hospitality",
              "text": "Air-conditioned indoor lounge"
            },
            {
              "id": "i3",
              "icon": "hospitality",
              "text": "International cuisine; Champagne, wines, beers and soft drinks"
            },
            {
              "id": "i4",
              "icon": "star",
              "text": "Live television feed indoors and open-air terrace"
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
        "by": "Wharf Stage · Zone 1",
        "id": "s1",
        "time": "14:30–15:10",
        "frame": "card",
        "title": "Friday 9 October · Drivers' Fan Forum",
        "layout": "timeline",
        "spacing": "normal",
        "description": "Valid Zone 1 or Zone 2 ticket required for the corresponding day.",
        "sectionNote": "Selected race and headline sessions, 9–11 October. All times are Singapore local time (UTC+8). The page timestamp is the first listed Fan Forum, not gate opening. Published programme, subject to change."
      },
      {
        "by": "On track",
        "id": "s2",
        "time": "16:30–17:30",
        "title": "Friday · F1 First Practice",
        "description": "The weekend's practice session before Sprint Qualifying."
      },
      {
        "by": "Wharf Stage · Zone 1",
        "id": "s3",
        "time": "19:15–20:15",
        "title": "Friday · Split Enz",
        "description": "The New Zealand band joins the Friday line-up."
      },
      {
        "by": "Padang Stage · Zone 4",
        "id": "s4",
        "time": "19:30–20:20",
        "title": "Friday · CORTIS",
        "description": "Included with a valid Friday ticket."
      },
      {
        "by": "On track",
        "id": "s5",
        "time": "20:30–21:14",
        "title": "Friday · F1 Sprint Qualifying",
        "description": "Sets the grid for Saturday's Sprint."
      },
      {
        "by": "Barge Stage · Zone 1",
        "id": "s6",
        "time": "21:25–22:30",
        "title": "Friday · DJ Snake",
        "description": "Zone 1 access required."
      },
      {
        "by": "Padang Stage · Zone 4",
        "id": "s7",
        "time": "22:30–23:45",
        "title": "Friday · JJ Lin",
        "description": "The Singapore singer-songwriter headlines Friday night."
      },
      {
        "by": "Wharf Stage · Zone 1",
        "id": "s8",
        "time": "15:10–15:40",
        "title": "Saturday 10 October · Drivers' Fan Forum",
        "description": "Valid Zone 1 or Zone 2 ticket required."
      },
      {
        "by": "On track",
        "id": "s9",
        "time": "17:00–17:30",
        "title": "Saturday · F1 Sprint",
        "description": "Singapore's first-ever Formula 1 Sprint."
      },
      {
        "by": "Padang Stage · Zone 4",
        "id": "s10",
        "time": "18:45–19:45",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Zara_Larsson_May_2019.jpg/1280px-Zara_Larsson_May_2019.jpg",
        "title": "Saturday · Zara Larsson",
        "imageFit": "fit",
        "description": "Included with a valid Saturday ticket.",
        "imagePosition": "left"
      },
      {
        "by": "Wharf Stage · Zone 1",
        "id": "s11",
        "time": "19:30–20:30",
        "title": "Saturday · Goo Goo Dolls",
        "description": "Zone 1 access required."
      },
      {
        "by": "On track",
        "id": "s12",
        "time": "21:00–22:00",
        "title": "Saturday · F1 Qualifying",
        "description": "Sets Sunday's Grand Prix grid."
      },
      {
        "by": "Padang Stage · Zone 4",
        "id": "s13",
        "time": "22:30–23:45",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/The_Killers_performing_in_Las_Vegas.jpg/1280px-The_Killers_performing_in_Las_Vegas.jpg",
        "title": "Saturday · The Killers",
        "description": "The band returns to the Padang after eight years.",
        "imagePosition": "left"
      },
      {
        "by": "Barge Stage · Zone 1",
        "id": "s14",
        "time": "17:00–18:00",
        "title": "Sunday 11 October · Mark Ronson",
        "description": "Zone 1 access required."
      },
      {
        "by": "On track",
        "id": "s15",
        "time": "18:00–18:30",
        "title": "Sunday · F1 Drivers' Parade",
        "description": "Before the Grand Prix."
      },
      {
        "by": "Janet Jackson: Wharf Stage, Zone 1 · James Arthur: Padang Stage, Zone 4",
        "id": "s16",
        "time": "18:15–19:15",
        "title": "Sunday · Janet Jackson / James Arthur",
        "description": "These performances overlap: choose the stage your ticket allows."
      },
      {
        "by": "Marina Bay Street Circuit",
        "id": "s17",
        "time": "20:00–22:00",
        "title": "Sunday · Formula 1 Grand Prix",
        "description": "The main race closes the on-track F1 programme."
      },
      {
        "by": "Padang Stage · Zone 4",
        "id": "s18",
        "time": "22:25–23:55",
        "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Lana_Del_Rey_%282024%29.jpg/1280px-Lana_Del_Rey_%282024%29.jpg",
        "title": "Sunday · Lana Del Rey",
        "description": "Her first-ever Singapore concert.",
        "imagePosition": "left"
      }
    ],
    "languages": [
      {
        "code": "en",
        "name": "English",
        "isDefault": true
      }
    ],
    "questions": [
      {
        "id": "demo-dietary",
        "type": "long",
        "label": "Dietary requirements — optional demo field; not sent to Singapore GP",
        "required": false
      },
      {
        "id": "demo-access",
        "type": "long",
        "label": "Accessibility questions — optional demo field; arrange access with the official ticket team",
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
      "text": "INDEPENDENT PRODUCT SHOWCASE — not an official Singapore GP sales page. No tickets are issued here; online payment is disabled. All $ prices are Singapore dollars (SGD), including 9% GST, researched 17 September 2026. The 62,000 capacity, 41,760 going and remaining-ticket counts are invented demo figures. Photographs show past performances and Singapore landmarks, not the future event. Schedule and availability may change; use the official links to book.",
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
        "label": "Wheelchair platform tickets use the official ticket team",
        "detail": "Turn 1 and Empress wheelchair-accessible platform products are listed separately. Call +65 6042 5066 to purchase; do not substitute an ordinary walkabout ticket.",
        "category": "accessibility"
      },
      {
        "id": "a2",
        "label": "Plan an accessible route",
        "detail": "The official Event Guide includes routes to wheelchair-accessible platforms, recommended routes and facilities. Check the current guide for your gate.",
        "category": "accessibility"
      },
      {
        "id": "a3",
        "label": "Hospitality and standard admission differ",
        "detail": "Driver's Right Lounge publishes a curated international menu and beverages. The listed walkabout tickets are admission products; do not assume a hospitality meal is included.",
        "category": "dietary"
      },
      {
        "id": "a4",
        "label": "Rain or shine · motorsport safety",
        "detail": "The organiser describes this as a rain-or-shine event and warns that motor racing is dangerous and accidents can happen. Read the current advisories and prohibited-items guide.",
        "category": "safety"
      }
    ],
    "highlights": [
      {
        "id": "h1",
        "title": "Singapore's first F1 Sprint",
        "detail": "Sprint Qualifying Friday; Sprint Saturday at 17:00."
      },
      {
        "id": "h2",
        "title": "Sunday under lights",
        "detail": "Grand Prix: 11 October, 20:00–22:00, Singapore time."
      },
      {
        "id": "h3",
        "title": "10 entertainment stages",
        "detail": "A 772,000 m² Circuit Park combines racing and live music."
      },
      {
        "id": "h4",
        "title": "Concerts included by day",
        "detail": "All tickets access Zone 4; Zone 1 shows require the appropriate zone access."
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
          "bg": "#101820",
          "link": "#e8b96a",
          "text": "#f1f3f5",
          "brand": "#e8b96a",
          "muted": "#adbbc8",
          "accent": "#70c7cc",
          "border": "#30414e",
          "surface": "#17232d",
          "brandText": "#151922",
          "brandHover": "#f3d5a4"
        },
        "header": {
          "cta": {
            "url": "https://singaporegp.sg/en/tickets",
            "label": "Official tickets"
          },
          "show": true,
          "links": [
            {
              "url": "https://singaporegp.sg/en/on-track/f1",
              "label": "Race programme"
            },
            {
              "url": "https://singaporegp.sg/en/entertainment",
              "label": "Line-up"
            },
            {
              "url": "https://singaporegp.sg/en/event-info/eventguide",
              "label": "Event guide"
            }
          ],
          "border": true,
          "sticky": true
        },
        "layout": "classic",
        "radius": "rounded",
        "source": {
          "url": "https://singaporegp.sg/en/",
          "siteName": "Independent Geiger showcase"
        },
        "density": "comfortable",
        "sidebar": "right",
        "tagline": "9–11 October · Singapore's first Sprint weekend · Marina Bay after dark",
        "radiusPx": 12,
        "elevation": "subtle",
        "background": {
          "type": "gradient"
        },
        "borderWidth": 1,
        "footerStyle": {
          "text": "#ccd6df",
          "background": "#0a1017"
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
            "text": "A weekend built around the night"
          },
          "visible": true
        },
        {
          "id": "editorial-columns",
          "type": "columns",
          "props": {
            "align": "center",
            "ratio": "1:1",
            "leftUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg",
            "leftKind": "image",
            "rightKind": "text",
            "rightText": "### Start with your day and zone\n\n- **Friday:** practice, Sprint Qualifying and JJ Lin.\n- **Saturday:** Sprint, qualifying and The Killers.\n- **Sunday:** Grand Prix, then Lana Del Rey.\n\nThe pit building anchors the circuit. Your actual entrance depends on your ticket; use the organiser's gate guidance.",
            "leftCaption": "F1 Pit Building in 2019 · Dietmar Rabich · CC BY-SA 4.0. Not a 2026 event image."
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
                "url": "https://singaporegp.sg/en/entertainment",
                "label": "Full entertainment schedule",
                "style": "solid"
              },
              {
                "url": "https://singaporegp.sg/en/on-track/f1",
                "label": "Official race timetable",
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
            "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
            "caption": "Esplanade Bridge and Singapore's CBD at night · Basile Morin · CC BY-SA 4.0. Historical city photograph; not a race-night view."
          },
          "visible": true
        },
        {
          "id": "guide-embed",
          "type": "embed",
          "props": {
            "code": "<aside aria-label='Official travel resources' style='border:1px solid #52606c;padding:24px;border-radius:12px'><h3>Use the official Event Guide</h3><p>Find gate-specific directions, accessible routes, facilities and prohibited-items guidance.</p><a href='https://singaporegp.sg/en/event-info/eventguide' target='_blank' rel='noopener noreferrer'>Open Singapore GP Event Guide ↗</a></aside>"
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
            "text": "Demo inventory, not a real gate report: 41,760 going / 62,000 capacity. The ticket-level stock is an illustrative allocation; actual sales and availability are not inferred from these numbers."
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
                "a": "Checked 17 September 2026: Zone 4 Walkabout Friday **SGD 198**, Saturday **SGD 298**, Sunday **SGD 368**. Friday-and-Saturday Sprint Bundle **SGD 368**. Premier Walkabout Friday **SGD 298**. Prices include GST; availability may change.",
                "q": "Published price snapshot"
              },
              {
                "a": "The official product data marks the Zone 4 and Premier 3-day walkabouts, Connaught Grandstand and Super Pit Grandstand sold out. They are intentionally not offered here as available tickets.",
                "q": "Sold-out categories are not recreated as available stock"
              },
              {
                "a": "Read the [organiser's terms](https://singaporegp.sg/terms) and [privacy policy](https://singaporegp.sg/en/privacy-policy) before a real purchase.",
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
            "url": "https://singaporegp.sg/en/tickets",
            "label": "Check official tickets & availability",
            "title": "Ready for the real night race?"
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
            "text": "## Photography & provenance\n\nAll photographs are archival, resized and CSS-cropped. No image depicts this future event. Credits apply to every reuse on this page, including cover, gallery, schedule, performer and hospitality cards. The host avatar is an illustrative circuit photograph, not the organiser's logo.\n\n- [Marina Bay at dusk, 2018](https://commons.wikimedia.org/wiki/File:Singapore_Marina_Bay_Dusk_2018-02-27.jpg) — Benh LIEU SONG, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [CBD with Esplanade Bridge](https://commons.wikimedia.org/wiki/File:Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg) — Basile Morin, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [The Killers, Las Vegas, 2019](https://commons.wikimedia.org/wiki/File:The_Killers_performing_in_Las_Vegas.jpg) — Brettandelle, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Lana Del Rey, Barcelona, 2024](https://commons.wikimedia.org/wiki/File:Lana_Del_Rey_(2024).jpg) — Raph_PH, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [Janet Jackson, Dallas, 2025](https://commons.wikimedia.org/wiki/File:Janet_Jackson_United_Way_Metropolitan_Dallas_Centennial_Concert_2025.jpg) — LeslieM2347, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Zara Larsson, May 2019](https://commons.wikimedia.org/wiki/File:Zara_Larsson_May_2019.jpg) — Justin Higuchi, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [F1 Pit Building, 2019](https://commons.wikimedia.org/wiki/File:Singapore_(SG),_Marina_Bay_Street_Circuit,_F1_Pit_Building_--_2019_--_4478.jpg) — Dietmar Rabich, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n\nFacts: [race timetable](https://singaporegp.sg/en/on-track/f1), [performances](https://singaporegp.sg/en/entertainment), [tickets](https://singaporegp.sg/en/tickets), [event guide](https://singaporegp.sg/en/event-info/eventguide). Independent presentation; no affiliation or endorsement."
          },
          "visible": true
        }
      ],
      "footer": {
        "text": "Independent reference page. Formula 1 and Singapore GP names belong to their respective owners. No affiliation or endorsement. Historical photographs credited above; capacity and sales figures are demo data.",
        "links": [
          {
            "url": "https://singaporegp.sg/terms",
            "label": "Official terms"
          },
          {
            "url": "https://singaporegp.sg/en/privacy-policy",
            "label": "Official privacy policy"
          },
          {
            "url": "https://singaporegp.sg/en/contact-us",
            "label": "Contact Singapore GP"
          }
        ],
        "socials": [
          {
            "url": "https://instagram.com/f1nightrace/",
            "platform": "instagram"
          },
          {
            "url": "https://www.facebook.com/F1NightRace",
            "platform": "facebook"
          },
          {
            "url": "https://www.youtube.com/user/singaporegrandprix",
            "platform": "youtube"
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
            "url": "https://singaporegp.sg/en/contact-us/tickets",
            "label": "Official ticket assistance",
            "title": "Ticket or access questions?"
          },
          "visible": true
        }
      ]
    },
    "ticketSold": {
      "z4-fri": 5360,
      "z4-sat": 5800,
      "z4-sun": 5900,
      "prem-fri": 4700
    },
    "description": "## Three nights. One city circuit. A first-ever Singapore Sprint.\n\nFrom **9 to 11 October 2026**, Formula 1 returns to the Marina Bay Street Circuit. This edition adds Singapore's first F1 Sprint: practice and Sprint Qualifying on Friday, the Sprint and Grand Prix qualifying on Saturday, and the Grand Prix on Sunday at **20:00 Singapore time (UTC+8)**.\n\nThe racing shares the weekend with a published music programme across **10 stages** in the **772,000-square-metre Circuit Park**. JJ Lin and CORTIS play Friday's Padang Stage; Zara Larsson and The Killers follow on Saturday; James Arthur and Lana Del Rey play Sunday. Zone 1 brings Split Enz, Goo Goo Dolls and Janet Jackson to the Wharf Stage, with DJ Snake, Major Lazer Soundsystem and Mark Ronson among the Barge Stage acts.\n\nChoose by **day and zone**, not just price. Every valid event ticket admits its holder to Zone 4 performances on the corresponding day. Zone 1 performances require Zone 1 access. A Friday ticket does not admit you to Sunday's race or concert.\n\n**Independent Geiger Events showcase:** published facts and prices are reproduced for reference. Inventory and revenue are invented demonstration figures. The form below is a UI preview, not a Singapore GP booking. Real purchases and access arrangements belong on the [official Singapore GP website](https://singaporegp.sg/en/tickets).",
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
              "link": "https://singaporegp.sg/en/on-track/f1",
              "text": "First Practice 16:30. Sprint Qualifying 20:30. JJ Lin 22:30.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg",
              "title": "Friday · 9 October",
              "ctaLabel": "Race timetable"
            },
            {
              "link": "https://singaporegp.sg/en/entertainment",
              "text": "Sprint 17:00. Qualifying 21:00. The Killers 22:30.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/The_Killers_performing_in_Las_Vegas.jpg/1280px-The_Killers_performing_in_Las_Vegas.jpg",
              "title": "Saturday · 10 October",
              "ctaLabel": "Line-up"
            },
            {
              "link": "https://singaporegp.sg/en/entertainment",
              "text": "Grand Prix 20:00. Lana Del Rey 22:25.",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Lana_Del_Rey_%282024%29.jpg/1280px-Lana_Del_Rey_%282024%29.jpg",
              "title": "Sunday · 11 October",
              "ctaLabel": "Line-up"
            }
          ],
          "title": "Three days at a glance",
          "autoplay": false
        }
      },
      {
        "id": "info-split",
        "type": "split",
        "props": {
          "text": "The organiser's 10 July announcement describes 10 stages across a 772,000-square-metre Circuit Park. All ticket holders can access Zone 4 performances on their ticket day; check your zones before heading to the Wharf or Barge Stage.",
          "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
          "title": "Beyond the racing line",
          "ctaUrl": "https://singaporegp.sg/en/entertainment",
          "ctaLabel": "Explore the entertainment",
          "imageSide": "left"
        }
      },
      {
        "id": "info-quotes",
        "type": "quotes",
        "props": {
          "items": [
            {
              "name": "Singapore GP Pte Ltd",
              "role": "10 July 2026 line-up announcement",
              "quote": "All tickets provide access to the performances in Zone 4, including the Padang Stage."
            },
            {
              "name": "Singapore GP Pte Ltd",
              "role": "2026 Event Guide safety notice",
              "quote": "Motor racing is dangerous and accidents can happen."
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
              "link": "https://singaporegp.sg/en/tickets",
              "text": "Single-day admission from SGD 198",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/1280px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
              "title": "Zone 4 Walkabout",
              "details": "Friday SGD 198; Saturday SGD 298; Sunday SGD 368. Prices include GST. Access to Zone 4 performances on the ticket day. This archive skyline illustrates the city, not the view from a specific ticket location.",
              "ctaLabel": "Official product listing"
            },
            {
              "link": "https://singaporegp.sg/en/hospitality/drivers-right-lounge",
              "text": "Three-day hospitality from SGD 5,110",
              "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
              "title": "Driver's Right Lounge",
              "details": "Outdoor air-cooler option SGD 5,110; indoor air-conditioned option SGD 5,655. Fourth floor of Esplanade – Theatres on the Bay. All-zone access, international cuisine and beverages. Archive city image, not a lounge interior.",
              "ctaLabel": "Official lounge details"
            }
          ],
          "title": "Choose the experience",
          "columns": 2,
          "clickOpen": true
        }
      },
      {
        "id": "info-footer",
        "type": "footer",
        "props": {
          "note": "Research snapshot: 17 September 2026. Schedule, artists and availability may change. Not an official Singapore GP microsite.",
          "items": [
            {
              "link": "https://singaporegp.sg/en/on-track/f1",
              "title": "Race sessions",
              "ctaLabel": "Read"
            },
            {
              "link": "https://singaporegp.sg/en/entertainment",
              "title": "Entertainment",
              "ctaLabel": "Explore"
            },
            {
              "link": "https://singaporegp.sg/en/tickets",
              "title": "Tickets",
              "ctaLabel": "Book officially"
            },
            {
              "link": "https://singaporegp.sg/en/event-info/eventguide",
              "title": "Event guide",
              "ctaLabel": "Plan"
            }
          ],
          "title": "Keep the official resources close"
        }
      }
    ],
    "packagesPage": {
      "title": "Three days of trackside hospitality",
      "enabled": true,
      "subtitle": "9–11 October 2026 · Independent showcase · SGD including GST",
      "introBody": "The only hospitality facility in Zone 4, on the fourth floor of Esplanade – Theatres on the Bay. Its terrace overlooks the section between Turns 14 and 16; the Padang Stage is described by the organiser as a 10-minute walk away. This is a demonstration page: do not submit personal details or attempt payment. Images show the city, not the lounge.",
      "pitchBody": "Both options include access to all four Circuit Park zones and the entertainment programme, including Padang and Wharf stages. Prices are a 17 September snapshot. Skyline photograph: Benh LIEU SONG, CC BY-SA 4.0; Esplanade Bridge photograph: Basile Morin, CC BY-SA 4.0. Source and license links are in the main event page's Photography & provenance section.",
      "pitchImage": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/1280px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
      "gridHeading": "Published three-day options",
      "introHeading": "Driver's Right Lounge",
      "introLinkUrl": "https://singaporegp.sg/en/hospitality/drivers-right-lounge",
      "leadsConsent": "I understand this showcase is not an official booking or enquiry channel.",
      "leadsEnabled": true,
      "leadsHeading": "Demo enquiry form — not sent to Singapore GP; please do not submit",
      "pitchEnabled": true,
      "pitchHeading": "Race, dine, then choose your stage",
      "pitchCtaLabel": "Compare the two options",
      "introLinkLabel": "Official hospitality details & booking",
      "leadsRecipient": ""
    },
    "sectionNotes": [
      {
        "text": "Source: official Singapore GP race page and 10 July 2026 line-up announcement.",
        "target": "about"
      },
      {
        "text": "10 stages and 772,000 m² are published organiser figures, not demo metrics.",
        "target": "expect"
      },
      {
        "text": "Published race and entertainment programme, checked 17 September 2026. All times UTC+8; simultaneous acts require a choice.",
        "target": "schedule"
      },
      {
        "text": "Approximate circuit-area pin, not a gate. Use official ticket-specific directions. Nearby walking estimates intentionally omitted.",
        "target": "location"
      },
      {
        "text": "INVENTED DEMO DATA: 41,760 going; capacity 62,000. No real attendee records were created.",
        "target": "whosgoing"
      },
      {
        "text": "Announced performers, not booked attendees. Photos are historical Commons images; credits and licenses are below.",
        "target": "guests"
      },
      {
        "text": "Summarised from Singapore GP's published ticket, race, entertainment and event-guide pages.",
        "target": "faq"
      },
      {
        "text": "Editorial cards use real published facts and historical photographs. They do not imply endorsement.",
        "target": "infographics"
      },
      {
        "text": "SGD including GST. Per-tier stock and remaining values are fictional. Real purchase link opens the organiser's website.",
        "target": "register"
      },
      {
        "text": "Capacity is an invented demo allocation; English is the language of this reference page, not a claim about every performance.",
        "target": "goodtoknow"
      },
      {
        "text": "These optional questions and the acknowledgement are invented for demonstrating the form. No information goes to Singapore GP.",
        "target": "atregistration"
      },
      {
        "text": "Official booking phone and published accessibility guide. Ask the organiser for individual accommodations.",
        "target": "guidelines"
      }
    ],
    "ticketGroups": [
      {
        "name": "Zone 4 · single-day admission",
        "rank": 1,
        "color": "amber",
        "tierId": "z4"
      },
      {
        "name": "Explore all four zones",
        "rank": 2,
        "color": "sky",
        "tierId": "allzones"
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
          "bg": "#101820",
          "link": "#e8b96a",
          "text": "#f1f3f5",
          "brand": "#e8b96a",
          "muted": "#adbbc8",
          "accent": "#70c7cc",
          "border": "#30414e",
          "surface": "#17232d",
          "brandText": "#151922",
          "brandHover": "#f3d5a4"
        },
        "header": {
          "cta": {
            "url": "https://singaporegp.sg/en/tickets",
            "label": "Official tickets"
          },
          "show": true,
          "links": [
            {
              "url": "https://singaporegp.sg/en/on-track/f1",
              "label": "Race programme"
            },
            {
              "url": "https://singaporegp.sg/en/entertainment",
              "label": "Line-up"
            },
            {
              "url": "https://singaporegp.sg/en/event-info/eventguide",
              "label": "Event guide"
            }
          ],
          "border": true,
          "sticky": true
        },
        "layout": "classic",
        "radius": "rounded",
        "source": {
          "url": "https://singaporegp.sg/en/",
          "siteName": "Independent Geiger showcase"
        },
        "density": "comfortable",
        "sidebar": "right",
        "tagline": "9–11 October · Singapore's first Sprint weekend · Marina Bay after dark",
        "radiusPx": 12,
        "elevation": "subtle",
        "background": {
          "type": "gradient"
        },
        "borderWidth": 1,
        "footerStyle": {
          "text": "#ccd6df",
          "background": "#0a1017"
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
            "text": "A weekend built around the night"
          },
          "visible": true
        },
        {
          "id": "editorial-columns",
          "type": "columns",
          "props": {
            "align": "center",
            "ratio": "1:1",
            "leftUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg",
            "leftKind": "image",
            "rightKind": "text",
            "rightText": "### Start with your day and zone\n\n- **Friday:** practice, Sprint Qualifying and JJ Lin.\n- **Saturday:** Sprint, qualifying and The Killers.\n- **Sunday:** Grand Prix, then Lana Del Rey.\n\nThe pit building anchors the circuit. Your actual entrance depends on your ticket; use the organiser's gate guidance.",
            "leftCaption": "F1 Pit Building in 2019 · Dietmar Rabich · CC BY-SA 4.0. Not a 2026 event image."
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
                "url": "https://singaporegp.sg/en/entertainment",
                "label": "Full entertainment schedule",
                "style": "solid"
              },
              {
                "url": "https://singaporegp.sg/en/on-track/f1",
                "label": "Official race timetable",
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
            "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg/1280px-Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg",
            "caption": "Esplanade Bridge and Singapore's CBD at night · Basile Morin · CC BY-SA 4.0. Historical city photograph; not a race-night view."
          },
          "visible": true
        },
        {
          "id": "guide-embed",
          "type": "embed",
          "props": {
            "code": "<aside aria-label='Official travel resources' style='border:1px solid #52606c;padding:24px;border-radius:12px'><h3>Use the official Event Guide</h3><p>Find gate-specific directions, accessible routes, facilities and prohibited-items guidance.</p><a href='https://singaporegp.sg/en/event-info/eventguide' target='_blank' rel='noopener noreferrer'>Open Singapore GP Event Guide ↗</a></aside>"
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
            "text": "Demo inventory, not a real gate report: 41,760 going / 62,000 capacity. The ticket-level stock is an illustrative allocation; actual sales and availability are not inferred from these numbers."
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
                "a": "Checked 17 September 2026: Zone 4 Walkabout Friday **SGD 198**, Saturday **SGD 298**, Sunday **SGD 368**. Friday-and-Saturday Sprint Bundle **SGD 368**. Premier Walkabout Friday **SGD 298**. Prices include GST; availability may change.",
                "q": "Published price snapshot"
              },
              {
                "a": "The official product data marks the Zone 4 and Premier 3-day walkabouts, Connaught Grandstand and Super Pit Grandstand sold out. They are intentionally not offered here as available tickets.",
                "q": "Sold-out categories are not recreated as available stock"
              },
              {
                "a": "Read the [organiser's terms](https://singaporegp.sg/terms) and [privacy policy](https://singaporegp.sg/en/privacy-policy) before a real purchase.",
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
            "url": "https://singaporegp.sg/en/tickets",
            "label": "Check official tickets & availability",
            "title": "Ready for the real night race?"
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
            "text": "## Photography & provenance\n\nAll photographs are archival, resized and CSS-cropped. No image depicts this future event. Credits apply to every reuse on this page, including cover, gallery, schedule, performer and hospitality cards. The host avatar is an illustrative circuit photograph, not the organiser's logo.\n\n- [Marina Bay at dusk, 2018](https://commons.wikimedia.org/wiki/File:Singapore_Marina_Bay_Dusk_2018-02-27.jpg) — Benh LIEU SONG, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [CBD with Esplanade Bridge](https://commons.wikimedia.org/wiki/File:Skyline_of_the_Central_Business_District_of_Singapore_with_Esplanade_Bridge.jpg) — Basile Morin, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [The Killers, Las Vegas, 2019](https://commons.wikimedia.org/wiki/File:The_Killers_performing_in_Las_Vegas.jpg) — Brettandelle, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Lana Del Rey, Barcelona, 2024](https://commons.wikimedia.org/wiki/File:Lana_Del_Rey_(2024).jpg) — Raph_PH, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [Janet Jackson, Dallas, 2025](https://commons.wikimedia.org/wiki/File:Janet_Jackson_United_Way_Metropolitan_Dallas_Centennial_Concert_2025.jpg) — LeslieM2347, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n- [Zara Larsson, May 2019](https://commons.wikimedia.org/wiki/File:Zara_Larsson_May_2019.jpg) — Justin Higuchi, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).\n- [F1 Pit Building, 2019](https://commons.wikimedia.org/wiki/File:Singapore_(SG),_Marina_Bay_Street_Circuit,_F1_Pit_Building_--_2019_--_4478.jpg) — Dietmar Rabich, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).\n\nFacts: [race timetable](https://singaporegp.sg/en/on-track/f1), [performances](https://singaporegp.sg/en/entertainment), [tickets](https://singaporegp.sg/en/tickets), [event guide](https://singaporegp.sg/en/event-info/eventguide). Independent presentation; no affiliation or endorsement."
          },
          "visible": true
        }
      ],
      "footer": {
        "text": "Independent reference page. Formula 1 and Singapore GP names belong to their respective owners. No affiliation or endorsement. Historical photographs credited above; capacity and sales figures are demo data.",
        "links": [
          {
            "url": "https://singaporegp.sg/terms",
            "label": "Official terms"
          },
          {
            "url": "https://singaporegp.sg/en/privacy-policy",
            "label": "Official privacy policy"
          },
          {
            "url": "https://singaporegp.sg/en/contact-us",
            "label": "Contact Singapore GP"
          }
        ],
        "socials": [
          {
            "url": "https://instagram.com/f1nightrace/",
            "platform": "instagram"
          },
          {
            "url": "https://www.facebook.com/F1NightRace",
            "platform": "facebook"
          },
          {
            "url": "https://www.youtube.com/user/singaporegrandprix",
            "platform": "youtube"
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
            "url": "https://singaporegp.sg/en/contact-us/tickets",
            "label": "Official ticket assistance",
            "title": "Ticket or access questions?"
          },
          "visible": true
        }
      ]
    },
    "organizerAvatar": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg/1280px-Singapore_%28SG%29%2C_Marina_Bay_Street_Circuit%2C_F1_Pit_Building_--_2019_--_4478.jpg"
  },
  "timezone": "Asia/Singapore",
  "venue_id": "5a9f2026-1009-4e11-8c00-000000000002",
  "cover_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/1280px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg",
  "organizer": "Singapore GP Pte Ltd",
  "series_id": null,
  "deleted_at": null,
  "event_date": "2026-10-09",
  "event_time": "14:30",
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
