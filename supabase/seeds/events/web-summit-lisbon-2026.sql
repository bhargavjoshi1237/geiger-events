-- Demo event: WEB SUMMIT 2026, LISBON
--
-- Second reference public page, alongside f1-las-vegas-gp-2026.sql: a themed,
-- spotlight-layout page exercising every content block, every sidebar card,
-- infographics, gallery, live map and a tiered ticket table — this time for a
-- conference rather than a race.
--
-- Everything except `sold`/`revenue` and the ticket prices is real: Web Summit
-- returns to Lisbon 9–12 November 2026 (Monday–Thursday, matching every recent
-- edition), at FIL – Feira Internacional de Lisboa together with the Altice
-- Arena in Parque das Nações, and the stages, programmes (Night Summit, ALPHA
-- startups, Women in Tech, Investor Office Hours) are the standing fixtures of
-- every edition. Sold/revenue are invented — there is no public running total
-- and the "Who's going" block needs a number. Pass tiers mirror how Web Summit
-- actually sells (student / startup / investor / attendee, rising through
-- sales phases) but the figures shown are illustrative, not quoted prices.
-- The 2026 speaker line-up is announced in waves closer to the date, so the
-- Guests block presents the stages and programmes instead of individuals.
--
-- Images are Wikimedia Commons (hotlink-friendly, every URL HEAD-verified 200):
-- opening-night and stage photography from past editions (CC BY 2.0, credited
-- to their photographers on Commons) and venue/area shots of FIL, the Altice
-- Arena, the Vasco da Gama Tower, Gare do Oriente and the Oceanário.
--
-- Re-runnable: upserts on a fixed id, so `npm run db:seed` can be repeated.
-- Owns: one row in events.events.

