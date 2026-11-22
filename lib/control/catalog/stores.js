// Where each catalog store lives. "record" rows carry name/status/cover/schedule; "ticketing" rows carry name/kind/active.

export const STORES = {
  conference: { table: "conference_records", shape: "record" },
  community: { table: "community_records", shape: "record" },
  analytics: { table: "analytics_records", shape: "record" },
  advertising: { table: "advertising_records", shape: "record" },
  ticketing: { table: "ticketing_records", shape: "ticketing" },
  campaigns: { table: "campaign_assets", shape: "ticketing" },
};

export const ROOT_COLUMNS = {
  record: { name: "name", status: "status", coverUrl: "cover_url", startsAt: "starts_at", endsAt: "ends_at" },
  ticketing: { name: "name", kind: "kind", active: "active" },
};
