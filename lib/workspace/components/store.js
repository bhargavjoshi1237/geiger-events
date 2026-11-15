import { WorkspaceError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";

function db() {
  const client = adminClient();
  if (!client) throw new WorkspaceError("service_unavailable", 503, "Workspace is unavailable.");
  return client;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

// The 8-character ticket code is the first 8 hex digits of the id, so it maps to a range of ids.
const codeRange = (code) => {
  const hex = code.toLowerCase();
  return [`${hex}-0000-0000-0000-000000000000`, `${hex}-ffff-ffff-ffff-ffffffffffff`];
};

export const componentStore = {
  // A ticket holder by registration/order id or 8-character code: { kind: "ticket"|"order", id, name, email }.
  async ticketHolder(context, { id = null, code = null }) {
    const find = async (table, columns, map) => {
      let query = db().from(table).select(columns).eq("event_id", context.eventId);
      if (table === "registrations") query = query.is("deleted_at", null);
      if (id) query = query.eq("id", id);
      else { const [from, to] = codeRange(code); query = query.gte("id", from).lte("id", to); }
      const rows = checked(await query.limit(2));
      return rows.length === 1 ? map(rows[0]) : null;
    };
    return (await find("registrations", "id,name,email", (row) => ({ kind: "ticket", id: row.id, name: row.name, email: row.email?.toLowerCase() ?? null })))
      ?? (await find("event_orders", "id,buyer_name,buyer_email", (row) => ({ kind: "order", id: row.id, name: row.buyer_name, email: row.buyer_email?.toLowerCase() ?? null })));
  },

  // Records whose link fields point at one of these event items.
  async linkSources(context, { kind, ids, fieldIds }) {
    if (!ids.length || !fieldIds.length) return [];
    return checked(await db().from("workspace_links").select("source_record_id,field_id,target_id")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("target_kind", kind).in("target_id", ids).in("field_id", fieldIds).limit(500));
  },

  // The event's registrations that have an email (up to 20,000), oldest first, for matching a people list.
  async registrations(context) {
    const rows = [];
    for (let from = 0; from < 20_000; from += 1000) {
      const page = checked(await db().from("registrations").select("id,email,status,created_at").eq("event_id", context.eventId).is("deleted_at", null)
        .neq("email", "").order("created_at").range(from, from + 999));
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return rows;
  },

  // The latest check-in per registration or order.
  async latestCheckins(context, { registrationIds = [], orderIds = [] }) {
    const out = new Map();
    const read = async (column, ids) => {
      if (!ids.length) return;
      const rows = checked(await db().from("checkin_attendance").select(`${column},checked_in_at`).eq("event_id", context.eventId)
        .is("deleted_at", null).in(column, ids).order("checked_in_at", { ascending: false }).limit(1000));
      for (const row of rows) if (!out.has(row[column])) out.set(row[column], row.checked_in_at);
    };
    await Promise.all([read("registration_id", registrationIds), read("order_id", orderIds)]);
    return out;
  },
};
