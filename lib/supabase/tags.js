import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Guests > Tags screen. Tag MEMBERSHIP lives in the
// events.contacts.tags text[] column; events.contact_tags is a presentation
// catalog (color, description, stable id) so a tag can be recolored / renamed /
// merged / deleted across the whole project. listTags merges the catalog with
// usage counts derived from contacts. rename/merge/delete rewrite the arrays via
// the events.rewrite_contact_tags RPC. Pure: console.error on failure, return
// null / false / []. DB is snake_case; the UI is camelCase.

const TABLE = "contact_tags";

export function normalizeTag(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    color: row.color ?? "slate",
    description: row.description ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    color: "color",
    description: "description",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  return row;
}

// The project's tags: every catalog row UNIONed with any tag that only exists on
// a contact yet (no catalog row = default color), each with its live usage count.
// Sorted by count desc, then name.
export async function listTags(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const [catalogRes, contactsRes] = await Promise.all([
      sb
        .from(TABLE)
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      sb
        .from("contacts")
        .select("tags")
        .eq("project_id", projectId)
        .is("deleted_at", null),
    ]);
    if (catalogRes.error) {
      console.error("[tags.list]", catalogRes.error.message);
      return null;
    }
    if (contactsRes.error) {
      console.error("[tags.list]", contactsRes.error.message);
      return null;
    }

    // Usage counts keyed by exact tag string.
    const counts = new Map();
    for (const c of contactsRes.data || []) {
      for (const t of Array.isArray(c.tags) ? c.tags : []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }

    const byName = new Map();
    for (const row of catalogRes.data || []) {
      const tag = normalizeTag(row);
      byName.set(tag.name, { ...tag, count: counts.get(tag.name) || 0 });
    }
    // Tags used on contacts but not yet in the catalog surface with defaults.
    for (const [name, count] of counts) {
      if (!byName.has(name)) {
        byName.set(name, {
          id: null,
          projectId,
          name,
          color: "slate",
          description: "",
          count,
        });
      }
    }

    return Array.from(byName.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  } catch (e) {
    console.error("[tags.list]", e);
    return null;
  }
}

export async function createTag(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[tags.create]", error.message);
      return null;
    }
    return normalizeTag(data);
  } catch (e) {
    console.error("[tags.create]", e);
    return null;
  }
}

export async function updateTag(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[tags.update]", error.message);
      return null;
    }
    return normalizeTag(data);
  } catch (e) {
    console.error("[tags.update]", e);
    return null;
  }
}

export async function softDeleteTag(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[tags.softDelete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[tags.softDelete]", e);
    return false;
  }
}

// Rewrite tag arrays across the project's contacts. Returns the number of
// contacts touched (>= 0) on success, or false on failure. `to = ""`/null
// removes the matched tags.
async function rewriteTags(projectId, from, to) {
  if (!projectId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("rewrite_contact_tags", {
      p_project: projectId,
      p_from: from,
      p_to: to ?? null,
    });
    if (error) {
      console.error("[tags.rewrite]", error.message);
      return false;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[tags.rewrite]", e);
    return false;
  }
}

// Rename a tag everywhere: rewrite contact arrays + rename/retire its catalog
// row. `catalogId` is the from-tag's catalog row id (may be null when it only
// existed on contacts).
export async function renameTag(projectId, from, to, catalogId) {
  const clean = String(to || "").trim();
  if (!projectId || !from || !clean || clean === from) return false;
  const touched = await rewriteTags(projectId, [from], clean);
  if (touched === false) return false;
  if (catalogId) await updateTag(catalogId, { name: clean });
  return true;
}

// Fold N tags into one target: rewrite contact arrays + retire the merged
// catalog rows. `fromIds` maps each `from` name to its catalog id (null skipped).
export async function mergeTags(projectId, from, into, fromIds = []) {
  const clean = String(into || "").trim();
  const sources = (from || []).filter((t) => t && t !== clean);
  if (!projectId || !clean || !sources.length) return false;
  const touched = await rewriteTags(projectId, sources, clean);
  if (touched === false) return false;
  for (const id of fromIds) if (id) await softDeleteTag(id);
  return true;
}

// Remove a tag from every contact + retire its catalog row.
export async function deleteTagEverywhere(projectId, name, catalogId) {
  if (!projectId || !name) return false;
  const touched = await rewriteTags(projectId, [name], null);
  if (touched === false) return false;
  if (catalogId) await softDeleteTag(catalogId);
  return true;
}
