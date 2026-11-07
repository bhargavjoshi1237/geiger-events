// Smart drafting: seed an RFP from an event, built-in or saved presets, and sensible defaults.

import {
  addDays,
  dayCount,
  normalizeRoomRequirements,
  normalizeSleepingRooms,
  rowKey,
  toNumber,
} from "./rfp_model.js";

const room = (label, setupStyle, capacity, days) => ({ id: rowKey("room"), label, setup_style: setupStyle, capacity, days });

export const BUILT_IN_PRESETS = [
  {
    id: "builtin:conference-300",
    name: "Conference · 300 pax · 2 days",
    description: "General session, three breakouts, catering and a room block.",
    requirements: {
      attendees: 300,
      days: 2,
      roomRequirements: [
        room("General session", "theatre", 300, 2),
        room("Breakout A", "classroom", 80, 2),
        room("Breakout B", "classroom", 80, 2),
        room("Breakout C", "classroom", 60, 2),
      ],
      roomsPerNight: [120, 120],
      fnbRequirements: "Breakfast, lunch and two coffee breaks each day; one evening drinks reception.",
      fnbMinimum: 30000,
      avNeeds: "Stage with lectern, two projection screens, PA with 4 handheld + 2 lavalier mics, recording of the main room, Wi-Fi for 300.",
    },
  },
  {
    id: "builtin:board-20",
    name: "Board meeting · 20 pax · 1 day",
    description: "One boardroom with lunch and video conferencing.",
    requirements: {
      attendees: 20,
      days: 1,
      roomRequirements: [room("Boardroom", "boardroom", 20, 1)],
      roomsPerNight: [],
      fnbRequirements: "Working lunch, morning and afternoon refreshments.",
      fnbMinimum: null,
      avNeeds: "Display screen with HDMI, video-conferencing camera and speakerphone.",
    },
  },
  {
    id: "builtin:gala-400",
    name: "Gala dinner · 400 pax · 1 evening",
    description: "Banquet seating, a three-course dinner and a stage.",
    requirements: {
      attendees: 400,
      days: 1,
      roomRequirements: [room("Ballroom", "banquet", 400, 1), room("Pre-dinner reception", "reception", 400, 1)],
      roomsPerNight: [60],
      fnbRequirements: "Drinks reception, three-course plated dinner with wine pairing, dietary options.",
      fnbMinimum: 60000,
      avNeeds: "Stage, lectern, stage lighting, PA for speeches and a live band, two side screens.",
    },
  },
  {
    id: "builtin:launch-150",
    name: "Product launch · 150 pax · half day",
    description: "Standing reception with a stage moment and canapés.",
    requirements: {
      attendees: 150,
      days: 1,
      roomRequirements: [room("Main space", "reception", 150, 1)],
      roomsPerNight: [],
      fnbRequirements: "Canapés and drinks for 150 over three hours.",
      fnbMinimum: 12000,
      avNeeds: "Stage, LED wall or large screen, PA with 2 wireless mics, lighting rig.",
    },
  },
  {
    id: "builtin:offsite-50",
    name: "Team offsite · 50 pax · 3 days",
    description: "Plenary plus breakouts, full board and a room for everyone.",
    requirements: {
      attendees: 50,
      days: 3,
      roomRequirements: [
        room("Plenary", "cabaret", 50, 3),
        room("Breakout 1", "boardroom", 25, 3),
        room("Breakout 2", "boardroom", 25, 3),
      ],
      roomsPerNight: [50, 50, 50],
      fnbRequirements: "Full board: breakfast, lunch, dinner and two breaks daily.",
      fnbMinimum: null,
      avNeeds: "Projector and screen in each room, flipcharts, Wi-Fi.",
    },
  },
];

// Normalised preset shape, whether built in or loaded from events.rfp_presets.
export function normalizePresetRequirements(req) {
  const r = req && typeof req === "object" ? req : {};
  return {
    attendees: Math.max(0, Math.round(Number(r.attendees) || 0)),
    days: Math.max(1, Math.round(Number(r.days) || 1)),
    roomRequirements: normalizeRoomRequirements(r.roomRequirements),
    roomsPerNight: Array.isArray(r.roomsPerNight) ? r.roomsPerNight.map((n) => Math.max(0, Math.round(Number(n) || 0))) : [],
    fnbRequirements: String(r.fnbRequirements || ""),
    fnbMinimum: toNumber(r.fnbMinimum),
    avNeeds: String(r.avNeeds || ""),
  };
}

