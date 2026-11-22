// Hand-built Control screens for the last uncovered areas (taxes, capacity limits, branded app, workflow templates, sourcing).
export const FINAL_SCREENS = [
  {
    id: "registrations.capacity",
    section: "registrations",
    title: "Capacity Limits",
    icon: "gauge",
    description: "Live fill per event; adjust capacity and the overbook buffer.",
    route: "/control/final/capacity",
  },
  {
    id: "broadcast.branded_app",
    section: "broadcast",
    title: "Branded App",
    icon: "smartphone",
    description: "What the attendee app shows: sections, home welcome and shortcuts.",
    route: "/control/final/branded-app",
  },
  {
    id: "workflows.templates",
    section: "workflows",
    title: "Workflow Templates",
    icon: "workflow",
    description: "Start a Draft workflow from a proven automation.",
    route: "/control/final/workflow-templates",
  },
  {
    id: "sourcing.proposals",
    section: "sourcing",
    title: "Smart Custom Proposals",
    icon: "file-text",
    description: "Send one RFP to many venues, collect their bids and award the winner.",
    route: "/control/sourcing/proposals",
  },
  {
    id: "sourcing.instant_book",
    section: "sourcing",
    title: "Instant Book",
    icon: "calendar-check",
    description: "Book or hold your venue spaces, priced from their published rates.",
    route: "/control/sourcing/bookings",
  },
];
