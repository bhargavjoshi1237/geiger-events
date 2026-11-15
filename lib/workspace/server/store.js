import { WorkspaceError } from "../errors.js";
import { adminClient } from "../../supabase/admin.js";

export const BUCKET = "workspace";

function db() {
  const client = adminClient();
  if (!client) throw new WorkspaceError("service_unavailable", 503, "Workspace is unavailable.");
  return client;
}

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

const objectRow = (row) => ({
  id: row.id, key: row.key, name: row.name, plural: row.plural, icon: row.icon, titleFieldId: row.title_field_id,
  statuses: row.statuses, numberPrefix: row.number_prefix, position: row.position, revision: Number(row.revision), deletedAt: row.deleted_at,
});
const fieldRow = (row) => ({
  id: row.id, objectId: row.object_id, key: row.key, name: row.name, type: row.type, config: row.config,
  required: row.required, isUnique: row.is_unique, position: row.position, revision: Number(row.revision), deletedAt: row.deleted_at,
});
const viewRow = (row) => ({ id: row.id, objectId: row.object_id, name: row.name, shared: row.owner_id === null, config: row.config, position: row.position });
export const recordRow = (row) => ({
  id: row.id, objectId: row.object_id, number: Number(row.number), title: row.title, status: row.status, values: row.data,
  revision: Number(row.revision), createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by,
  updatedBy: row.updated_by, deletedAt: row.deleted_at,
});

