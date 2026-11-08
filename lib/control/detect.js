// Read-only hint for the members app: is this attendee also on an event team? It grants nothing — Control still needs a team sign-in.

const ROLE_ORDER = ["staff", "evaluator", "presenter", "volunteer", "participant"];

const NO_TEAM = { available: false, invited: false, organizations: [] };

export async function detectRoles(db, member) {
  if (!db || !member?.id || !member?.email) return { team: NO_TEAM, crew: [] };
  const [team, crew] = await Promise.all([teamHint(db, member.email), crewHint(db, member.id)]);
  return { team, crew };
}

async function teamHint(db, email) {
  const { data, error } = await db.rpc("suite_access_for_email", { p_email: email });
  if (error) {
    console.error("[control.detect] team", error.message);
    return NO_TEAM;
  }
  const rows = data || [];
  const organizations = rows
    .filter((row) => !row.invited && row.project_count > 0)
    .map((row) => ({ id: row.organization_id, name: row.organization_name, projectCount: row.project_count }));
  return { available: organizations.length > 0, invited: rows.some((row) => row.invited), organizations };
}

async function crewHint(db, memberId) {
  const links = await db
    .from("ops_identity_links")
    .select("event_id, person_id")
    .eq("kind", "portal")
    .eq("principal_id", memberId);
  if (links.error) {
    console.error("[control.detect] crew", links.error.message);
    return [];
  }
  const rows = links.data || [];
  if (!rows.length) return [];

  const [people, events] = await Promise.all([
    db.from("ops_people").select("id, roles").in("id", rows.map((row) => row.person_id)),
    db
      .from("events")
      .select("id, name, event_date")
      .in("id", [...new Set(rows.map((row) => row.event_id))])
      .is("deleted_at", null),
  ]);
  if (people.error || events.error) {
    console.error("[control.detect] crew", (people.error || events.error).message);
    return [];
  }

  const rolesByPerson = new Map((people.data || []).map((p) => [p.id, p.roles || []]));
  const eventById = new Map((events.data || []).map((e) => [e.id, e]));
  const byEvent = new Map();
  for (const link of rows) {
    const event = eventById.get(link.event_id);
    if (!event) continue;
    const entry = byEvent.get(event.id) || { eventId: event.id, eventName: event.name, eventDate: event.event_date, roles: new Set() };
    for (const role of rolesByPerson.get(link.person_id) || []) entry.roles.add(role);
    byEvent.set(event.id, entry);
  }

  return [...byEvent.values()]
    .map((entry) => ({ ...entry, roles: ROLE_ORDER.filter((role) => entry.roles.has(role)) }))
    .sort((a, b) => String(a.eventDate || "").localeCompare(String(b.eventDate || "")));
}
