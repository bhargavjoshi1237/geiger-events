// Control's Manage sections, in the dashboard sidebar's order; each opens with the same view key as its sidebar entry.

export const SECTIONS = [
  { key: "events", title: "Events", icon: "calendar", permission: "events.events.view" },
  { key: "packages", title: "Packages", icon: "package", permission: "events.packages.view" },
  { key: "venues", title: "Venues", icon: "map-pin", permission: "events.venues.view" },
  { key: "sourcing", title: "Sourcing", icon: "building-2", permission: "events.sourcing.view" },
  { key: "registrations", title: "Registrations", icon: "clipboard-list", permission: "events.registrations.view" },
  { key: "guests", title: "Guests", icon: "users", permission: "events.guests.view" },
  { key: "tickets", title: "Tickets", icon: "ticket", permission: "events.tickets.view" },
  { key: "orders", title: "Orders", icon: "shopping-bag", permission: "events.orders.view" },
  { key: "inventory", title: "Inventory", icon: "boxes", permission: "events.inventory.view" },
  { key: "memberships", title: "Memberships", icon: "award", permission: "events.memberships.view" },
  { key: "checkin", title: "Check-in", icon: "scan-line", permission: "events.check_in.view" },
  { key: "analytics", title: "Analytics", icon: "chart-column", permission: "events.analytics.view" },
  { key: "campaigns", title: "Campaigns", icon: "mail", permission: "events.campaigns.view" },
  { key: "advertising", title: "Advertising", icon: "megaphone", permission: "events.advertising.view" },
  { key: "workflows", title: "Workflows", icon: "workflow", permission: "events.workflows.view" },
  { key: "discovery", title: "Discovery", icon: "globe", permission: "events.discovery.view" },
  { key: "community", title: "Community", icon: "messages-square", permission: "events.community.view" },
  { key: "program", title: "Program", icon: "calendar-clock", permission: "events.program.view" },
  { key: "speakers", title: "Speakers", icon: "mic", permission: "events.speakers.view" },
  { key: "sponsors", title: "Sponsors & Expo", icon: "handshake", permission: "events.sponsors_expo.view" },
  { key: "broadcast", title: "Broadcast & On-demand", icon: "radio", permission: "events.broadcast_on_demand.view" },
  { key: "settings", title: "Settings", icon: "settings", permission: "events.settings.view" },
];

export const SECTION_BY_KEY = new Map(SECTIONS.map((section) => [section.key, section]));