export const workspaceStore = {
  async event(context) {
    return checked(await db().from("events").select("id,name,timezone,venue_id,event_date")
      .eq("id", context.eventId).eq("project_id", context.projectId).maybeSingle());
  },
  // Objects and fields include trashed ones (the trash and copy screens need them); views are shared or the actor's own.
  async definition(context) {
    const { projectId, eventId, principal } = context;
    const scope = (query) => query.eq("project_id", projectId).eq("event_id", eventId);
    const [workspace, objects, fields, views] = await Promise.all([
      db().from("workspace_workspaces").select("revision,created_from,created_at").eq("project_id", projectId).eq("event_id", eventId).maybeSingle(),
      scope(db().from("workspace_objects").select("*")).order("position"),
      scope(db().from("workspace_fields").select("*")).order("position"),
      scope(db().from("workspace_saved_views").select("*")).or(`owner_id.is.null,owner_id.eq.${principal.id}`).order("position"),
    ]);
    const row = checked(workspace);
    return {
      workspace: row ? { revision: Number(row.revision), createdFrom: row.created_from, createdAt: row.created_at } : null,
      objects: checked(objects).map(objectRow),
      fields: checked(fields).map(fieldRow),
      views: checked(views).map(viewRow),
    };
  },
  async command(context, command) {
    return checked(await db().rpc("workspace_command", {
      p_project: context.projectId, p_event: context.eventId, p_actor: context.principal.id, p_command: command,
    }));
  },
  async query(context, plan) {
    return checked(await db().rpc("workspace_query", { p_project: context.projectId, p_event: context.eventId, p_plan: plan }));
  },
  async record(context, recordId) {
    const row = checked(await db().from("workspace_records").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("id", recordId).maybeSingle());
    return row ? recordRow(row) : null;
  },
  async records(context, ids) {
    if (!ids.length) return [];
    return checked(await db().from("workspace_records").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).in("id", ids)).map(recordRow);
  },
  // Pages through every record of an object (for recalculation and field-change previews).
  async *recordPages(context, objectId, { size = 500, deleted = false } = {}) {
    for (let from = 0; ; from += size) {
      let query = db().from("workspace_records").select("*")
        .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("object_id", objectId);
      query = deleted ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
      const rows = checked(await query.order("number").range(from, from + size - 1)).map(recordRow);
      if (rows.length) yield rows;
      if (rows.length < size) return;
    }
  },
  async links(context, recordIds) {
    if (!recordIds.length) return [];
    return checked(await db().from("workspace_links").select("source_record_id,field_id,target_kind,target_id,position")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).in("source_record_id", recordIds).order("position"));
  },
  async backlinks(context, recordId) {
    return checked(await db().from("workspace_links").select("source_record_id,field_id")
      .eq("project_id", context.projectId).eq("event_id", context.eventId)
      .eq("target_kind", "record").eq("target_id", recordId).limit(500));
  },
  async recordLabels(context, ids) {
    if (!ids.length) return [];
    return checked(await db().from("workspace_records").select("id,object_id,number,title,deleted_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).in("id", ids));
  },
  async searchRecords(context, objectId, q) {
    let query = db().from("workspace_records").select("id,object_id,number,title")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("object_id", objectId).is("deleted_at", null);
    if (q) query = /^\d+$/.test(q) ? query.or(`number.eq.${q},title.ilike.%${q}%`) : query.ilike("title", `%${q}%`);
    return checked(await query.order("number", { ascending: false }).limit(20));
  },
  async comments(context, recordId) {
    return checked(await db().from("workspace_comments").select("id,body,created_by,created_at,actor_kind")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("record_id", recordId)
      .order("created_at", { ascending: false }).limit(100));
  },
  async changes(context, { recordId, kind, before, limit = 50 } = {}) {
    let query = db().from("workspace_changes").select("*").eq("project_id", context.projectId).eq("event_id", context.eventId);
    if (recordId) query = query.eq("record_id", recordId);
    if (kind) query = query.eq("kind", kind);
    if (before) query = query.lt("created_at", before);
    return checked(await query.order("created_at", { ascending: false }).limit(limit));
  },
  async trashedRecords(context) {
    return checked(await db().from("workspace_records").select("id,object_id,number,title,deleted_at")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }).limit(200));
  },
  async people(context, userIds) {
    if (!userIds.length) return [];
    return checked(await db().from("project_members").select("user_id,name,email")
      .eq("project_id", context.projectId).in("user_id", userIds).is("deleted_at", null));
  },
  // Event data a link field can point at; scoped exactly like events.workspace__target_in_scope.
  async eventData(context, kind, { ids, q, venueId } = {}) {
    const limit = ids ? ids.length : 20;
    const like = q ? `%${q.replace(/[%_,()]/g, " ")}%` : null;
    const pick = async (query, map) => {
      if (ids) query = query.in("id", ids);
      return checked(await query.limit(limit)).map(map);
    };
    switch (kind) {
      case "contact": {
        let query = db().from("contacts").select("id,name,email").eq("project_id", context.projectId).is("deleted_at", null);
        if (like) query = query.or(`name.ilike.${like},email.ilike.${like}`);
        return pick(query, (row) => ({ id: row.id, label: row.name || row.email, sub: row.name ? row.email : "" }));
      }
      case "ticket": {
        let query = db().from("registrations").select("id,name,email,status").eq("event_id", context.eventId).is("deleted_at", null);
        if (like) query = query.or(`name.ilike.${like},email.ilike.${like}`);
        const rows = await pick(query, (row) => row);
        const checkins = ids ? await workspaceStore.checkins(context, "registration_id", rows.map((row) => row.id)) : new Map();
        return rows.map((row) => ({ id: row.id, label: row.name || row.email, sub: [row.email, row.status, checkins.get(row.id)].filter(Boolean).join(" · ") }));
      }
      case "order": {
        let query = db().from("event_orders").select("id,buyer_name,buyer_email,ticket_name,quantity,total,status,refunded_total,cancelled_at").eq("event_id", context.eventId);
        if (like) query = query.or(`buyer_name.ilike.${like},buyer_email.ilike.${like}`);
        const rows = await pick(query, (row) => row);
        const checkins = ids ? await workspaceStore.checkins(context, "order_id", rows.map((row) => row.id)) : new Map();
        return rows.map((row) => {
          const status = row.cancelled_at ? "cancelled" : Number(row.refunded_total) > 0 ? (Number(row.refunded_total) >= Number(row.total) ? "refunded" : "part refunded") : row.status;
          const total = Number(row.total).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return { id: row.id, label: row.buyer_name || row.buyer_email, sub: [`${row.quantity} × ${row.ticket_name}`, total, status, checkins.get(row.id)].filter(Boolean).join(" · ") };
        });
      }
      case "team_member": {
        let query = db().from("project_members").select("id,name,email").eq("project_id", context.projectId).is("deleted_at", null);
        if (like) query = query.or(`name.ilike.${like},email.ilike.${like}`);
        return pick(query, (row) => ({ id: row.id, label: row.name || row.email, sub: row.name ? row.email : "" }));
      }
      case "venue_space": {
        if (!venueId) return [];
        let query = db().from("venue_spaces").select("id,name,floor,kind").eq("venue_id", venueId).is("deleted_at", null);
        if (like) query = query.ilike("name", like);
        return pick(query, (row) => ({ id: row.id, label: row.name, sub: [row.kind, row.floor].filter(Boolean).join(" · ") }));
      }
      default:
        return [];
    }
  },
  // "Checked in 10:02" (event time) for the latest check-in of each registration or order.
  async checkins(context, column, ids) {
    if (!ids.length) return new Map();
    const { data, error } = await db().from("checkin_attendance").select(`${column},checked_in_at`).eq("event_id", context.eventId)
      .is("deleted_at", null).in(column, ids).order("checked_in_at", { ascending: false }).limit(500);
    if (error || !data.length) return new Map();
    const timeZone = (await workspaceStore.event(context).catch(() => null))?.timezone || "UTC";
    const format = (value) => {
      try {
        return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
      } catch {
        return new Date(value).toISOString().slice(0, 16).replace("T", " ");
      }
    };
    const out = new Map();
    for (const row of data) if (!out.has(row[column])) out.set(row[column], `Checked in ${format(row.checked_in_at)}`);
    return out;
  },
  async addFile(row) {
    return checked(await db().from("workspace_files").insert(row).select("*").single());
  },
  async file(context, fileId) {
    return checked(await db().from("workspace_files").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("id", fileId).maybeSingle());
  },
  async filePaths(context) {
    return checked(await db().from("workspace_files").select("path")
      .eq("project_id", context.projectId).eq("event_id", context.eventId)).map((row) => row.path);
  },
  async signUpload(path) {
    return checked(await db().storage.from(BUCKET).createSignedUploadUrl(path));
  },
  async signDownload(path, name) {
    return checked(await db().storage.from(BUCKET).createSignedUrl(path, 600, { download: name }));
  },
  async removeFiles(paths) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await db().storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
  },
  async copyFile(from, to) {
    const { error } = await db().storage.from(BUCKET).copy(from, to);
    if (error) throw error;
  },
  async portalSettings(context) {
    const row = checked(await db().from("workspace_portals").select("enabled,people_object_id,email_field_id")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).maybeSingle());
    return row ? { enabled: row.enabled, peopleObjectId: row.people_object_id, emailFieldId: row.email_field_id } : null;
  },
  async projectEventsWithWorkspace(context) {
    const rows = checked(await db().from("workspace_workspaces").select("event_id").eq("project_id", context.projectId));
    const ids = rows.map((row) => row.event_id).filter((id) => id !== context.eventId);
    if (!ids.length) return [];
    return checked(await db().from("events").select("id,name,event_date").in("id", ids).is("deleted_at", null)
      .order("event_date", { ascending: false }));
  },
  async templates(projectId) {
    return checked(await db().from("workspace_templates").select("id,name,description,snapshot,created_at,updated_at")
      .eq("project_id", projectId).order("updated_at", { ascending: false }));
  },
  async template(projectId, id) {
    return checked(await db().from("workspace_templates").select("*").eq("project_id", projectId).eq("id", id).maybeSingle());
  },
  async saveTemplate(row) {
    return checked(await db().from("workspace_templates").insert(row).select("id,name,description,created_at").single());
  },
  async deleteTemplate(projectId, id) {
    checked(await db().from("workspace_templates").delete().eq("project_id", projectId).eq("id", id));
  },
  async createJob(row) {
    return checked(await db().from("workspace_copy_jobs").insert(row).select("*").single());
  },
  async job(context, id) {
    return checked(await db().from("workspace_copy_jobs").select("*")
      .eq("project_id", context.projectId).eq("event_id", context.eventId).eq("id", id).maybeSingle());
  },
  async updateJob(id, patch) {
    return checked(await db().from("workspace_copy_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single());
  },
  async purge(before) {
    return checked(await db().rpc("workspace_purge", { p_before: before }));
  },
  async stalledJobs(olderThan) {
    return checked(await db().from("workspace_copy_jobs").select("*").eq("status", "running").lt("updated_at", olderThan).limit(20));
  },
};
