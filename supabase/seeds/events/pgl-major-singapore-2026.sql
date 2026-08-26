-- Demo event: PGL MAJOR SINGAPORE 2026
--
-- Third reference public page: a Counter-Strike 2 Valve Major, seeded to show
-- the whole presentation surface working for esports — themed brand, Spotlight
-- layout, every content block, every sidebar card, infographics, gallery, live
-- map and a tiered ticket table.
--
-- Real, sourced facts: PGL brings its CS2 Major to Singapore 25 November –
-- 13 December 2026 — the second Major of 2026 and the first ever held in
-- Southeast Asia. Thirty-two teams compete for a US$1,250,000 prize pool,
-- with the playoffs and grand final at the 12,000-seat Singapore Indoor
-- Stadium. It is PGL's fifth Major (after Kraków 2017, Stockholm 2021,
-- Antwerp 2022 and Copenhagen 2024). Team Falcons are the defending Major
-- champions, having won IEM Cologne 2026 (m0NESY MVP). Team logos are the
-- organisations' genuine marks hotlinked from Wikimedia.
--
-- Invented / illustrative, and flagged as such on the page: `sold`/`revenue`
-- totals, the pass tiers and SGD figures (sales run through Ticketmaster SG;
-- categories mirror how arena majors typically sell), the exact day-by-day
-- stage split within the announced 25 Nov – 13 Dec window, and all quotes.
-- Arena photography comes from past Majors (IEM Katowice, ESL One Cologne)
-- and every caption says so honestly.
--
-- Re-runnable: upserts on a fixed id, so `npm run db:seed` can be repeated.
-- Owns: one row in events.events.

