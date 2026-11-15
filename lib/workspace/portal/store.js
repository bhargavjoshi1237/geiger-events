import { WorkspaceError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";
import { BUCKET } from "../server/store.js";

function db() {
  const client = adminClient();
  if (!client) throw new WorkspaceError("service_unavailable", 503, "The portal is unavailable.");
  return client;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

const portalRow = (row) => (row ? {
  enabled: row.enabled, peopleObjectId: row.people_object_id, emailFieldId: row.email_field_id, nameFieldId: row.name_field_id,
  signupEnabled: row.signup_enabled, settings: row.settings ?? {}, publishedVersionId: row.published_version_id, revision: Number(row.revision),
} : null);
const roleRow = (row) => ({
  id: row.id, key: row.key, name: row.name, icon: row.icon, color: row.color, builtin: row.builtin, membership: row.membership,
  access: row.access ?? {}, position: row.position, revision: Number(row.revision), deletedAt: row.deleted_at,
});
const pageRow = (row) => ({
  id: row.id, slug: row.slug, title: row.title, icon: row.icon, kind: row.kind, objectId: row.object_id, audience: row.audience ?? {},
  layout: row.layout, body: row.body ?? {}, position: row.position, revision: Number(row.revision), deletedAt: row.deleted_at,
});

// Emails are stored lower-case on tokens; member emails may not be, so match them case-insensitively but literally.
const literal = (email) => String(email).replace(/[\\%_]/g, (char) => `\\${char}`);

// Published versions never change, so they are kept in memory once read.
const versionCache = new Map();

export const portalStore = {
  async eventRow(eventId) {
    return checked(await db().from("events").select("*").eq("id", eventId).is("deleted_at", null).maybeSingle());
  },
  async portal(context) {
    return portalRow(checked(await db().from("workspace_portals").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).maybeSingle()));
  },
  async roles(context) {
    return checked(await db().from("workspace_roles").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).order("position").order("created_at")).map(roleRow);
  },
  async pages(context) {
    return checked(await db().from("workspace_pages").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).order("position").order("created_at")).map(pageRow);
  },
  async versions(context) {
    return checked(await db().from("workspace_portal_versions").select("id,number,note,published_by,published_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).order("number", { ascending: false }).limit(50));
  },
  async version(context, id) {
    if (!id) return null;
    if (versionCache.has(id)) return versionCache.get(id);
    const row = checked(await db().from("workspace_portal_versions").select("id,number,snapshot,published_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("id", id).maybeSingle());
    if (row) {
      if (versionCache.size > 200) versionCache.delete(versionCache.keys().next().value);
      versionCache.set(id, row);
    }
    return row;
  },
  async config(context, command) {
    return checked(await db().rpc("workspace_portal_config", {
      p_project: context.projectId, p_event: context.eventId, p_actor: context.principal.id, p_command: command,
    }));
  },
  async portalCommand(context, { memberId, personId, guard, command }) {
    return checked(await db().rpc("workspace_portal_command", {
      p_project: context.projectId, p_event: context.eventId, p_member: memberId, p_person: personId, p_guard: guard, p_command: command,
    }));
  },
  async aggregate(context, plan) {
    return checked(await db().rpc("workspace_aggregate", { p_project: context.projectId, p_event: context.eventId, p_plan: plan }));
  },

  // Sign-in codes and invite links
  async addToken(row) {
    return checked(await db().from("workspace_portal_tokens").insert(row).select("*").single());
  },
  async countCodes(context, { email, since }) {
    let query = db().from("workspace_portal_tokens").select("id", { count: "exact", head: true })
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("purpose", "code").gte("created_at", since);
    if (email) query = query.eq("email", email);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },
  async latestCode(context, email) {
    return checked(await db().from("workspace_portal_tokens").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("purpose", "code").eq("email", email)
      .is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle());
  },
  async tokenByHash(hash) {
    return checked(await db().from("workspace_portal_tokens").select("*").eq("token_hash", hash).maybeSingle());
  },
  async updateToken(id, patch) {
    checked(await db().from("workspace_portal_tokens").update(patch).eq("id", id));
  },
  // Marks a token used only if nobody else did first, so a link or code works once.
  async claimToken(id) {
    const rows = checked(await db().from("workspace_portal_tokens").update({ used_at: new Date().toISOString() })
      .eq("id", id).is("used_at", null).is("revoked_at", null).select("id"));
    return rows.length === 1;
  },
  async invites(context) {
    return checked(await db().from("workspace_portal_tokens").select("id,email,member_id,expires_at,used_at,revoked_at,created_at,created_by")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("purpose", "invite")
      .order("created_at", { ascending: false }).limit(1000));
  },
  async signIns(context) {
    return checked(await db().from("workspace_portal_tokens").select("email,used_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).not("used_at", "is", null)
      .order("used_at", { ascending: false }).limit(2000));
  },

  // Members (the shared buyer/portal account) and their sessions
  async memberByEmail(email) {
    return checked(await db().from("portal_members").select("id,email,name").ilike("email", literal(email)).maybeSingle());
  },
  async createMember(email, name = "") {
    const result = await db().from("portal_members").insert({ email, name }).select("id,email,name").single();
    if (result.error?.code === "23505") return this.memberByEmail(email);
    return checked(result);
  },
  async membersByIds(ids) {
    if (!ids.length) return [];
    return checked(await db().from("portal_members").select("id,email,name").in("id", ids));
  },
  async createSession(memberId, tokenHash, expiresAt) {
    checked(await db().from("portal_sessions").insert({ member_id: memberId, token_hash: tokenHash, expires_at: expiresAt }));
  },
  async deleteSession(tokenHash) {
    checked(await db().from("portal_sessions").delete().eq("token_hash", tokenHash));
  },

  // Form drafts
  async draft(context, { memberId, pageId, blockId }) {
    return checked(await db().from("workspace_form_drafts").select("data,updated_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("member_id", memberId)
      .eq("page_id", pageId).eq("block_id", blockId).maybeSingle());
  },
  async saveDraft(context, { memberId, pageId, blockId, data }) {
    checked(await db().from("workspace_form_drafts").upsert({
      project_id: context.projectId, event_id: context.eventId, member_id: memberId, page_id: pageId, block_id: blockId, data,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id,event_id,member_id,page_id,block_id" }));
  },
  async deleteDraft(context, { memberId, pageId, blockId }) {
    checked(await db().from("workspace_form_drafts").delete()
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("member_id", memberId)
      .eq("page_id", pageId).eq("block_id", blockId));
  },

  // A short-lived link that opens a file in the browser (PDF viewer) instead of downloading it.
  async signView(path) {
    return checked(await db().storage.from(BUCKET).createSignedUrl(path, 600));
  },
  async filesCreatedBy(context, memberId, ids) {
    if (!ids.length) return [];
    return checked(await db().from("workspace_files").select("id")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("created_by", memberId).in("id", ids)).map((row) => row.id);
  },
  async portalComments(context, recordId) {
    return checked(await db().from("workspace_comments").select("id,body,created_by,actor_kind,created_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("record_id", recordId)
      .order("created_at", { ascending: true }).limit(200));
  },
  async ownChanges(context, { recordId, memberId }) {
    return checked(await db().from("workspace_changes").select("id,action,before,after,created_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("record_id", recordId)
      .eq("actor_kind", "portal").eq("actor_id", memberId).order("created_at", { ascending: false }).limit(30));
  },
};