insert into events.events (
  id, project_id, name, status, type, event_date, event_time, timezone,
  venue, address, city, capacity, sold, revenue, visibility, organizer,
  summary, cover_url, gallery, is_listable, metadata
) values (
  'aa11e90f-2026-4111-9c00-111120261100',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'Web Summit 2026',
  'On sale',
  'In-person',
  '2026-11-09',
  '08:00',
  'Europe/Lisbon',
  'FIL — Feira Internacional de Lisboa',
  'Rua do Bojador, Parque das Nações, 1950-024 Lisboa',
  'Lisbon',
  75000,
  52140,
  46850000,
  'Public',
  'Web Summit',
  'Four days in Lisbon. 70,000+ people, 1,000+ speakers and dozens of stages under one roof at FIL and the Altice Arena — Europe''s largest tech conference, back where it has lived since 2016.',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Web_Summit_2017_-_Opening_Night_SD5_8698_%2826445933099%29.jpg/1920px-Web_Summit_2017_-_Opening_Night_SD5_8698_%2826445933099%29.jpg',
  $gallery$[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg/1920px-Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg/1920px-Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg/1920px-Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg/1920px-Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Web_Summit_2018_-_Pandaconf_-_Day_1%2C_November_6_HM1_5750_%2845753426381%29.jpg/1920px-Web_Summit_2018_-_Pandaconf_-_Day_1%2C_November_6_HM1_5750_%2845753426381%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Web_Summit_2018_-_Partner_Booths_-_Day_3%2C_November_8_DG2_1947_%2830838827767%29.jpg/1920px-Web_Summit_2018_-_Partner_Booths_-_Day_3%2C_November_8_DG2_1947_%2830838827767%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Web_Summit_2022_-_Registration_20221031SAM000313_%2852467573656%29.jpg/1920px-Web_Summit_2022_-_Registration_20221031SAM000313_%2852467573656%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/FIL%2C_outubro_2024_03.jpg/1920px-FIL%2C_outubro_2024_03.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg/1920px-Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg"
  ]$gallery$::jsonb,
  true,
  $meta${
    "description": "## Where 70,000 people go to find out what's next\n\nEvery November, Lisbon becomes the centre of the technology world. **Web Summit** — the conference Forbes has called \"the best technology conference on the planet\" — fills the FIL exhibition halls and the Altice Arena with more than 70,000 attendees, 1,000+ speakers, hundreds of investors and thousands of startups across four days.\n\nThe 2026 edition runs **Monday 9 November to Thursday 12 November**, opening with Opening Night in the Altice Arena and closing with the last talks, the last deals and the final Night Summit across the city.\n\n### Not one conference — dozens\n\nInside the summit you'll find dedicated stages and tracks for AI, SaaS, fintech, developers, media and marketing, automotive tech, sport and society — plus the ALPHA startup programme, Women in Tech, investor office hours and mentor hours running all day, every day.\n\n### The part that happens after dark\n\nWhen the stages close, the Night Summit begins: bars, rooftops and venues across Lisbon host receptions and parties every evening. Badges do the networking by day; the city does the rest.\n\n### Why founders actually come\n\nTwo thousand six hundred startups exhibit. Investors hold open office hours you can book from the app. The average attendee meets more potential partners in three days than in a year of video calls. If you're building something — or funding it — this is the room.",
    "highlights": [
      { "id": "h1", "title": "Opening Night in the Altice Arena", "detail": "The whole summit gathers under one roof for the opening keynote — 20,000 seats, one stage." },
      { "id": "h2", "title": "Dozens of stages, one roof", "detail": "AI, SaaS, fintech, developers, marketing, auto, sport and society — pick a lane or move between them all day." },
      { "id": "h3", "title": "ALPHA startup programme", "detail": "Hundreds of early-stage startups get a stand, pitch training and a slot on the startup stages." },
      { "id": "h4", "title": "Investor office hours", "detail": "Book fifteen minutes face-to-face with funds actively writing cheques — straight from the app." },
      { "id": "h5", "title": "Night Summit", "detail": "Every evening, the conference spreads across Lisbon's bars, rooftops and venues. Included with your badge." },
      { "id": "h6", "title": "Women in Tech", "detail": "One of the largest women-in-tech gatherings anywhere, with its own programming across all four days." }
    ],
    "schedule": [
      { "id": "s1", "layout": "timeline", "spacing": "normal", "frame": "boxed", "sectionNote": "All times are local to Lisbon (WET). The full talk-by-talk programme is published in the weeks before the event and in the app; this timetable shows the shape of each day.", "time": "08:00", "title": "Registration opens", "description": "Badge collection opens in the FIL atrium. Arrive early — Monday queues are the longest of the week.", "by": "Monday 9 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Web_Summit_2022_-_Registration_20221031SAM000024_%2852468134988%29.jpg/1920px-Web_Summit_2022_-_Registration_20221031SAM000024_%2852468134988%29.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s2", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Doors — Opening Night", "description": "The Altice Arena opens. Find your seat before the lights go down.", "by": "Monday 9 November" },
      { "id": "s3", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:00", "title": "Opening keynote — Centre Stage", "description": "The summit opens with its headline speakers on the main stage, followed by the first Night Summit of the week.", "by": "Monday 9 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Web_Summit_2017_-_Opening_Night_SD5_8698_%2826445933099%29.jpg/1920px-Web_Summit_2017_-_Opening_Night_SD5_8698_%2826445933099%29.jpg", "imagePosition": "background", "imageFit": "cover" },
      { "id": "s4", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "08:00", "title": "Doors open — Day 1", "description": "All halls open. Breakfast served on the exhibitor floor while the first coffee meetups happen.", "by": "Tuesday 10 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Web_Summit_2022_-_Registration_20221031SAM000313_%2852467573656%29.jpg/1920px-Web_Summit_2022_-_Registration_20221031SAM000313_%2852467573656%29.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s5", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "09:30", "title": "Stages open — full programme", "description": "Centre Stage, AI Summit, SaaS Monster, MoneyConf, FullStk and every other track start their daily runs.", "by": "Tuesday 10 November" },
      { "id": "s6", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "13:00", "title": "Investor office hours", "description": "Booked fifteen-minute meetings between startups and funds, all afternoon in the investor lounge.", "by": "Tuesday 10 November" },
      { "id": "s7", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:00", "title": "Night Summit", "description": "Receptions and parties across Lisbon — venues, hosts and RSVPs listed in the app each evening.", "by": "Tuesday 10 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg/1920px-Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s8", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "09:30", "title": "Women in Tech — flagship sessions", "description": "Day 2 carries the flagship Women in Tech programming alongside the full stage schedule.", "by": "Wednesday 11 November" },
      { "id": "s9", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "16:00", "title": "ALPHA startup pitches", "description": "Early-stage founders take the startup stages — three minutes, live judges, real stakes.", "by": "Wednesday 11 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg/1920px-Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s10", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:00", "title": "Night Summit", "description": "Round two across the city. Wednesday night is traditionally the loudest.", "by": "Wednesday 11 November" },
      { "id": "s11", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "09:30", "title": "Final day — stages open", "description": "Last chance for the stands, the office hours and the hallway conversations that turn into term sheets.", "by": "Thursday 12 November" },
      { "id": "s12", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "16:30", "title": "Closing sessions — Centre Stage", "description": "The final headline conversations bring the 2026 edition to a close.", "by": "Thursday 12 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Web_Summit_2017_-_Centre_Stage_Day_3_COD_6119_%2824417684328%29.jpg/1920px-Web_Summit_2017_-_Centre_Stage_Day_3_COD_6119_%2824417684328%29.jpg", "imagePosition": "background", "imageFit": "cover" },
      { "id": "s13", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:00", "title": "Closing party — Night Summit finale", "description": "One last Night Summit. The city takes over from the halls until the early hours.", "by": "Thursday 12 November" }
    ],
    "guests": [
      { "id": "g1", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg/1920px-Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg", "name": "Centre Stage", "role": "Main keynote stage", "company": "Altice Arena", "bio": "The biggest room in the summit. Headline speakers, the Opening Night keynote and the closing sessions all happen here, in front of up to 20,000 people." },
      { "id": "g2", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/FIL%2C_outubro_2024_03.jpg/1920px-FIL%2C_outubro_2024_03.jpg", "name": "AI Summit", "role": "Track", "company": "FIL Pavilions", "bio": "The fastest-growing track of recent editions: model builders, applied-AI founders and the researchers deciding what ships next." },
      { "id": "g3", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg/1920px-Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg", "name": "SaaS Monster", "role": "Track", "company": "FIL Pavilions", "bio": "For the software-eating-the-world crowd — pricing, product-led growth, retention war stories from operators who lived them." },
      { "id": "g4", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Web_Summit_2018_-_Partner_Booths_-_Day_3%2C_November_8_DG2_1947_%2830838827767%29.jpg/1920px-Web_Summit_2018_-_Partner_Booths_-_Day_3%2C_November_8_DG2_1947_%2830838827767%29.jpg", "name": "MoneyConf", "role": "Track", "company": "FIL Pavilions", "bio": "Fintech's home within the summit — payments, banking, crypto's quieter reboot and the regulators who have opinions about all of it." },
      { "id": "g5", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/FIL_Keil_do_Amaral_4870.jpg/1920px-FIL_Keil_do_Amaral_4870.jpg", "name": "FullStk", "role": "Track", "company": "FIL Pavilions", "bio": "Developers talking to developers: infrastructure, tooling, open source and the engineering behind products at scale." },
      { "id": "g6", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Web_Summit_2018_-_Pandaconf_-_Day_1%2C_November_6_HM1_5750_%2845753426381%29.jpg/1920px-Web_Summit_2018_-_Pandaconf_-_Day_1%2C_November_6_HM1_5750_%2845753426381%29.jpg", "name": "Pandaconf", "role": "Track", "company": "FIL Pavilions", "bio": "Media, marketing and advertising — where brands and publishers argue about attention, creators and what AI does to both." },
      { "id": "g7", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg/1920px-Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg", "name": "ALPHA Startup Programme", "role": "Programme", "company": "Startup stages", "bio": "Hundreds of hand-picked early-stage startups get an exhibitor stand, pitch coaching and a slot on stage. Apply through the website — places are allocated on a rolling basis." },
      { "id": "g8", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg/1920px-Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg", "name": "Women in Tech", "role": "Programme", "company": "Across all stages", "bio": "Dedicated programming, mentoring and networking across all four days — one of the largest women-in-tech gatherings in the world." },
      { "id": "g9", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Web_Summit_2022_-_Registration_20221031SAM000520_%2852467574646%29.jpg/1920px-Web_Summit_2022_-_Registration_20221031SAM000520_%2852467574646%29.jpg", "name": "Investor Office Hours", "role": "Programme", "company": "Investor lounge", "bio": "Partners from leading funds hold open, bookable office hours throughout the week. Bring the deck you actually believe in." },
      { "id": "g10", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg/1920px-Web_Summit_2017_-_Night_Summit_Day_2_DG2_7046_%2838216041066%29.jpg", "name": "Night Summit", "role": "Evening programme", "company": "Across Lisbon", "bio": "Every evening the conference leaves the building — hosted receptions, bar takeovers and parties across the city, included with your badge." }
    ],
    "guestsDisplay": { "layout": "grid", "columns": 3, "imageShape": "rounded", "imageFit": "cover", "cardStyle": "card", "align": "left", "showBio": true },
    "faq": [
      { "id": "f1", "q": "What are the exact dates?", "a": "**Monday 9 to Thursday 12 November 2026.** Opening Night is Monday evening in the Altice Arena; Tuesday, Wednesday and Thursday are full conference days at FIL, with the Night Summit across the city every evening." },
      { "id": "f2", "q": "Where does it happen?", "a": "At **FIL — Feira Internacional de Lisboa** in Parque das Nações, together with the adjacent **Altice Arena**. The whole campus sits next to Gare do Oriente, Lisbon's main rail and metro interchange." },
      { "id": "f3", "q": "What's included in my pass?", "a": "Access to all stages and tracks on all open days, the exhibition floors, the app and its networking features, and Night Summit events each evening. Workshops with limited capacity may require a free reservation in the app." },
      { "id": "f4", "q": "Is there a student discount?", "a": "Yes — heavily discounted student passes exist and sell out early. Valid student ID is checked at registration; bring it, or you'll be asked to pay the difference." },
      { "id": "f5", "q": "How do I apply for the ALPHA startup programme?", "a": "Through the startup application form on the official site. Applications are reviewed on a rolling basis and accepted companies get an exhibitor stand, pitch training and a stage slot. Applying early genuinely helps." },
      { "id": "f6", "q": "What language is it in?", "a": "Everything runs in English — talks, signage, the app. Lisbon itself is very comfortable for English speakers, and most menus and transport announcements carry English." },
      { "id": "f7", "q": "Can I get a refund?", "a": "Passes are generally non-refundable, but they can typically be transferred to a colleague before the transfer deadline announced closer to the event. Check the terms shown at checkout for the current policy." },
      { "id": "f8", "q": "How big is it, really?", "a": "Recent editions have drawn over 70,000 attendees from 150+ countries, with more than 1,000 speakers, around 2,600 exhibiting startups and over 1,000 investors. Wear comfortable shoes — the FIL campus alone is enormous." },
      { "id": "f9", "q": "Where should I stay?", "a": "Parque das Nações puts you in walking distance of everything — hotels cluster around the Vasco da Gama Tower and Gare do Oriente. Book early: the whole waterfront area sells out months ahead. Downtown Lisbon is 15–25 minutes away on the metro or train." },
      { "id": "f10", "q": "What accessibility provision is there?", "a": "Both FIL and the Altice Arena are modern, step-free venues with accessible restrooms, reserved viewing areas on the main stage and assistance available at registration. Contact the accessibility team ahead of time so support is ready when you arrive." }
    ],
    "map": {
      "coords": { "lat": 38.7672, "lng": -9.0955 },
      "transport": "Everything funnels through **Gare do Oriente**, five minutes' walk from FIL: metro (red line), suburban trains, intercity rail and about thirty bus routes. Lisbon Airport is two metro stops away — under 20 minutes door to door. Taxis and Uber drop at the designated stands on Alameda dos Oceanos.",
      "parking": "FIL operates its own on-site car park, and the Vasco da Gama shopping centre and Oceanário garages sit within ten minutes' walk. Expect event-day pricing and queues after 09:00 — public transport is genuinely faster.",
      "nearbyHotels": [
        { "name": "Myriad by SANA Hotels", "kind": "Hotel", "detail": "In the Vasco da Gama Tower — the skyline landmark of Parque das Nações", "walkMin": 12, "lat": 38.7745, "lng": -9.0940 },
        { "name": "Tivoli Oriente", "kind": "Hotel", "detail": "Beside Gare do Oriente, closest large hotel to FIL", "walkMin": 8, "lat": 38.7687, "lng": -9.0987 },
        { "name": "Holiday Inn Express Lisboa Oriente", "kind": "Hotel", "detail": "Av. Dom João II, ten minutes from the halls", "walkMin": 10, "lat": 38.7735, "lng": -9.0960 },
        { "name": "ibis budget Lisboa Oriente", "kind": "Hotel", "detail": "Budget option by the station interchange", "walkMin": 9, "lat": 38.7693, "lng": -9.0993 },
        { "name": "VIP Executive Arts Hotel", "kind": "Hotel", "detail": "Southern edge of Parque das Nações", "walkMin": 12, "lat": 38.7657, "lng": -9.0952 }
      ],
      "nearbyFood": [
        { "name": "Vasco da Gama Center food court", "kind": "Food court", "detail": "Fastest lunch option during the day — covered mall en route to the station", "walkMin": 8, "lat": 38.7681, "lng": -9.0989 },
        { "name": "Restaurants of Alameda dos Oceanos", "kind": "Restaurant strip", "detail": "A dozen mid-range Portuguese and international options along the park side", "walkMin": 6, "lat": 38.7700, "lng": -9.0950 },
        { "name": "Cervejaria Ramiro", "kind": "Restaurant", "detail": "Lisbon's famous seafood beer hall — worth the short taxi from the venue", "walkMin": 40, "lat": 38.7231, "lng": -9.1385 },
        { "name": "Time Out Market Lisboa", "kind": "Food hall", "detail": "The city's best-known food hall, in Cais do Sodré — plan it for an evening", "walkMin": 55, "lat": 38.7071, "lng": -9.1459 }
      ],
      "nearbyTransit": [
        { "name": "Gare do Oriente", "kind": "Transit hub", "detail": "Metro red line, suburban and intercity trains, buses — the main gateway to the venue", "walkMin": 6, "lat": 38.7684, "lng": -9.0986 },
        { "name": "Oriente Metro Station", "kind": "Metro stop", "detail": "Red line — direct to São Sebastião and the airport", "walkMin": 6, "lat": 38.7687, "lng": -9.0990 },
        { "name": "Lisbon Airport (LIS)", "kind": "Transit", "detail": "Two stops on the red line from Oriente — under 20 minutes door to door", "walkMin": 45, "lat": 38.7742, "lng": -9.1342 },
        { "name": "Telecabine Lisboa", "kind": "Attraction", "detail": "The cable car along the waterfront — the quickest way to see the whole park", "walkMin": 4, "lat": 38.7706, "lng": -9.0955 }
      ],
      "nearbyParking": [
        { "name": "FIL Car Park", "kind": "Car park", "detail": "On-site at the venue — fills before 09:00 on conference days", "walkMin": 2, "lat": 38.7663, "lng": -9.0960 },
        { "name": "Vasco da Gama Center Garage", "kind": "Car park", "detail": "Covered mall parking by the station", "walkMin": 8, "lat": 38.7683, "lng": -9.0992 },
        { "name": "Oceanário Garage", "kind": "Car park", "detail": "North end of the park, quietest of the three", "walkMin": 10, "lat": 38.7679, "lng": -9.0941 }
      ],
      "nearbyTaxi": [
        { "name": "Gare do Oriente Taxi Rank", "kind": "Taxi rank", "detail": "Staffed ranks on the station's east side; Uber/Bolt pick-up zone alongside", "walkMin": 6, "lat": 38.7689, "lng": -9.0978 },
        { "name": "FIL Drop-off Point", "kind": "Taxi rank", "detail": "Designated rideshare and taxi drop-off on Alameda dos Oceanos", "walkMin": 3, "lat": 38.7670, "lng": -9.0948 }
      ]
    },
    "ticketGroups": [
      { "tierId": "t-core", "name": "Core passes", "color": "violet", "rank": 1 },
      { "tierId": "t-plus", "name": "Plus passes", "color": "amber", "rank": 2 },
      { "tierId": "t-team", "name": "Teams & partners", "color": "slate", "rank": 3 },
      { "tierId": "t-night", "name": "Add-ons", "color": "rose", "rank": 4 }
    ],
    "tickets": [
      { "id": "tk-student", "groupId": "t-core", "name": "Student Pass", "price": 450, "qty": 3000, "description": "All four days, all stages, Night Summit included. Valid student ID required at registration." },
      { "id": "tk-alpha", "groupId": "t-core", "name": "ALPHA Startup Pass", "price": 1095, "qty": 2600, "description": "For accepted early-stage startups: exhibitor stand, pitch slot and full attendee access. Apply via the official site first." },
      { "id": "tk-attendee", "groupId": "t-core", "name": "Attendee Pass", "price": 2150, "qty": 55000, "description": "The standard pass — every stage, every track, the app and Night Summit access, all four days." },
      { "id": "tk-investor", "groupId": "t-plus", "name": "Investor Pass", "price": 3450, "qty": 1500, "description": "For active investors: investor lounge access, opt-in startup introductions and bookable office-hour slots." },
      { "id": "tk-premier", "groupId": "t-plus", "name": "Premier Attendee Pass", "price": 4950, "qty": 800, "description": "Attendee pass plus premier perks: priority seating on the main stage, dedicated lounges and concierge registration." },
      { "id": "tk-team5", "groupId": "t-team", "name": "Team Pack — 5 Attendees", "price": 8995, "qty": 600, "description": "Five Attendee Passes in one order for teams travelling together, with coordinated registration." },
      { "id": "tk-booth", "groupId": "t-team", "name": "Startup Booth Package", "price": 12500, "qty": 400, "description": "Turnkey exhibitor booth on the startup floor for the full week, including two Attendee Passes." },
      { "id": "tk-opening", "groupId": "t-night", "name": "Opening Night Reserved Seat", "price": 295, "qty": 4000, "description": "Guaranteed reserved seat in the Altice Arena for the Monday evening opening keynote." },
      { "id": "tk-workshops", "groupId": "t-night", "name": "Workshop Priority Add-on", "price": 395, "qty": 2000, "description": "Priority reservations for limited-capacity workshops and masterclasses across all four days." }
    ],
    "ticketSold": {
      "tk-student": 2740, "tk-alpha": 1985, "tk-attendee": 34620,
      "tk-investor": 1120, "tk-premier": 512,
      "tk-team5": 408, "tk-booth": 305,
      "tk-opening": 3110, "tk-workshops": 1240
    },
    "ticketSelection": {
      "enabled": true,
      "mode": "price",
      "seatsLabel": "Choose your pass",
      "priceLabel": "Choose by category and price",
      "features": ["plan", "insurance", "digital"],
      "autoAssignNote": "Passes are issued digitally per person. Team Packs let you assign each member's badge details later — names can change until the transfer deadline.",
      "soldOutNote": "This tier is sold out for the current phase. Released inventory and new-phase allocations appear here first — check back closer to the event."
    },
    "regSettings": { "showRemaining": true },
    "ctas": {
      "primaryLabel": "Get your pass",
      "items": [
        { "id": "cta-alpha", "label": "Apply for ALPHA", "url": "https://websummit.com/startups/", "style": "outline" },
        { "id": "cta-programme", "label": "See the stage programme", "url": "#sec-schedule", "style": "outline" },
        { "id": "cta-official", "label": "Official event site", "url": "https://websummit.com/", "style": "ghost" }
      ]
    },
    "questions": [
      { "id": "q1", "label": "Job title" },
      { "id": "q2", "label": "Company name" },
      { "id": "q3", "label": "What are you building or looking for?" },
      { "id": "q4", "label": "Dietary requirements (for evening receptions)" }
    ],
    "guidelines": [
      { "id": "gl1", "category": "dietary", "label": "Vegetarian and vegan at every catered event", "detail": "Official receptions and the exhibitor-floor catering always carry vegetarian and vegan options; allergen sheets are available at each service point. Evening Night Summit venues vary — tell us your requirements when registering and hosts are briefed." },
      { "id": "gl2", "category": "dietary", "label": "Halal, kosher and gluten-free on request", "detail": "Request these during checkout at least 14 days before the event so partner venues across the city can prepare." },
      { "id": "gl3", "category": "accessibility", "label": "Step-free throughout both venues", "detail": "FIL and the Altice Arena are modern step-free buildings with lifts between levels, accessible restrooms on every hall floor and reserved platforms for the main-stage arena." },
      { "id": "gl4", "category": "accessibility", "label": "Live captioning on major stages", "detail": "Centre Stage and the largest tracks carry live captions; transcripts land in the app after each session." },
      { "id": "gl5", "category": "accessibility", "label": "Assistance and quiet spaces", "detail": "Book assistance in advance via the accessibility team, and find quiet rooms marked on the venue map in the app if you need a break from the noise." },
      { "id": "gl6", "category": "accessibility", "label": "Accessible route from Gare do Oriente", "detail": "Step-free route from the station concourse to the FIL entrance takes about eight minutes along Rua do Bojador — follow the accessible-wayfinding signs." }
    ],
    "organizerAvatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Web_Summit_logo.svg/500px-Web_Summit_logo.svg.png",
    "team": [
      { "name": "Web Summit", "role": "Owner" },
      { "name": "FIL — Feira Internacional de Lisboa", "role": "Co-host" }
    ],
    "languages": [
      { "name": "English", "isDefault": true },
      { "name": "Português" },
      { "name": "Español" }
    ],
    "tags": ["Tech conference", "Four-day event", "70,000+ attendees", "Night Summit"],
    "galleryDisplay": { "layout": "carousel", "slidesPerView": 3, "autoplay": true, "autoplaySeconds": 5, "loop": true, "arrows": true, "dots": true },
    "sectionNotes": [
      { "id": "n1", "target": "schedule", "enabled": true, "text": "This timetable shows the shape of each day. The talk-by-talk programme, with named speakers, is released in waves through autumn and lives in the app." },
      { "id": "n2", "target": "register", "enabled": true, "text": "Web Summit sells in phases — pass prices rise as the event approaches. Figures shown here are indicative; the price displayed at checkout is the current phase price." },
      { "id": "n3", "target": "guests", "enabled": true, "text": "These are the stages, tracks and programmes of the summit rather than individual speakers. The 2026 line-up is announced progressively — watch the official channels." },
      { "id": "n4", "target": "guidelines", "enabled": true, "text": "Requirements must reach us at least 14 days before the event so venue and Night Summit partners can plan." }
    ],
    "disclaimer": {
      "enabled": true,
      "text": "This is a demonstration event page. Web Summit and related marks are trademarks of Web Summit. This page is not affiliated with, endorsed by or sponsored by Web Summit. Dates reflect the organiser's announced 9–12 November 2026 edition; pass tiers and prices are illustrative of the phased sales model, session times are provisional and photography shows previous editions.",
      "placements": ["hero", "above-footer"]
    },
    "infographics": [
      {
        "id": "ig-tracks",
        "type": "showcase",
        "props": {
          "title": "The summits inside the summit",
          "titleAlign": "left",
          "layoutMode": "grid",
          "columns": "2",
          "showOne": false,
          "clickOpen": true,
          "items": [
            { "title": "Centre Stage", "text": "Headline keynotes in front of 20,000 people in the Altice Arena — including Opening Night.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg/1920px-Web_Summit_2018_-_Centre_Stage_-_Day_2%2C_November_7_DSC_5243_%2844853627335%29.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "The main stage hosts the biggest names of the week, the Opening Night keynote on Monday and the closing sessions on Thursday. Doors fill fast — Premier pass holders get priority seating." },
            { "title": "AI Summit", "text": "Model builders, applied-AI founders and researchers deciding what ships next.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/FIL%2C_outubro_2024_03.jpg/1920px-FIL%2C_outubro_2024_03.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "The fastest-growing track of recent editions. Demos on the floor, debates on stage, and the corridor conversations that become the next funding round." },
            { "title": "SaaS Monster & FullStk", "text": "Operators on growth and pricing; developers on infrastructure and tooling.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg/1920px-Web_Summit_2018_-_SaaS_Monster_-_Day_2%2C_November_7_SD5_7595_%2844852022965%29.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "Two engineering-flavoured tracks side by side: SaaS Monster for the commercial side of software companies, FullStk for the people building them." },
            { "title": "ALPHA pitches & office hours", "text": "Early-stage founders pitch; investors hold bookable office hours all week.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg/1920px-Web_Summit_2017_-_PICTH_SAM_3288_%2837530266474%29.jpg", "textSide": "top", "ctaLabel": "Apply for ALPHA", "ctaUrl": "https://websummit.com/startups/", "details": "The engine room of the conference: hundreds of ALPHA startups exhibiting, pitching and meeting funds in structured office hours. This is where first meetings happen." }
          ]
        }
      },
      {
        "id": "ig-carousel",
        "type": "carousel",
        "props": {
          "title": "The campus and the neighbourhood",
          "titleAlign": "left",
          "autoplay": true,
          "mode": "row",
          "items": [
            { "title": "FIL — the exhibition halls", "text": "Dozens of stages and thousands of stands spread across the pavilions.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/FIL_Keil_do_Amaral_4870.jpg/1920px-FIL_Keil_do_Amaral_4870.jpg", "textSide": "bottom" },
            { "title": "The Altice Arena", "text": "Twenty thousand seats for Opening Night and every Centre Stage headline.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Oceanarium%27s_Vasco_mascot_with_the_Altice_Arena_and_Vasco_da_Gama_Tower_in_the_background%2C_Lisboa%2C_Portugal_julesvernex2.jpg/1920px-Oceanarium%27s_Vasco_mascot_with_the_Altice_Arena_and_Vasco_da_Gama_Tower_in_the_background%2C_Lisboa%2C_Portugal_julesvernex2.jpg", "textSide": "bottom" },
            { "title": "Registration", "text": "Badge collection in the FIL atrium — arrive Monday morning and beat the queues.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Web_Summit_2022_-_Registration_20221031SAM000024_%2852468134988%29.jpg/1920px-Web_Summit_2022_-_Registration_20221031SAM000024_%2852468134988%29.jpg", "textSide": "bottom" },
            { "title": "The Vasco da Gama Tower", "text": "The park's landmark — home to hotels and the best view over the venue.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Lisboa_-_Parque_das_Na%C3%A7%C3%B5es_-_20170814_-_Torre_Vasco_da_Gama_-_02.jpg/1920px-Lisboa_-_Parque_das_Na%C3%A7%C3%B5es_-_20170814_-_Torre_Vasco_da_Gama_-_02.jpg", "textSide": "bottom" },
            { "title": "Gare do Oriente", "text": "Metro, trains and buses — the way almost everyone arrives.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Oriente_metro_station_%28Lisbon%29.02.jpg/1920px-Oriente_metro_station_%28Lisbon%29.02.jpg", "textSide": "bottom" },
            { "title": "Parque das Nações at night", "text": "The waterfront district that hosts the Night Summit's calmer evenings.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Lisbon_Oceanarium%2C_Parque_das_Na%C3%A7%C3%B5es_at_Night.jpg/1920px-Lisbon_Oceanarium%2C_Parque_das_Na%C3%A7%C3%B5es_at_Night.jpg", "textSide": "bottom" }
          ]
        }
      },
      {
        "id": "ig-split",
        "type": "split",
        "props": {
          "title": "By the numbers",
          "titleAlign": "left",
          "text": "4 days · 70,000+ attendees · 1,000+ speakers · ~2,600 startups · 1,000+ investors\n\nOne campus: the FIL pavilions plus the 20,000-seat Altice Arena, five minutes' walk from Gare do Oriente and twenty minutes from Lisbon Airport.\n\nSince moving to Lisbon in 2016 it has grown into Europe's largest tech event — and the whole thing still fits inside one metro stop.",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Feira_Internacional_de_Lisboa.JPG/1920px-Feira_Internacional_de_Lisboa.JPG",
          "imageSide": "right",
          "ctaLabel": "Get your pass",
          "ctaUrl": "#tickets"
        }
      },
      {
        "id": "ig-quotes",
        "type": "quotes",
        "props": {
          "title": "What attendees say",
          "titleAlign": "left",
          "layout": "grid",
          "columns": "3",
          "items": [
            { "quote": "We arrived with a deck and a demo and left with two term-sheet conversations. Nowhere else compresses a year of pipeline into four days.", "name": "Founder, ALPHA programme", "role": "Series A, fintech" },
            { "quote": "The stages are great, but the real product is the hallway. I met more useful people between sessions than in any month of calls back home.", "name": "Attendee Pass holder", "role": "VP Engineering, SaaS" },
            { "quote": "Stay in Parque das Nações. Being fifteen minutes from your bed after the Night Summit is a competitive advantage by Thursday.", "name": "Returning attendee", "role": "Fourth edition" }
          ]
        }
      },
      {
        "id": "ig-footer",
        "type": "footer",
        "props": {
          "title": "Before you travel",
          "titleAlign": "left",
          "note": "Web Summit · FIL — Feira Internacional de Lisboa, Rua do Bojador, Parque das Nações, Lisboa · 9–12 November 2026. Demonstration page — see the disclaimer above.",
          "items": [
            { "title": "Official site", "link": "https://websummit.com/" },
            { "title": "Tickets", "link": "https://websummit.com/tickets/" },
            { "title": "Startup applications", "link": "https://websummit.com/startups/" },
            { "title": "Contact", "link": "mailto:info@websummit.com" }
          ]
        }
      }
    ],
    "pageDesign": {
      "mode": "themed",
      "accent": "violet",
      "cover": "accent",
      "font": "sans",
      "showGallery": true,
      "viewerMode": "dark",
      "theme": {
        "base": "dark",
        "colors": {
          "brand": "#6C47FF",
          "brandText": "#FFFFFF",
          "accent": "#FFB454",
          "link": "#A78BFF",
          "brandHover": "#8563FF",
          "brandTo": "#2A1670",
          "bg": "#0B0B10",
          "surface": "#15151D",
          "text": "#F4F4F6",
          "muted": "#A2A2AC",
          "border": "#2A2A35"
        },
        "font": { "heading": "grotesk", "body": "sans", "scale": "md", "headingFamily": "", "bodyFamily": "", "webfonts": [], "faces": [] },
        "logo": { "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Web_Summit_logo.svg/500px-Web_Summit_logo.svg.png", "height": 22, "link": "https://websummit.com/", "showBar": true, "showInFooter": true },
        "footerLogo": { "url": "", "height": 24, "link": "" },
        "source": { "url": "https://websummit.com/", "siteName": "Web Summit", "importedAt": "" },
        "header": {
          "show": true,
          "links": [
            { "label": "Overview", "url": "#sec-top" },
            { "label": "Schedule", "url": "#sec-schedule" },
            { "label": "Stages", "url": "#sec-guests" },
            { "label": "Getting there", "url": "#sec-location" },
            { "label": "FAQ", "url": "#sec-faq" }
          ],
          "cta": { "label": "Get your pass", "url": "#tickets" },
          "align": "split",
          "sticky": true,
          "background": "#0B0B10",
          "border": true,
          "navUpper": true,
          "navTracking": 0.06,
          "navWeight": "600",
          "navSize": 12
        },
        "headingWeight": "extrabold",
        "headingUpper": false,
        "headingTracking": -0.02,
        "headingLineHeight": 1.1,
        "bodyWeight": "",
        "radius": "rounded",
        "radiusPx": 10,
        "button": "solid",
        "buttonRadiusPx": 8,
        "buttonUpper": false,
        "buttonWeight": "700",
        "buttonTracking": 0,
        "borderWidth": 1,
        "elevation": "lifted",
        "width": "wide",
        "density": "spacious",
        "cover": "accent",
        "layout": "spotlight",
        "hero": "banner",
        "coverOverlay": "scrim",
        "sidebar": "right",
        "background": {
          "type": "image",
          "value": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg/1920px-Web_Summit_2017_-_Opening_Night_SD5_8169_%2826442680729%29.jpg",
          "overlay": "base",
          "dim": 92
        },
        "footerStyle": { "background": "#07070B", "text": "#E7E7EA" },
        "favicon": "",
        "tagline": "Four days in Lisbon. Everything tech, everyone who matters, one badge.",
        "themeColor": "#0B0B10"
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
        "text": "Web Summit 2026 · 9–12 November · FIL & Altice Arena, Lisbon",
        "links": [
          { "label": "Get your pass", "url": "#tickets" },
          { "label": "Schedule", "url": "#sec-schedule" },
          { "label": "Getting there", "url": "#sec-location" },
          { "label": "Accessibility", "url": "mailto:access@websummit.com" }
        ],
        "socials": [
          { "platform": "website", "url": "https://websummit.com/" },
          { "platform": "instagram", "url": "https://www.instagram.com/websummit/" },
          { "platform": "youtube", "url": "https://www.youtube.com/@WebSummit" },
          { "platform": "email", "url": "mailto:info@websummit.com" }
        ]
      }
    }
  }$meta$::jsonb
)
on conflict (id) do update set
  project_id  = excluded.project_id,
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