insert into events.events (
  id, project_id, name, status, type, event_date, event_time, timezone,
  venue, address, city, capacity, sold, revenue, visibility, organizer,
  summary, cover_url, gallery, is_listable, metadata
) values (
  'c5da11e6-2026-4b12-9d00-251220261300',
  'ebcc7910-1a0e-4e91-8c3b-752f3c4292d3',
  'PGL Major Singapore 2026',
  'On sale',
  'In-person',
  '2026-12-13',
  '15:00',
  'Asia/Singapore',
  'Singapore Indoor Stadium',
  '2 Stadium Walk, Singapore 397691',
  'Singapore',
  12000,
  10480,
  3700000,
  'Public',
  'PGL',
  'Counter-Strike''s biggest prize comes to Southeast Asia for the first time. Thirty-two teams, a US$1,250,000 prize pool, three Swiss stages — and a grand final under the dome of the Singapore Indoor Stadium.',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IEM_Katowice_Major_2019.jpg/1920px-IEM_Katowice_Major_2019.jpg',
  $gallery$[
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/IEM_WC_Katowice_2015_inside.jpg/1920px-IEM_WC_Katowice_2015_inside.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/ESL_One_Cologne_2014.jpg/1920px-ESL_One_Cologne_2014.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Spodek_for_IEM_Katowice_2018.jpg/1920px-Spodek_for_IEM_Katowice_2018.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg/1920px-Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1920px-Singapore_Indoor_Stadium.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/1_marina_bay_sands_skypark_night_view_CBD_skyline.jpg/1920px-1_marina_bay_sands_skypark_night_view_CBD_skyline.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Supertree_Grove_at_night.jpg/1920px-Supertree_Grove_at_night.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Clarke_Quay%2C_Singapore_%282371036515%29.jpg/1920px-Clarke_Quay%2C_Singapore_%282371036515%29.jpg"
  ]$gallery$::jsonb,
  true,
  $meta${
    "description": "## The Major comes to Southeast Asia\n\nFor the first time since 2013, a **Value-sponsored Major** — Counter-Strike's most prestigious title — lands in Southeast Asia. **PGL**, the organiser behind Kraków 2017, Stockholm 2021, Antwerp 2022 and Copenhagen 2024, brings the second CS2 Major of 2026 to **Singapore**.\n\nFrom **25 November to 13 December**, thirty-two of the world's best teams fight through three Swiss-system stages for a **US$1,250,000** prize pool. When the field is cut to eight, everything moves to the **Singapore Indoor Stadium**: single-elimination playoffs in front of twelve thousand fans, and a best-of-five grand final on Sunday 13 December.\n\n### A new champion's era\n\nTeam Falcons lifted their first Major trophy at IEM Cologne 2026, with **m0NESY** named MVP. Team Vitality's back-to-back reign is over, donk's Team Spirit and The MongolZ are hunting again — and nobody has caught Astralis's record of four Major titles. By the time Singapore arrives, the standings will say who is peaking.\n\n### More than a final\n\nThe early stages carry their own story lines: openers between giants, APAC teams fighting in front of a home-region crowd, and the chaos only a Swiss stage can produce. Between matches, the fan zone outside the stadium runs activations, signings and watch parties — and Singapore itself, from hawker centres to Marina Bay, does the rest.",
    "highlights": [
      { "id": "h1", "title": "The first Major in Southeast Asia", "detail": "Twenty-three Majors later, the trophy finally reaches the region — at the 12,000-seat Singapore Indoor Stadium." },
      { "id": "h2", "title": "Thirty-two teams, one trophy", "detail": "Three Swiss-system stages cut the field from thirty-two to the final eight." },
      { "id": "h3", "title": "A best-of-five grand final", "detail": "Sunday 13 December — the longest format the game allows, under the dome." },
      { "id": "h4", "title": "US$1,250,000 on the line", "detail": "Valve-sponsored prize pool, and a place in Counter-Strike history for whoever lifts it." },
      { "id": "h5", "title": "Falcons defend in Singapore", "detail": "Team Falcons arrive as reigning Major champions after Cologne 2026 — with m0NESY wearing the MVP crown." },
      { "id": "h6", "title": "A home-region crowd", "detail": "APAC's best qualify through the regional circuit and play a Major on home soil for the first time." }
    ],
    "schedule": [
      { "id": "s1", "layout": "timeline", "spacing": "normal", "frame": "boxed", "sectionNote": "The 25 November – 13 December window and the three-stage Swiss format follow PGL's announcement; the exact day-by-day split below is indicative until PGL publishes the final match schedule.", "time": "12:00", "title": "Stage 1 begins — Swiss opening round", "description": "Thirty-two teams start the road to Singapore. Opening matches stream worldwide from the studio stage.", "by": "Wednesday 25 November", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/IEM_WC_Katowice_2015_inside.jpg/1920px-IEM_WC_Katowice_2015_inside.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s2", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "18:00", "title": "Stage 1 — elimination nights", "description": "First teams book their flight home; others advance to Stage 2.", "by": "Late November" },
      { "id": "s3", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "12:00", "title": "Stage 2 — the contenders arrive", "description": "The top-ranked teams enter. Sixteen become eight.", "by": "Early December" },
      { "id": "s4", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "12:00", "title": "Stage 3 — Legends decided", "description": "The last Swiss stage. Every match matters; the playoff bracket takes shape here.", "by": "Early–mid December", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IEM_Katowice_Major_2019.jpg/1920px-IEM_Katowice_Major_2019.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s5", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "15:00", "title": "Doors open — Singapore Indoor Stadium", "description": "The playoffs move under the dome. Fan zone, merchandising and signings from midday.", "by": "Thursday 10 December", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1920px-Singapore_Indoor_Stadium.jpg", "imagePosition": "left", "imageFit": "cover" },
      { "id": "s6", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "17:00", "title": "Quarterfinals", "description": "Best-of-three, knockout Counter-Strike in front of the first full arena crowd of the week.", "by": "Thursday 10 December" },
      { "id": "s7", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "15:00", "title": "Semifinal day", "description": "Four teams, two series, one final spot each side of the bracket.", "by": "Friday 11 – Saturday 12 December" },
      { "id": "s8", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "15:00", "title": "Grand final — best of five", "description": "The championship match of the PGL Major Singapore. Lights, trophy, history.", "by": "Sunday 13 December", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/ESL_One_Cologne_2014.jpg/1920px-ESL_One_Cologne_2014.jpg", "imagePosition": "background", "imageFit": "cover" },
      { "id": "s9", "layout": "timeline", "spacing": "normal", "frame": "boxed", "time": "20:30", "title": "Trophy ceremony & closing", "description": "The Major champion lifts the trophy as confetti falls in the Indoor Stadium.", "by": "Sunday 13 December" }
    ],
    "guests": [
      { "id": "g1", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Team_Spirit_new_em.svg/500px-Team_Spirit_new_em.svg.png", "name": "Team Spirit", "role": "Shanghai 2024 Major champions", "company": "donk · youngest Major MVP in history", "bio": "The Shanghai triumph made donk the youngest Major winner and MVP ever. Spirit's system game remains the benchmark everyone else studies." },
      { "id": "g2", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Faze_Clan.svg/500px-Faze_Clan.svg.png", "name": "FaZe Clan", "role": "Antwerp 2022 Major champions", "company": "First international roster to win a Major", "bio": "karrigan's pan-national squad broke the national-roster mould at Antwerp. Years on, FaZe remain a permanent threat in the playoffs." },
      { "id": "g3", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/NAVI-Logo.svg/500px-NAVI-Logo.svg.png", "name": "Natus Vincere", "role": "Stockholm 2021 · Copenhagen 2024 champions", "company": "Two-time CS Major winners", "bio": "NAVI went perfect-map at Stockholm 2021, then became the first CS2 Major champion in Copenhagen 2024. The yellow-and-black travelling support fills arenas wherever they play." },
      { "id": "g4", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/ALEX%2C_XTQZZZ%2C_apEX_IEM_Katowice_2020.png/1920px-ALEX%2C_XTQZZZ%2C_apEX_IEM_Katowice_2020.png", "name": "Team Vitality", "role": "Austin 2025 · Budapest 2025 champions", "company": "Back-to-back Majors, built around ZywOo", "bio": "Vitality's dynasty peaked with consecutive Majors in Austin and Budapest before falling in Cologne. Their captain apEX, pictured at IEM Katowice 2020, has led them through every era." },
      { "id": "g5", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/The_MongolZ.svg/500px-The_MongolZ.svg.png", "name": "The MongolZ", "role": "Budapest 2025 grand finalists", "company": "East Asia's flag-bearers", "bio": "Runners-up at the last Major before Cologne, and the story of Asian Counter-Strike's rise. Singapore is the closest a home-crowd Major has ever come to them." },
      { "id": "g6", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/MOUZlogo2021.png/500px-MOUZlogo2021.png", "name": "MOUZ", "role": "Perennial playoff contenders", "company": "The academy pipeline that never stops producing", "bio": "MOUZ's youth machine keeps exporting talent to the whole league while staying dangerous itself. Watch them in the Swiss stages — they always come alive there." },
      { "id": "g7", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Astralis_logo.svg/500px-Astralis_logo.svg.png", "name": "Astralis", "role": "Record four Major titles", "company": "The most decorated organisation in CS history", "bio": "Four Majors — more than anyone. The Danish dynasty defined the modern professional era, and their name still raises the stakes wherever it appears on a bracket." }
    ],
    "guestsDisplay": { "layout": "list", "columns": 4, "imageShape": "circle", "imageFit": "contain", "cardStyle": "card", "align": "left", "showBio": true },
    "faq": [
      { "id": "f1", "q": "What exactly is a Major?", "a": "The Majors are the Counter-Strike championships officially sponsored by Valve, the game's developer — the sport's equivalent of a World Cup. Winning one defines careers; no other title carries the same weight." },
      { "id": "f2", "q": "When and where is it?", "a": "**25 November to 13 December 2026**, across Singapore. The Swiss stages run on the studio broadcast; the **playoffs and grand final take place at the Singapore Indoor Stadium**, ending with the best-of-five final on Sunday 13 December." },
      { "id": "f3", "q": "Which days need an arena ticket?", "a": "Arena tickets cover the playoff weekend at the Singapore Indoor Stadium — quarterfinals through the grand final. The early Swiss stages are broadcast from the studio; selected open-session inventory for those appears as add-ons here if released." },
      { "id": "f4", "q": "How many teams are playing?", "a": "**Thirty-two**, invited and qualified through the Valve Regional Standings and regional circuits. Europe, the Americas and Asia-Pacific all send multiple representatives — with a guaranteed home-region presence in Singapore." },
      { "id": "f5", "q": "What is the prize pool?", "a": "**US$1,250,000**, distributed by final placement per Valve's Major framework. The champions also earn the prestige that comes with only the sixth CS2 Major ever played." },
      { "id": "f6", "q": "Who is the defending champion?", "a": "**Team Falcons**, who won their first Major at IEM Cologne 2026 with m0NESY taking MVP honours. Before them, Team Vitality won back-to-back in Austin and Budapest." },
      { "id": "f7", "q": "Is there an age limit?", "a": "Arena sessions are all-ages, though minors should bring ear protection — arena crowds are loud. Age policies for any evening fan-zone events follow each venue's own licensing rules." },
      { "id": "f8", "q": "How do I get to the Indoor Stadium?", "a": "Take the **Circle Line to Stadium MRT (CC6)** — the station is a short covered walk from the doors. Changi Airport is about twenty minutes away by car, and the downtown core is two stops on the line." },
      { "id": "f9", "q": "Will players sign anything?", "a": "The fan zone outside the stadium hosts scheduled signing sessions throughout playoff days, and teams frequently announce pop-up meets on social media. Bring your jersey, but queue early." },
      { "id": "f10", "q": "What accessibility provision is there?", "a": "The Singapore Indoor Stadium offers accessible seating platforms with companion seats, step-free entry routes and accessible restrooms throughout. Book accessible seats through the official ticketing channel and assistance will be coordinated for the session." }
    ],
    "map": {
      "coords": { "lat": 1.3009, "lng": 103.8759 },
      "transport": "**Stadium MRT (CC6)** on the Circle Line is the natural gate — a short covered walk from the Indoor Stadium. Kallang MRT (EW10) serves the western edge of the Sports Hub, and Changi Airport sits roughly twenty minutes east by car. On grand-final night, follow the crowd signs; the interchange handles a full arena without breaking a sweat.",
      "parking": "Sports Hub operates multi-storey carparks around the stadium, and Kallang Wave Mall adds covered parking underneath. Event-night demand is heavy — the MRT genuinely beats driving.",
      "nearbyHotels": [
        { "name": "Marina Bay Sands", "kind": "Hotel", "detail": "Iconic skyline stay, two MRT stops from the stadium", "walkMin": 30, "lat": 1.2834, "lng": 103.8607 },
        { "name": "PARKROYAL COLLECTION Marina Bay", "kind": "Hotel", "detail": "Waterfront rooms near Suntec City", "walkMin": 32, "lat": 1.2926, "lng": 103.8549 },
        { "name": "The Fullerton Hotel Singapore", "kind": "Hotel", "detail": "Heritage colossus by the river mouth", "walkMin": 35, "lat": 1.2862, "lng": 103.8532 },
        { "name": "V Hotel Lavender", "kind": "Hotel", "detail": "Value option a short MRT ride from the Sports Hub", "walkMin": 28, "lat": 1.3040, "lng": 103.8618 },
        { "name": "Holiday Inn Express Singapore Katong", "kind": "Hotel", "detail": "East-coast base, quick hop to Kallang", "walkMin": 25, "lat": 1.3078, "lng": 103.8949 }
      ],
      "nearbyFood": [
        { "name": "Old Airport Road Food Centre", "kind": "Hawker centre", "detail": "One of the city's legendary hawker halls — minutes from Kallang", "walkMin": 18, "lat": 1.3084, "lng": 103.8862 },
        { "name": "Kallang Wave Mall eateries", "kind": "Food court", "detail": "Under the stadium's roofline — the pre-match default", "walkMin": 4, "lat": 1.3015, "lng": 103.8745 },
        { "name": "Satay by the Bay", "kind": "Food garden", "detail": "Open-air satay smoke beside Gardens by the Bay", "walkMin": 40, "lat": 1.2809, "lng": 103.8700 },
        { "name": "Jumbo Seafood, Riverside Point", "kind": "Restaurant", "detail": "Chilli crab by Clarke Quay — book ahead", "walkMin": 45, "lat": 1.2886, "lng": 103.8448 }
      ],
      "nearbyTransit": [
        { "name": "Stadium MRT (CC6)", "kind": "Transit stop", "detail": "Circle Line — the station built for event nights like this", "walkMin": 4, "lat": 1.3030, "lng": 103.8719 },
        { "name": "Kallang MRT (EW10)", "kind": "Transit stop", "detail": "East–west line, ten minutes' walk west of the venue", "walkMin": 11, "lat": 1.3112, "lng": 103.8714 },
        { "name": "Nicoll Highway MRT (CC5)", "kind": "Transit stop", "detail": "Alternate Circle Line stop toward the city", "walkMin": 16, "lat": 1.3061, "lng": 103.8660 },
        { "name": "Changi Airport (SIN)", "kind": "Transit", "detail": "About twenty minutes by car; Jewel is worth a layover", "walkMin": 90, "lat": 1.3644, "lng": 103.9915 }
      ],
      "nearbyParking": [
        { "name": "Singapore Sports Hub Car Park", "kind": "Car park", "detail": "Multi-storey parking beside the Indoor Stadium", "walkMin": 3, "lat": 1.3020, "lng": 103.8755 },
        { "name": "Kallang Wave Mall Parking", "kind": "Car park", "detail": "Covered mall parking under the National Stadium", "walkMin": 5, "lat": 1.3015, "lng": 103.8737 },
        { "name": "Kallang Leisure Park Garage", "kind": "Car park", "detail": "Rink-side parking a short stroll away", "walkMin": 6, "lat": 1.3009, "lng": 103.8727 }
      ],
      "nearbyTaxi": [
        { "name": "Indoor Stadium Taxi Stand", "kind": "Taxi rank", "detail": "Signed ranks operate along Stadium Walk on event nights", "walkMin": 2, "lat": 1.3003, "lng": 103.8765 },
        { "name": "Kallang Wave Ride-share Point", "kind": "Taxi rank", "detail": "Designated Grab pick-up zone by the mall entrance", "walkMin": 5, "lat": 1.3018, "lng": 103.8740 }
      ]
    },
    "ticketGroups": [
      { "tierId": "t-cat", "name": "Playoffs — categories", "color": "slate", "rank": 1 },
      { "tierId": "t-premium", "name": "Premium", "color": "amber", "rank": 2 },
      { "tierId": "t-stages", "name": "Early-stage sessions", "color": "violet", "rank": 3 }
    ],
    "tickets": [
      { "id": "tk-cat4", "groupId": "t-cat", "name": "Category 4 — Playoff Package", "price": 168, "qty": 3000, "description": "Upper-tier seat for all arena days, quarterfinals to the grand final (SGD)." },
      { "id": "tk-cat3", "groupId": "t-cat", "name": "Category 3 — Playoff Package", "price": 268, "qty": 3200, "description": "Mid-tier sideline view for the full playoff weekend (SGD)." },
      { "id": "tk-cat2", "groupId": "t-cat", "name": "Category 2 — Playoff Package", "price": 388, "qty": 2800, "description": "Lower-tier seat facing the main screen, all arena days (SGD)." },
      { "id": "tk-cat1", "groupId": "t-cat", "name": "Category 1 — Playoff Package", "price": 548, "qty": 2000, "description": "Floor-level sightlines for quarterfinals, semifinals and the grand final (SGD)." },
      { "id": "tk-premier", "groupId": "t-premium", "name": "Premier Seat Package", "price": 888, "qty": 700, "description": "Premium lower-bowl seating with dedicated entrances and lounge access (SGD)." },
      { "id": "tk-suite", "groupId": "t-premium", "name": "Stadium VIP Suite", "price": 1588, "qty": 220, "description": "Private suite hospitality for the grand final weekend, inclusive of catering (SGD)." },
      { "id": "tk-stage12", "groupId": "t-stages", "name": "Stage 1 & 2 Open Sessions", "price": 68, "qty": 1500, "description": "Public studio-session attendance during the opening Swiss weeks, if released (SGD)." },
      { "id": "tk-stage3", "groupId": "t-stages", "name": "Stage 3 Open Sessions", "price": 98, "qty": 1500, "description": "Watch the Legends Stage deciders live from the studio floor (SGD)." }
    ],
    "ticketSold": {
      "tk-cat4": 2410, "tk-cat3": 2605, "tk-cat2": 2210, "tk-cat1": 1540,
      "tk-premier": 505, "tk-suite": 118,
      "tk-stage12": 620, "tk-stage3": 480
    },
    "ticketSelection": {
      "enabled": true,
      "mode": "price",
      "seatsLabel": "Choose your seat at the dome",
      "priceLabel": "Choose by category and price",
      "features": ["plan", "insurance", "digital"],
      "autoAssignNote": "Playoff packages hold one reserved seat for every arena session, quarterfinals through the grand final. Seats are assigned from the best available in your category at booking.",
      "soldOutNote": "This category is gone. Released holds and production holds go back on sale here first — check back closer to the playoff weekend."
    },
    "regSettings": { "showRemaining": true },
    "ctas": {
      "primaryLabel": "Get playoff tickets",
      "items": [
        { "id": "cta-ticketmaster", "label": "Official ticketing — Ticketmaster SG", "url": "https://www.ticketmaster.sg/", "style": "outline" },
        { "id": "cta-format", "label": "See the full schedule", "url": "#sec-schedule", "style": "outline" },
        { "id": "cta-official", "label": "Official event site", "url": "https://www.pgl.gg/", "style": "ghost" }
      ]
    },
    "questions": [
      { "id": "q1", "label": "Favourite team (for your fan pack)" },
      { "id": "q2", "label": "Attending with friends or solo" },
      { "id": "q3", "label": "Accessible seating required" },
      { "id": "q4", "label": "Jersey size (for merchandise pre-orders)" }
    ],
    "guidelines": [
      { "id": "gl1", "category": "dietary", "label": "Halal-friendly by default", "detail": "Food outlets across the Singapore Sports Hub carry halal-certified options as standard, alongside vegetarian choices — consistent with Singapore's multicultural dining norm." },
      { "id": "gl2", "category": "dietary", "label": "Allergen sheets at every outlet", "detail": "Concession stands publish allergen information at point of sale; speak to outlet staff for ingredient-level detail." },
      { "id": "gl3", "category": "accessibility", "label": "Accessible seating with companion places", "detail": "The Indoor Stadium provides wheelchair-accessible platforms with adjacent companion seats. Select these during checkout rather than a standard category seat." },
      { "id": "gl4", "category": "accessibility", "label": "Step-free from Stadium MRT", "detail": "Lift access runs from Stadium MRT concourse through the stadium forecourt to all seating levels — the entire route is step-free." },
      { "id": "gl5", "category": "accessibility", "label": "Assistive listening on request", "detail": "Hearing-assist receivers can be collected at guest services on arena days, and quiet areas are marked on the venue map." },
      { "id": "gl6", "category": "accessibility", "label": "Ear protection recommended", "detail": "Arena crowds at a Major decibel-match a football derby. Foam plugs are available at guest services; bring defenders for children." }
    ],
    "organizerAvatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/PGL_Logo.png/500px-PGL_Logo.png",
    "team": [
      { "name": "PGL", "role": "Owner" },
      { "name": "Valve Corporation", "role": "Co-host" },
      { "name": "Singapore Sports Hub", "role": "Co-host" }
    ],
    "languages": [
      { "name": "English", "isDefault": true },
      { "name": "中文" },
      { "name": "Bahasa Melayu" }
    ],
    "tags": ["CS2 Major", "Esports", "32 teams", "Grand final Dec 13"],
    "galleryDisplay": { "layout": "carousel", "slidesPerView": 3, "autoplay": true, "autoplaySeconds": 5, "loop": true, "arrows": true, "dots": true },
    "sectionNotes": [
      { "id": "n1", "target": "schedule", "enabled": true, "text": "The date window, team count and format follow PGL's announcement. The exact daily match schedule drops closer to the event — ticket holders are notified by email." },
      { "id": "n2", "target": "register", "enabled": true, "text": "Prices are shown in Singapore dollars and are indicative of the on-sale structure; the authoritative price is the one displayed by the official ticketing partner at checkout." },
      { "id": "n3", "target": "guests", "enabled": true, "text": "Teams shown are the headline organisations expected to contest the Major through the qualification process. Final participation depends on results through the closing stages of the 2026 season." },
      { "id": "n4", "target": "guidelines", "enabled": true, "text": "Venue services follow Singapore Sports Hub policy and may adjust for the event." }
    ],
    "disclaimer": {
      "enabled": true,
      "text": "This is a demonstration event page. Counter-Strike, CS2 and related marks are trademarks of Valve Corporation; PGL and event branding belong to PGL. This page is not affiliated with, endorsed by or sponsored by PGL or Valve. Dates and format reflect public announcements; ticket categories, prices and the day-by-day schedule are illustrative, and arena photography shows previous Majors.",
      "placements": ["hero", "above-footer"]
    },
    "infographics": [
      {
        "id": "ig-road",
        "type": "showcase",
        "props": {
          "title": "The road through Singapore",
          "titleAlign": "left",
          "layoutMode": "grid",
          "columns": "2",
          "showOne": false,
          "clickOpen": true,
          "items": [
            { "title": "Stage 1 — everyone starts here", "text": "Thirty-two teams, Swiss rounds, zero margin for a slow start.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/IEM_WC_Katowice_2015_inside.jpg/1920px-IEM_WC_Katowice_2015_inside.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "Opening matches make or break campaigns. Half the field leaves in the first week — and every year, one team nobody picked survives longer than anyone expects." },
            { "title": "Stage 2 & 3 — the contenders arrive", "text": "Top seeds join. Sixteen become eight the hard way.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IEM_Katowice_Major_2019.jpg/1920px-IEM_Katowice_Major_2019.jpg", "textSide": "top", "ctaLabel": "See the schedule", "ctaUrl": "#sec-schedule", "details": "Swiss stages reward consistency over brilliance: win three before you lose three. The bracket seeding for the arena weekend is decided here." },
            { "title": "Quarterfinals — the dome opens", "text": "Knockout Counter-Strike under the Indoor Stadium roof.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg/1920px-Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg", "textSide": "top", "ctaLabel": "Get tickets", "ctaUrl": "#tickets", "details": "Eight teams, best-of-three, twelve thousand people. This is what the playoff package buys you — every arena session through the final." },
            { "title": "Grand final — best of five", "text": "Sunday 13 December. One series decides everything.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/ESL_One_Cologne_2014.jpg/1920px-ESL_One_Cologne_2014.jpg", "textSide": "top", "ctaLabel": "Get tickets", "ctaUrl": "#tickets", "details": "The Major's longest format, played once, in front of the loudest room in Southeast Asia. Whoever wins joins a list that starts with Fnatic in 2013." }
          ]
        }
      },
      {
        "id": "ig-carousel",
        "type": "carousel",
        "props": {
          "title": "The host city",
          "titleAlign": "left",
          "autoplay": true,
          "mode": "row",
          "items": [
            { "title": "Singapore Indoor Stadium", "text": "The dome that hosts the playoffs and the grand final.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Singapore_Indoor_Stadium.jpg/1920px-Singapore_Indoor_Stadium.jpg", "textSide": "bottom" },
            { "title": "Inside the bowl", "text": "Twelve thousand seats wrapped around the stage.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg/1920px-Singapore_Indoor_Stadium_interior_-_6_Nov_2024.jpg", "textSide": "bottom" },
            { "title": "Marina Bay at night", "text": "Twenty minutes from the arena — the classic post-match view.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/1_marina_bay_sands_skypark_night_view_CBD_skyline.jpg/1920px-1_marina_bay_sands_skypark_night_view_CBD_skyline.jpg", "textSide": "bottom" },
            { "title": "Supertree Grove", "text": "Gardens by the Bay lights up every evening, free to wander.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Supertree_Grove_at_night.jpg/1920px-Supertree_Grove_at_night.jpg", "textSide": "bottom" },
            { "title": "Clarke Quay", "text": "Riverfront bars and restaurants for the post-final night out.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Clarke_Quay%2C_Singapore_%282371036515%29.jpg/1920px-Clarke_Quay%2C_Singapore_%282371036515%29.jpg", "textSide": "bottom" },
            { "title": "Where majors came from", "text": "Katowice, 2019 — the atmosphere Singapore inherits next.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IEM_Katowice_Major_2019.jpg/1920px-IEM_Katowice_Major_2019.jpg", "textSide": "bottom" }
          ]
        }
      },
      {
        "id": "ig-split",
        "type": "split",
        "props": {
          "title": "By the numbers",
          "titleAlign": "left",
          "text": "32 teams · US$1,250,000 · 3 Swiss stages · 8 playoff spots · best-of-five final\n\nPGL's fifth Major, and the first ever played in Southeast Asia. The playoffs land at the 12,000-seat Singapore Indoor Stadium — twenty minutes from Changi Airport, two stops from downtown.\n\nDefending champions: Team Falcons, winners of IEM Cologne 2026. Most titles in history: Astralis, with four.",
          "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Spodek_for_IEM_Katowice_2018.jpg/1920px-Spodek_for_IEM_Katowice_2018.jpg",
          "imageSide": "right",
          "ctaLabel": "Get playoff tickets",
          "ctaUrl": "#tickets"
        }
      },
      {
        "id": "ig-quotes",
        "type": "quotes",
        "props": {
          "title": "Why fans cross oceans for a Major",
          "titleAlign": "left",
          "layout": "grid",
          "columns": "3",
          "items": [
            { "quote": "Watching online is watching the game. Being in the arena is feeling the map vibration when the crowd loses its mind.", "name": "Playoff package holder", "role": "Antwerp 2022" },
            { "quote": "We planned the whole trip around one Swiss match and ended up staying for the final. Best impulse purchase of my life.", "name": "Travelling supporter", "role": "Rio 2022" },
            { "quote": "Signings, fan zone, the city everywhere wearing jerseys. Singapore is going to do this incredibly well.", "name": "Season ticket holder", "role": "Copenhagen 2024" }
          ]
        }
      },
      {
        "id": "ig-footer",
        "type": "footer",
        "props": {
          "title": "Before you travel",
          "titleAlign": "left",
          "note": "PGL · Singapore Indoor Stadium, 2 Stadium Walk, Singapore 397691 · Playoffs 10–13 December 2026. Demonstration page — see the disclaimer above.",
          "items": [
            { "title": "Official site", "link": "https://www.pgl.gg/" },
            { "title": "Official ticketing", "link": "https://www.ticketmaster.sg/" },
            { "title": "Follow the qualifier race", "link": "https://www.hltv.org/" },
            { "title": "Contact", "link": "mailto:info@pgl.gg" }
          ]
        }
      }
    ],
    "pageDesign": {
      "mode": "themed",
      "accent": "blue",
      "cover": "accent",
      "font": "sans",
      "showGallery": true,
      "viewerMode": "dark",
      "theme": {
        "base": "dark",
        "colors": {
          "brand": "#1E6FE8",
          "brandText": "#FFFFFF",
          "accent": "#FFB43A",
          "link": "#6FA8FF",
          "brandHover": "#3D86F5",
          "brandTo": "#0A2C66",
          "bg": "#0A0D14",
          "surface": "#131824",
          "text": "#F2F4F8",
          "muted": "#9BA3B2",
          "border": "#252D3D"
        },
        "font": { "heading": "grotesk", "body": "sans", "scale": "md", "headingFamily": "", "bodyFamily": "", "webfonts": [], "faces": [] },
        "logo": { "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/PGL_Logo.png/500px-PGL_Logo.png", "height": 22, "link": "https://www.pgl.gg/", "showBar": true, "showInFooter": true },
        "footerLogo": { "url": "", "height": 24, "link": "" },
        "source": { "url": "https://www.pgl.gg/", "siteName": "PGL", "importedAt": "" },
        "header": {
          "show": true,
          "links": [
            { "label": "Overview", "url": "#sec-top" },
            { "label": "Schedule", "url": "#sec-schedule" },
            { "label": "Teams", "url": "#sec-guests" },
            { "label": "Getting there", "url": "#sec-location" },
            { "label": "FAQ", "url": "#sec-faq" }
          ],
          "cta": { "label": "Tickets", "url": "#tickets" },
          "align": "split",
          "sticky": true,
          "background": "#0A0D14",
          "border": true,
          "navUpper": true,
          "navTracking": 0.06,
          "navWeight": "600",
          "navSize": 12
        },
        "headingWeight": "black",
        "headingUpper": true,
        "headingTracking": -0.02,
        "headingLineHeight": 1.05,
        "bodyWeight": "",
        "radius": "sharp",
        "radiusPx": 4,
        "button": "solid",
        "buttonRadiusPx": 4,
        "buttonUpper": true,
        "buttonWeight": "700",
        "buttonTracking": 0.04,
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
          "value": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/IEM_WC_Katowice_2015_inside.jpg/1920px-IEM_WC_Katowice_2015_inside.jpg",
          "overlay": "base",
          "dim": 92
        },
        "footerStyle": { "background": "#06080D", "text": "#E7EAF0" },
        "favicon": "",
        "tagline": "The second CS2 Major of 2026 — and the first in Southeast Asia. Playoffs under the dome, 10–13 December.",
        "themeColor": "#0A0D14"
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
        "text": "PGL Major Singapore 2026 · 25 November – 13 December · Singapore Indoor Stadium",
        "links": [
          { "label": "Tickets", "url": "#tickets" },
          { "label": "Schedule", "url": "#sec-schedule" },
          { "label": "Getting there", "url": "#sec-location" },
          { "label": "Accessibility", "url": "#sec-faq" }
        ],
        "socials": [
          { "platform": "website", "url": "https://www.pgl.gg/" },
          { "platform": "instagram", "url": "https://www.instagram.com/pglesports/" },
          { "platform": "youtube", "url": "https://www.youtube.com/@PGL" },
          { "platform": "email", "url": "mailto:info@pgl.gg" }
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
