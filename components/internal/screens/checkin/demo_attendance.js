// Bundled sample data for the Real-time Attendance board when it runs as a
// public landing-page playground (no live session, so the real data layer has
// nothing to show). Shapes match the normalized view models the screen reads:
//   events:     { id, name, date, sold, checkinSessions?.sessions[] }
//   regs:       { eventId, status: "Confirmed" | "Checked-in" }
//   attendance: { id, eventId, status: "in", registrationId, gate?, sessionId? }
// Only imported behind RealTimeAttendanceScreen's explicit `demo` prop.

const EVENTS = [
  {
    id: "demo-evt-1",
    name: "Summer Product Launch",
    date: "2026-06-18",
    sold: 312,
    checkinSessions: {
      sessions: [
        { id: "s1", name: "Keynote" },
        { id: "s2", name: "Demo Hall" },
      ],
    },
  },
  {
    id: "demo-evt-2",
    name: "Local Music Night",
    date: "2026-06-12",
    sold: 300,
    checkinSessions: { sessions: [] },
  },
  {
    id: "demo-evt-3",
    name: "Founder AMA — Live",
    date: "2026-06-22",
    sold: 128,
    checkinSessions: { sessions: [] },
  },
  {
    id: "demo-evt-4",
    name: "Design Systems Workshop",
    date: "2026-07-02",
    sold: 54,
    checkinSessions: { sessions: [] },
  },
];

// Confirmed registrations set the "expected" denominator per event.
const REGS = [
  ...Array.from({ length: 300 }, (_, i) => ({ eventId: "demo-evt-1", status: "Confirmed", id: `r1-${i}` })),
  ...Array.from({ length: 300 }, (_, i) => ({ eventId: "demo-evt-2", status: "Confirmed", id: `r2-${i}` })),
  ...Array.from({ length: 120 }, (_, i) => ({ eventId: "demo-evt-3", status: "Confirmed", id: `r3-${i}` })),
  ...Array.from({ length: 60 }, (_, i) => ({ eventId: "demo-evt-4", status: "Confirmed", id: `r4-${i}` })),
];

// Checked-in ("in") rows drive the live count, arrival bar, and gate/session
// chips. Counts are partial so the bars sit mid-progress and read as "building".
function admits(eventId, count, spread) {
  return Array.from({ length: count }, (_, i) => {
    const row = {
      id: `${eventId}-a${i}`,
      eventId,
      status: "in",
      registrationId: `${eventId}-r${i}`,
    };
    if (spread?.gates) row.gate = spread.gates[i % spread.gates.length];
    if (spread?.sessions) row.sessionId = spread.sessions[i % spread.sessions.length];
    return row;
  });
}

const ATTENDANCE = [
  ...admits("demo-evt-1", 214, { gates: ["North", "West"], sessions: ["s1", "s2"] }),
  ...admits("demo-evt-2", 268, { gates: ["Main"] }),
  ...admits("demo-evt-3", 61),
  // demo-evt-4 has no arrivals yet — shows the "No arrivals yet" state.
];

export const DEMO_ATTENDANCE = { events: EVENTS, regs: REGS, attendance: ATTENDANCE };