const roundTo5 = (n) => Math.max(1, Math.round(n / 5) * 5);

// The RFP patch a preset produces. Capacities scale to the RFP's own headcount when it already has one.
export function applyPreset(rfp, preset) {
  const req = normalizePresetRequirements(preset?.requirements);
  const attendees = Number(rfp?.attendees) > 0 ? Number(rfp.attendees) : req.attendees;
  const scale = req.attendees > 0 && attendees > 0 ? attendees / req.attendees : 1;
  const scaled = (n) => (scale === 1 || !n ? n : roundTo5(n * scale));

  const start = rfp?.startDate || "";
  const endDate = start ? addDays(start, req.days - 1) : rfp?.endDate || "";
  const nights = req.roomsPerNight.map((rooms, i) => ({
    date: start ? addDays(start, i - 1) : "",
    rooms: scaled(rooms),
  }));

  return {
    attendees,
    endDate: start && (!rfp?.endDate || dayCount(start, rfp.endDate) < req.days) ? endDate : rfp?.endDate || "",
    roomRequirements: req.roomRequirements.map((r) => ({ ...r, id: rowKey("room"), capacity: scaled(r.capacity) })),
    sleepingRooms: { nights },
    fnbRequirements: req.fnbRequirements,
    fnbMinimum: req.fnbMinimum !== null && scale !== 1 ? Math.round(req.fnbMinimum * scale) : req.fnbMinimum,
    avNeeds: req.avNeeds,
  };
}

// Captures an RFP's requirements as a reusable preset (dates become per-night offsets).
export function presetFromRfp(rfp) {
  return {
    attendees: Number(rfp?.attendees) || 0,
    days: Math.max(1, dayCount(rfp?.startDate, rfp?.endDate)),
    roomRequirements: normalizeRoomRequirements(rfp?.roomRequirements).map((r) => ({
      label: r.label,
      setup_style: r.setupStyle,
      capacity: r.capacity,
      days: r.days,
    })),
    roomsPerNight: normalizeSleepingRooms(rfp?.sleepingRooms).nights.map((n) => n.rooms),
    fnbRequirements: rfp?.fnbRequirements || "",
    fnbMinimum: toNumber(rfp?.fnbMinimum),
    avNeeds: rfp?.avNeeds || "",
  };
}

// Two weeks to respond, closing at 17:00 local time.
export function defaultDeadline(now) {
  const d = new Date(now + 14 * 86400000);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export function defaultDecisionDate(deadlineIso) {
  const t = Date.parse(deadlineIso || "");
  if (!Number.isFinite(t)) return "";
  return new Date(t + 7 * 86400000).toISOString().slice(0, 10);
}

// Expected headcount from the event: its capacity, or tickets sold when that's higher.
export function expectedAttendees(event) {
  return Math.max(Number(event?.capacity) || 0, Number(event?.sold) || 0);
}

// A fresh RFP seeded from an event's dates, size and city.
export function draftFromEvent(event, { now } = {}) {
  const attendees = expectedAttendees(event);
  const responseDeadline = defaultDeadline(now);
  return {
    eventId: event?.id || null,
    title: event?.name ? `${event.name} — venue proposal` : "Venue proposal",
    summary: event?.name
      ? `We're sourcing a venue for ${event.name}${event.city ? ` in ${event.city}` : ""}. Please price the requirements below and include any concessions you can offer.`
      : "",
    startDate: event?.date || "",
    endDate: event?.date || "",
    attendees,
    location: event?.city || "",
    roomRequirements: attendees
      ? [{ id: rowKey("room"), label: "Main event space", setupStyle: "theatre", capacity: attendees, days: 1 }]
      : [],
    responseDeadline,
    decisionDate: defaultDecisionDate(responseDeadline),
  };
}

export function blankDraft({ now } = {}) {
  const responseDeadline = defaultDeadline(now);
  return {
    eventId: null,
    title: "",
    summary: "",
    startDate: "",
    endDate: "",
    attendees: 0,
    location: "",
    roomRequirements: [],
    responseDeadline,
    decisionDate: defaultDecisionDate(responseDeadline),
  };
}
