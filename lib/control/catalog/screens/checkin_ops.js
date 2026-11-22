// Bespoke Control screens for checkin_ops; each entry links a Manage section to an app route.
export const CHECKIN_OPS_SCREENS = [
  {
    id: "checkin_ops.roles",
    section: "checkin",
    title: "Staff scanning roles",
    icon: "key-round",
    description: "Access codes for door staff and kiosks, what they can do and where",
    route: "/control/checkin_ops/roles",
  },
  {
    id: "checkin_ops.attendance",
    section: "checkin",
    title: "Real-time attendance",
    icon: "gauge",
    description: "Who's inside across today's events, live",
    route: "/control/checkin_ops/attendance",
  },
  {
    id: "checkin_ops.capacity",
    section: "checkin",
    title: "Capacity control",
    icon: "door-open",
    description: "Caps and live occupancy per area",
    route: "/control/checkin_ops/capacity",
  },
  {
    id: "checkin_ops.leads",
    section: "checkin",
    title: "Lead retrieval",
    icon: "contact",
    description: "Contacts exhibitors captured by scanning badges",
    route: "/control/checkin_ops/leads",
  },
  {
    id: "checkin_ops.badges",
    section: "checkin",
    title: "Smart badges",
    icon: "id-card",
    description: "NFC badges per event: mark lost, revoke or reactivate",
    route: "/control/checkin_ops/badges",
  },
];
