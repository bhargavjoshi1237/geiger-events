-- Demo event: NEW YORK COMIC CON 2026
--
-- Fourth reference public page: North America's biggest fan convention, seeded
-- to show the presentation surface in a LIGHT themed skin (the other reference
-- pages are all dark) with the same full block coverage.
--
-- Real, sourced facts: NYCC returns to the Jacob K. Javits Convention Center
-- on 8-11 October 2026 for its twentieth anniversary. It is produced by
-- ReedPop and is North America's most-attended fan convention (200,000+
-- attendees in recent editions). Sunday is traditionally the family/kids-
-- friendly day; autographs and photo ops are sold separately on top of
-- badges; badges are sold through Fan Verification ahead of general sales.
--
-- Invented / illustrative, flagged on the page: `sold`/`revenue` totals,
-- badge prices (NYCC prices by badge type and phase; figures here mirror that
-- structure), the day-by-day programme shape, and all quotes. The 2026 guest
-- line-up is announced gradually by ReedPop, so the Guests block presents the
-- convention's standing areas and stages rather than named guests. All
-- photography shows previous editions and every caption says so.
--
-- Re-runnable: upserts on a fixed id, so `npm run db:seed` can be repeated.
-- Owns: one row in events.events.

insert into events.events (
  id, project_id, name, status, type, event_date, event_time, timezone,
  venue, address, city, capacity, sold, revenue, visibility, organizer,
  summary, cover_url, gallery, is_listable, metadata
) values (
  'b07a1cd0-2026-4a10-9c00-081020261000',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'New York Comic Con 2026',
  'On sale',
  'In-person',
  '2026-10-08',
  '10:00',
  'America/New_York',
  'Jacob K. Javits Convention Center',
  '429 11th Ave, New York, NY 10001',
  'New York',
  230000,
  187600,
  16000000,
  'Public',
  'ReedPop',
  'The twentieth anniversary of New York Comic Con. Four days, 200,000+ fans, the biggest panels and artists in pop culture — under one very large roof on Manhattan''s West Side.',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Cosplay_at_NYCC_%2860421%29.jpg/1920px-Cosplay_at_NYCC_%2860421%29.jpg',
  $gallery$[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Javits_Center_November_2022.jpg/1920px-Javits_Center_November_2022.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Jacob_Javits_Convention_Center.jpg/1920px-Jacob_Javits_Convention_Center.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG/1920px-NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Hudson_Yards_Vessel_IMG_3553_HLG.jpg/1920px-Hudson_Yards_Vessel_IMG_3553_HLG.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Fifteen_Hudson_Yards_and_Vessel.jpg/1920px-Fifteen_Hudson_Yards_and_Vessel.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Manhattan_from_Weehawken%2C_NJ.jpg/1920px-Manhattan_from_Weehawken%2C_NJ.jpg"
  ]$gallery$::jsonb,
  true,
  $meta${
    "description": "## Twenty years of New York's biggest fandom takeover\n\nIn October 2006, a comic convention at a then-unloved corner of the West Side drew far more people than anyone planned for. Two decades later, **New York Comic Con** is North America's most-attended fan convention — more than **200,000 fans across four days** — returning to the **Javits Center on 8–11 October 2026** for its twentieth anniversary.\n\nProduced by **ReedPop**, NYCC fills every hall with world-premiere panels, hundreds of artists in Artist Alley, show-floor booths from every major studio and publisher, gaming free-play, and one of the largest cosplay gatherings on Earth.\n\n### What a badge actually gets you\n\nMain-stage panels with the studios everyone is talking about. Autograph sessions with comics legends and screen stars. Exclusive reveals and first-to-buy drops on the show floor. Artist Alley commissions you literally cannot buy anywhere else. And four days surrounded by people who are exactly as enthusiastic as you are.\n\n### The city is part of the con\n\nOfficial after-parties, creator meetups and fan meetups spread across Chelsea and Hudson Yards every evening — with the High Line next door and Midtown ten minutes away. Come for the panels, stay for the city.",
    "highlights": [
      { "id": "h1", "title": "The 20th anniversary edition", "detail": "Two decades since the crowded first edition in 2006 — expect anniversary programming across all four days." },
      { "id": "h2", "title": "North America's biggest fan con", "detail": "200,000+ attendees make NYCC the most-attended fan convention on the continent." },
      { "id": "h3", "title": "Artist Alley", "detail": "Hundreds of comic creators sketching, signing and selling original work — bring a commission list." },
      { "id": "h4", "title": "World-premiere panels", "detail": "Studios and streamers bring the casts, the clips and the announcements to the Main Stage." },
      { "id": "h5", "title": "Cosplay at planetary scale", "detail": "Thousands of cosplayers, contest stages and meetups for every fandom all weekend." },
      { "id": "h6", "title": "Sunday is Family Day", "detail": "Kid-friendly programming, discounted kids' access and shorter lines — the gentlest day to bring new fans." }
    ],
    "schedule": [
      { "id": "s1", "layout": "timeline", "spacing": "normal", "frame": "boxed", "sectionNote": "Show hours follow recent editions; the panel-by-panel schedule is published by ReedPop in the weeks before the show and in the official app. Programming is subject to change.", "time": "10:00", "title": "Doors open — Day One", "description": "Badge pickup opens early, then the halls flood. Hit the show floor map in the app before the aisles thicken.", "by": "Thursday 8 October", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Javits_Center_November_2022.jpg/1920px-Javits_Center_November_2022.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s2", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "11:00", "title": "First Main Stage panels", "description": "The opening-day headline panels set the tone — arrive an hour early for the big rooms.", "by": "Thursday 8 October", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s3", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "19:00", "title": "After hours", "description": "Official parties, creator mixers and fan meetups across Chelsea and Hudson Yards.", "by": "Thursday 8 October" },
      { "id": "s4", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "10:00", "title": "Day Two — Artist Alley in full swing", "description": "The best commission slots go early morning. Exhibitor exclusives restock overnight.", "by": "Friday 9 October" },
      { "id": "s5", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "13:00", "title": "Autograph sessions", "description": "Photo ops and autograph tables run all afternoon — tickets for marquee guests sell separately and in advance.", "by": "Friday 9 October" },
      { "id": "s6", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "10:00", "title": "Saturday — peak con", "description": "The biggest crowd, the biggest panels, the cosplay contest qualifiers. Plan your day around two anchor panels and let the floor surprise you.", "by": "Saturday 10 October" },
      { "id": "s7", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Cosplay Central gathering", "description": "Fandom photo meetups converge on the concourse — the single most photographed hour of the weekend.", "by": "Saturday 10 October" },
      { "id": "s8", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "10:00", "title": "Sunday — Family & Kids Day", "description": "Family programming, kid-friendly panels and lighter crowds. A gentle landing for new fans and tired feet alike.", "by": "Sunday 11 October" },
      { "id": "s9", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Final walk & closing", "description": "Last-chance exclusives, goodbye lines and the traditional slow drift toward Penn Station wearing everything you bought.", "by": "Sunday 11 October" }
    ],
    "guests": [
      { "id": "g1", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg", "name": "Main Stage", "role": "Headline panels", "company": "Biggest room in the Javits", "bio": "Studio showcases, cast appearances and first-look premieres. The rooms fill early — same-day re-entry rules apply, so plan anchors, not marathons." },
      { "id": "g2", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Cosplay_at_NYCC_%2860421%29.jpg/1920px-Cosplay_at_NYCC_%2860421%29.jpg", "name": "Cosplay Central", "role": "Cosplay contest & meetups", "company": "All weekend", "bio": "Construction contests, repair stations, fandom photo meets and the main-stage costume competition. Every skill level, zero gatekeeping." },
      { "id": "g3", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Jacob_Javits_Convention_Center.jpg/1920px-Jacob_Javits_Convention_Center.jpg", "name": "The Show Floor", "role": "Exhibitors & exclusives", "company": "Every major publisher and studio", "bio": "Booth exclusives, first-to-buy drops and stage demos. The floor map lives in the app — star your targets before doors open." },
      { "id": "g4", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG/1920px-NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG", "name": "Artist Alley", "role": "Comics creators & illustrators", "company": "Hundreds of tables", "bio": "The beating heart of the con: original art, self-published work and commissions drawn while you wait. Bring cash and a shortlist." },
      { "id": "g5", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Fifteen_Hudson_Yards_and_Vessel.jpg/1920px-Fifteen_Hudson_Yards_and_Vessel.jpg", "name": "After Hours", "role": "Evening events", "company": "Venues across Chelsea & Hudson Yards", "bio": "Official parties, screenings and fan takeovers after the halls close each night. RSVPs open closer to the show." },
      { "id": "g6", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Hudson_Yards_Vessel_IMG_3553_HLG.jpg/1920px-Hudson_Yards_Vessel_IMG_3553_HLG.jpg", "name": "Gaming & Tabletop", "role": "Free-play zones", "company": "Consoles, PC & tabletop halls", "bio": "Hands-on demos, tournaments running all weekend, and a tabletop hall worth budgeting two hours you don't have." }
    ],
    "guestsDisplay": { "layout": "grid", "columns": 3, "imageShape": "rounded", "imageFit": "cover", "cardStyle": "card", "align": "left", "showBio": true },
    "faq": [
      { "id": "f1", "q": "What are the dates?", "a": "**Thursday 8 to Sunday 11 October 2026** — the twentieth anniversary edition, back at the Javits Center on Manhattan's West Side." },
      { "id": "f2", "q": "How do I get a badge?", "a": "Badges are sold in phases — Fan Verified presales run ahead of any general sale, so create a verified account with the official ticketing partner well before badges go live. Popular days, especially Saturday, sell out fast." },
      { "id": "f3", "q": "Is Sunday still the family day?", "a": "Yes — Sunday carries the family-friendly programming, with dedicated kids' activities and a calmer floor. Kids' badges are priced separately and children under a certain age attend free with a badged adult." },
      { "id": "f4", "q": "Do autographs and photo ops cost extra?", "a": "Typically yes — celebrity autographs and professional photo ops are sold as separate add-ons, often in advance and frequently selling out before the show. Comics creators in Artist Alley set their own table pricing." },
      { "id": "f5", "q": "What's the costume and props policy?", "a": "Costumes are welcome and celebrated. Prop weapons must pass prop check at entry and be peace-bonded; anything metallic, projectile-firing or life-sized-blade-shaped stays home. Full rules ship with your badge." },
      { "id": "f6", "q": "What about bags?", "a": "Bags are searched at entry and size limits apply. A clear bag speeds up every line — and doubles as a way to show off your pins collection." },
      { "id": "f7", "q": "Can I leave and come back?", "a": "Yes — your badge allows same-day re-entry. In practice, the smart move is picking up food outside the hall, where it's cheaper and quieter than the concourse." },
      { "id": "f8", "q": "How do I get to the Javits Center?", "a": "Take the **7 train to 34 St–Hudson Yards** and walk west along 34th Street, about ten minutes. Penn Station (LIRR, NJ Transit, Amtrak, A/C/E and 1/2/3) is fifteen minutes on foot. Buses on 11th and 12th Avenue stop at the door." },
      { "id": "f9", "q": "Where should I stay?", "a": "Hotels cluster around Hudson Yards, Chelsea and Times Square — all within walking distance or one subway stop. Official discounted blocks open alongside badge sales and vanish quickly." },
      { "id": "f10", "q": "How accessible is the venue?", "a": "The Javits Center is fully ADA-accessible: step-free entrances, elevators to every level, accessible restrooms, and companion seating in panel rooms. Accessibility services desks are positioned at each entrance." }
    ],
    "map": {
      "coords": { "lat": 40.7555, "lng": -73.9936 },
      "transport": "**34 St–Hudson Yards (7 train)** is the closest subway, a ten-minute walk east along 34th Street. **Penn Station** — LIRR, NJ Transit, Amtrak plus the A/C/E and 1/2/3 — is fifteen minutes on foot and the arrival point for most of the East Coast. Cross-town buses stop along 11th and 12th Avenue right by the halls.",
      "parking": "There are commercial garages along 11th and 12th Avenue, but con-weekend demand turns them expensive and slow. The subway or a walk from Penn Station beats circling Hell's Kitchen by a mile.",
      "nearbyHotels": [
        { "name": "Equinox Hotel Hudson Yards", "kind": "Hotel", "detail": "The luxury option, steps from the 7 train", "walkMin": 12, "lat": 40.7559, "lng": -74.0022 },
        { "name": "YOTEL New York Times Square", "kind": "Hotel", "detail": "Compact cabins on 42nd & 10th — popular with con-goers", "walkMin": 14, "lat": 40.7590, "lng": -73.9937 },
        { "name": "Hyatt Place NYC/Times Square", "kind": "Hotel", "detail": "Mid-range, between Penn Station and the Javits", "walkMin": 12, "lat": 40.7531, "lng": -73.9917 },
        { "name": "Moxy NYC Chelsea", "kind": "Hotel", "detail": "Playful stay south of the venue", "walkMin": 15, "lat": 40.7509, "lng": -73.9948 }
      ],
      "nearbyFood": [
        { "name": "Hudson Yards restaurants", "kind": "Dining hall", "detail": "Five-minute walk from the 7 station — fastest decent lunch near the con", "walkMin": 12, "lat": 40.7559, "lng": -74.0016 },
        { "name": "Little Spain", "kind": "Food hall", "detail": "Spanish food market inside Hudson Yards", "walkMin": 12, "lat": 40.7557, "lng": -74.0020 },
        { "name": "Chelsea Market", "kind": "Food hall", "detail": "Iconic indoor market — worth escaping the halls for", "walkMin": 18, "lat": 40.7424, "lng": -74.0061 },
        { "name": "Los Tacos No.1", "kind": "Taquería", "detail": "Chelsea Market's most famous stall", "walkMin": 18, "lat": 40.7423, "lng": -74.0060 }
      ],
      "nearbyTransit": [
        { "name": "34 St–Hudson Yards (7)", "kind": "Transit stop", "detail": "Closest subway station to the Javits — ten minutes on foot", "walkMin": 10, "lat": 40.7556, "lng": -74.0020 },
        { "name": "Penn Station / Moynihan Train Hall", "kind": "Transit hub", "detail": "LIRR, NJ Transit, Amtrak + A/C/E and 1/2/3 subways", "walkMin": 15, "lat": 40.7506, "lng": -73.9937 },
        { "name": "Port Authority Bus Terminal", "kind": "Transit hub", "detail": "NJ and interstate buses, A/C/E connection", "walkMin": 20, "lat": 40.7569, "lng": -73.9900 },
        { "name": "Times Sq–42 St", "kind": "Transit stop", "detail": "Nearly every line in the system, one stop from Hudson Yards", "walkMin": 22, "lat": 40.7580, "lng": -73.9855 }
      ],
      "nearbyParking": [
        { "name": "12th Avenue Garages", "kind": "Car park", "detail": "Row of commercial garages opposite the Javits", "walkMin": 4, "lat": 40.7560, "lng": -73.9960 },
        { "name": "11th Avenue Garages", "kind": "Car park", "detail": "Multiple facilities beside the venue — priciest on Saturdays", "walkMin": 3, "lat": 40.7550, "lng": -73.9920 },
        { "name": "Pier 76 / West Side lots", "kind": "Car park", "detail": "Occasional event overflow parking toward the river", "walkMin": 7, "lat": 40.7570, "lng": -73.9980 }
      ],
      "nearbyTaxi": [
        { "name": "Javits Taxi & Rideshare Stand", "kind": "Taxi rank", "detail": "Designated pick-up zones on 11th Ave staffed during show hours", "walkMin": 2, "lat": 40.7552, "lng": -73.9925 },
        { "name": "Hudson Yards Rideshare Point", "kind": "Taxi rank", "detail": "Structured Uber/Lyft pick-up north of the venue", "walkMin": 11, "lat": 40.7565, "lng": -74.0010 }
      ]
    },
    "ticketGroups": [
      { "tierId": "t-single", "name": "Single-day badges", "color": "amber", "rank": 1 },
      { "tierId": "t-multi", "name": "Full-con badges", "color": "violet", "rank": 2 },
      { "tierId": "t-kids", "name": "Kids & family", "color": "sky", "rank": 3 },
      { "tierId": "t-vip", "name": "VIP packages", "color": "rose", "rank": 4 }
    ],
    "tickets": [
      { "id": "tk-thu", "groupId": "t-single", "name": "Thursday Badge", "price": 55, "qty": 45000, "description": "Opening day access — lighter crowds, full show floor, first panels." },
      { "id": "tk-fri", "groupId": "t-single", "name": "Friday Badge", "price": 75, "qty": 50000, "description": "Day two: Artist Alley peaks and the evening party scene opens." },
      { "id": "tk-sat", "groupId": "t-single", "name": "Saturday Badge", "price": 105, "qty": 55000, "description": "Peak con — headline panels, biggest cosplay turnout, busiest floor." },
      { "id": "tk-sun", "groupId": "t-single", "name": "Sunday Badge", "price": 65, "qty": 45000, "description": "Family Day — relaxed programming and last-chance exclusives." },
      { "id": "tk-4day", "groupId": "t-multi", "name": "Four-Day Badge", "price": 215, "qty": 30000, "description": "All four days at the best per-day price, plus badge mailing where available." },
      { "id": "tk-kids", "groupId": "t-kids", "name": "Kids Sunday Badge", "price": 25, "qty": 8000, "description": "For young fans attending with a badged adult on Family Day." },
      { "id": "tk-family4", "groupId": "t-kids", "name": "Family Four-Pack — Sunday", "price": 180, "qty": 2500, "description": "Two adult + two kids Sunday badges in one purchase." },
      { "id": "tk-vip", "groupId": "t-vip", "name": "Anniversary VIP Package", "price": 850, "qty": 1200, "description": "Four-day badge plus priority panel lines, exclusive merch pack and lounge access." },
      { "id": "tk-vipartist", "groupId": "t-vip", "name": "Artist Alley Insider Package", "price": 495, "qty": 800, "description": "Early Artist Alley entry sessions and a creator signing bundle, Thursday to Friday." }
    ],
    "ticketSold": {
      "tk-thu": 38200, "tk-fri": 44100, "tk-sat": 52400, "tk-sun": 30900,
      "tk-4day": 21800,
      "tk-kids": 6100, "tk-family4": 1900,
      "tk-vip": 1010, "tk-vipartist": 690
    },
    "ticketSelection": {
      "enabled": true,
      "mode": "price",
      "seatsLabel": "Choose your badge",
      "priceLabel": "Choose by day and price",
      "features": ["plan", "insurance", "digital"],
      "autoAssignNote": "Badges are issued digitally per person and linked at the gate — names can be corrected until the week before the show.",
      "soldOutNote": "This badge is sold out for the current phase. Returned inventory goes back on sale here first — watch this space closer to October."
    },
    "regSettings": { "showRemaining": true },
    "ctas": {
      "primaryLabel": "Get badges",
      "items": [
        { "id": "cta-programme", "label": "See the show days", "url": "#sec-schedule", "style": "outline" },
        { "id": "cta-plan", "label": "Plan your visit", "url": "#sec-location", "style": "outline" },
        { "id": "cta-official", "label": "Official site", "url": "https://newyorkcomiccon.com/", "style": "ghost" }
      ]
    },
    "questions": [
      { "id": "q1", "label": "Fandoms you're most excited for" },
      { "id": "q2", "label": "Cosplaying? Tell us what you're building" },
      { "id": "q3", "label": "Accessible services required" },
      { "id": "q4", "label": "First NYCC?" }
    ],
    "guidelines": [
      { "id": "gl1", "category": "dietary", "label": "Eat outside the hall — seriously", "detail": "Concourse concessions carry standard vegetarian options, but the best cheap eats are the food carts on 11th Avenue and the markets at Hudson Yards, all within ten minutes on foot." },
      { "id": "gl2", "category": "dietary", "label": "Allergy info at every vendor", "detail": "Show-floor food vendors carry allergen sheets on request; sealed outside food is permitted in the halls." },
      { "id": "gl3", "category": "accessibility", "label": "A fully ADA-accessible venue", "detail": "Step-free entry at every Javits entrance, elevators to all levels, accessible restrooms throughout, and companion seating in panel rooms." },
      { "id": "gl4", "category": "accessibility", "label": "Accessibility services desk", "detail": "Staffed at each entrance for questions, quiet-room directions and assistance coordination during show hours." },
      { "id": "gl5", "category": "accessibility", "label": "Sensory considerations", "detail": "Show mornings are the loudest and busiest; Sunday Family Day is noticeably gentler, and quiet corners exist on the concourse level — ask the services desk." },
      { "id": "gl6", "category": "accessibility", "label": "Cane, wheelchair and stroller friendly", "detail": "Wide aisles and elevator banks serve every hall; the route from the 7 train includes step-free exits at Hudson Yards." }
    ],
    "organizerAvatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Cosplay_at_NYCC_%2860421%29.jpg/1920px-Cosplay_at_NYCC_%2860421%29.jpg",
    "team": [
      { "name": "ReedPop", "role": "Owner" },
      { "name": "Jacob K. Javits Convention Center", "role": "Venue partner" }
    ],
    "languages": [
      { "name": "English", "isDefault": true },
      { "name": "Español" }
    ],
    "tags": ["Comic convention", "20th anniversary", "200,000+ fans", "Four days"],
    "galleryDisplay": { "layout": "carousel", "slidesPerView": 3, "autoplay": true, "autoplaySeconds": 5, "loop": true, "arrows": true, "dots": true },
    "sectionNotes": [
      { "id": "n1", "target": "schedule", "enabled": true, "text": "Show hours mirror recent editions; the panel-by-panel programme lands in the official app in the weeks before the show and changes right up until doors." },
      { "id": "n2", "target": "register", "enabled": true, "text": "NYCC sells badges in phases through Fan Verification, with prices rising as each phase sells out. Figures shown are indicative — the checkout price is authoritative." },
      { "id": "n3", "target": "guests", "enabled": true, "text": "These are the convention's areas and stages rather than named 2026 guests. ReedPop announces the guest line-up in waves through summer and autumn." },
      { "id": "n4", "target": "guidelines", "enabled": true, "text": "Policies follow recent editions and the venue's standing rules; the badge terms shipped with your purchase are definitive." }
    ],
    "disclaimer": {
      "enabled": true,
      "text": "This is a demonstration event page. New York Comic Con and related marks belong to ReedPop. This page is not affiliated with, endorsed by or sponsored by ReedPop. Dates reflect the announced 8–11 October 2026 edition; badge tiers and prices are illustrative, the programme is provisional and photography shows previous editions.",
      "placements": ["hero", "above-footer"]
    },
    "infographics": [
      {
        "id": "ig-zones",
        "type": "showcase",
        "props": {
          "title": "One roof, four different conventions",
          "titleAlign": "left",
          "layoutMode": "grid",
          "columns": "2",
          "showOne": false,
          "clickOpen": true,
          "items": [
            { "title": "The Show Floor", "text": "Every studio, publisher and toy maker with exclusives you can't buy anywhere else.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG/1920px-NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG", "textSide": "top", "ctaLabel": "Plan your days", "ctaUrl": "#sec-schedule", "details": "The commercial heart of the con: booth drops at opening, restocks at noon, and aisle-clogging crowds by two. Star your targets in the app and shop before you browse." },
            { "title": "Artist Alley", "text": "Hundreds of creators drawing, signing and selling original work.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Jacob_Javits_Convention_Center.jpg/1920px-Jacob_Javits_Convention_Center.jpg", "textSide": "top", "ctaLabel": "Plan your days", "ctaUrl": "#sec-schedule", "details": "Where the con started twenty years ago and still its soul: commission a piece, discover your next favourite indie series, shake the hand that drew it." },
            { "title": "Panel Rooms", "text": "From the Main Stage premieres to fifty-seat deep-dive talks.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "The big rooms need queuing hours ahead; the small rooms reward walking in on a whim. Both strategies produce the stories you'll tell afterwards." },
            { "title": "Cosplay Central", "text": "Contests, construction clinics and the weekend's great photo meetups.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Cosplay_at_NYCC_%2860421%29.jpg/1920px-Cosplay_at_NYCC_%2860421%29.jpg", "textSide": "top", "ctaLabel": "Get badges", "ctaUrl": "#tickets", "details": "Repair stations with hot glue and safety pins, contest stages with real prizes, and Saturday's cross-fandom meetup — the most photographed hour of the year." }
          ]
        }
      },
      {
        "id": "ig-carousel",
        "type": "carousel",
        "props": {
          "title": "The venue and the neighborhood",
          "titleAlign": "left",
          "autoplay": true,
          "mode": "row",
          "items": [
            { "title": "The Javits Center", "text": "Six blocks of halls on the Hudson — wear your worst shoes.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Javits_Center_November_2022.jpg/1920px-Javits_Center_November_2022.jpg", "textSide": "bottom" },
            { "title": "Eleventh Avenue entrance", "text": "Badge check, prop check, and the first view of the floor.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG/1920px-NY_Jacob_K_Javits_Convention_Center_IMG_2172.JPG", "textSide": "bottom" },
            { "title": "The Vessel, Hudson Yards", "text": "Ten minutes from the halls — midpoint between con and dinner.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Hudson_Yards_Vessel_IMG_3553_HLG.jpg/1920px-Hudson_Yards_Vessel_IMG_3553_HLG.jpg", "textSide": "bottom" },
            { "title": "Hudson Yards", "text": "Restaurants, food halls and the 7 train home.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Fifteen_Hudson_Yards_and_Vessel.jpg/1920px-Fifteen_Hudson_Yards_and_Vessel.jpg", "textSide": "bottom" },
            { "title": "Manhattan from the Hudson", "text": "The skyline you'll be too tired to photograph by Sunday.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Manhattan_from_Weehawken%2C_NJ.jpg/1920px-Manhattan_from_Weehawken%2C_NJ.jpg", "textSide": "bottom" },
            { "title": "Panels, past editions", "text": "Twenty years in, the rooms still hit capacity an hour early.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg/1920px-New_York_Comic_Con_2018%3B_Women_of_Marvel_panel_4.jpg", "textSide": "bottom" }
          ]
        }
      },
      {
        "id": "ig-split",
        "type": "split",
        "props": {
          "title": "By the numbers",
          "titleAlign": "left",
          "text": "4 days · 200,000+ fans · 20th anniversary · hundreds of artists · every major publisher\n\nThe Javits Center fills six city blocks on Manhattan's West Side — ten minutes from the 7 train, fifteen from Penn Station, and a world away from ordinary weekends.\n\nSince a chaotic first edition in February 2006, it has grown into North America's most-attended fan convention.",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Jacob_Javits_Convention_Center.jpg/1920px-Jacob_Javits_Convention_Center.jpg",
          "imageSide": "right",
          "ctaLabel": "Get your badge",
          "ctaUrl": "#tickets"
        }
      },
      {
        "id": "ig-quotes",
        "type": "quotes",
        "props": {
          "title": "What regulars will tell you",
          "titleAlign": "left",
          "layout": "grid",
          "columns": "3",
          "items": [
            { "quote": "My rule: one anchor panel a day, everything else improvised. The improvised half is always better.", "name": "Four-day badge holder", "role": "Nine consecutive years" },
            { "quote": "I queued ninety minutes for a panel and forty minutes for an artist who drew my D&D character. Only one of those was worth it — and I can't tell you which without lying.", "name": "Saturday attendee", "role": "Third NYCC" },
            { "quote": "Stay in Chelsea, not Times Square. Twenty minutes more sleep and you're first through the doors on Saturday.", "name": "Veteran exhibitor", "role": "Artists' table, five years" }
          ]
        }
      },
      {
        "id": "ig-footer",
        "type": "footer",
        "props": {
          "title": "Before you go",
          "titleAlign": "left",
          "note": "ReedPop · Jacob K. Javits Convention Center, 429 11th Ave, New York, NY 10001 · 8–11 October 2026. Demonstration page — see the disclaimer above.",
          "items": [
            { "title": "Official site", "link": "https://newyorkcomiccon.com/" },
            { "title": "Badges & Fan Verification", "link": "https://newyorkcomiccon.com/en-us/tickets/badges.html" },
            { "title": "Getting there", "link": "#sec-location" },
            { "title": "Contact", "link": "mailto:info@newyorkcomiccon.com" }
          ]
        }
      }
    ],
    "pageDesign": {
      "mode": "themed",
      "accent": "rose",
      "cover": "accent",
      "font": "sans",
      "showGallery": true,
      "viewerMode": "auto",
      "theme": {
        "base": "light",
        "colors": {
          "brand": "#E23B2E",
          "brandText": "#FFFFFF",
          "accent": "#FFC93C",
          "link": "#C22E23",
          "brandHover": "#C92F24",
          "brandTo": "#8F1D15",
          "bg": "#FAF7F2",
          "surface": "#FFFFFF",
          "text": "#17161A",
          "muted": "#6B6870",
          "border": "#E4DFD6"
        },
        "font": { "heading": "grotesk", "body": "sans", "scale": "md", "headingFamily": "", "bodyFamily": "", "webfonts": [], "faces": [] },
        "logo": { "url": "", "height": 24, "link": "", "showBar": false, "showInFooter": false },
        "footerLogo": { "url": "", "height": 24, "link": "" },
        "source": { "url": "https://newyorkcomiccon.com/", "siteName": "New York Comic Con", "importedAt": "" },
        "header": {
          "show": true,
          "links": [
            { "label": "Overview", "url": "#sec-top" },
            { "label": "Schedule", "url": "#sec-schedule" },
            { "label": "The con", "url": "#sec-guests" },
            { "label": "Plan your visit", "url": "#sec-location" },
            { "label": "FAQ", "url": "#sec-faq" }
          ],
          "cta": { "label": "Get badges", "url": "#tickets" },
          "align": "split",
          "sticky": true,
          "background": "#FAF7F2",
          "border": true,
          "navUpper": true,
          "navTracking": 0.05,
          "navWeight": "700",
          "navSize": 12
        },
        "headingWeight": "black",
        "headingUpper": false,
        "headingTracking": -0.02,
        "headingLineHeight": 1.1,
        "bodyWeight": "",
        "radius": "rounded",
        "radiusPx": 14,
        "button": "solid",
        "buttonRadiusPx": 999,
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
          "type": "color",
          "value": "",
          "overlay": "base",
          "dim": 0
        },
        "footerStyle": { "background": "#17161A", "text": "#F2EFF9" },
        "favicon": "",
        "tagline": "Twenty years of fandom on the Hudson. Four days, one very loud building.",
        "themeColor": "#FAF7F2"
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
        "text": "New York Comic Con 2026 · 8–11 October · Javits Center, NYC",
        "links": [
          { "label": "Badges", "url": "#tickets" },
          { "label": "Schedule", "url": "#sec-schedule" },
          { "label": "Plan your visit", "url": "#sec-location" },
          { "label": "Accessibility", "url": "#sec-faq" }
        ],
        "socials": [
          { "platform": "website", "url": "https://newyorkcomiccon.com/" },
          { "platform": "instagram", "url": "https://www.instagram.com/nycc/" },
          { "platform": "youtube", "url": "https://www.youtube.com/results?search_query=new+york+comic+con" },
          { "platform": "email", "url": "mailto:info@newyorkcomiccon.com" }
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
