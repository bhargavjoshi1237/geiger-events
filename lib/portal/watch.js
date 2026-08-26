import { adminClient } from "@/lib/supabase/admin";
import { loadMemberGrants } from "@/lib/portal/grants";
import { resolveItemGrant } from "@/lib/live/access";


const LIBRARY_MODULES = ["recording", "simulive"];
const WATCHABLE_STATUS = {
  recording: new Set(["Published"]),
  simulive: new Set(["Available", "Premiering"]),
};

const asObject = (v) => (v && typeof v === "object" ? v : {});

function itemEventIds(config) {
  const c = asObject(config);
  if (Array.isArray(c.eventIds)) return c.eventIds.filter(Boolean);
  return c.eventId ? [c.eventId] : [];
}

export async function listMemberWatchlist(email) {
  const sb = adminClient();
  if (!sb || !email) return [];

  const prepared = await loadMemberGrants(sb, email);
  if (!prepared) return [];
  const { grants, planIdsByProject, planExpiry, planName, events, projectIds } = prepared;

  const { data: items, error: itemsError } = await sb
    .from("conference_records")
    .select("id, module, name, status, cover_url, config, project_id, created_at")
    .in("project_id", projectIds)
    .in("module", LIBRARY_MODULES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (itemsError) {
    console.error("[portal.watch.library]", itemsError.message);
    return [];
  }

  const out = [];
  for (const item of items || []) {
    if (!WATCHABLE_STATUS[item.module]?.has(item.status)) continue;
    const config = asObject(item.config);
    if (!config.videoUrl) continue;

    const eventIds = itemEventIds(config);
    const grant = resolveItemGrant({
      access: config.access,
      eventIds,
      projectId: item.project_id,
      grants,
      planIdsByProject,
      planExpiry,
      planName,
      events,
    });
    if (!grant.granted) continue;
    if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;

    const eventNames = eventIds.map((id) => events[id]?.name).filter(Boolean);
    out.push({
      id: item.id,
      kind: item.module,
      name: item.name || "Untitled recording",
      videoUrl: config.videoUrl,
      thumbnailUrl: item.cover_url || "",
      session: config.session ?? "",
      speaker: config.speaker ?? "",
      duration: config.duration ?? "",
      recordedAt: config.recordedAt ?? "",
      premiereAt: config.premiereAt ?? "",
      description: config.description ?? "",
      tags: Array.isArray(config.tags) ? config.tags : [],
      eventName: eventNames[0] || "",
      planName: grant.via,
      expiresAt: grant.expiresAt,
    });
  }

  return out;
}
