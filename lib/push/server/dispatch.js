import { adminClient } from "@/lib/supabase/admin";
import { resolveAudienceEmails } from "@/lib/audience/resolve";
import { selectAll } from "@/lib/supabase/select_all";
import { isTypeEnabled, pushType } from "../types.js";
import { getReceipts, sendMessages } from "./expo.js";
import { inQuietHours, quietHoursEnd } from "./time.js";
import { renderBatch } from "./render.js";
import {
  enqueueEmails,
  getMemberCategoriesMap,
  getProjectSettingsMap,
  getRuntime,
  listDevicesFor,
  logRun,
  pushDb,
  retireTokens,
} from "./store.js";

// Claim → render → filter (pause, type switch, quiet hours, member mute) → send through Expo → record → check receipts.

const MAX_ATTEMPTS = 5;
const MAX_FANOUT_ATTEMPTS = 5;
const RECEIPT_DELAY_MS = 15 * 60000;
const RECEIPT_GIVE_UP_MS = 24 * 60 * 60000;
const IN_CHUNK = 100;

async function patchRow(db, id, patch) {
  const { error } = await db.from("notifications").update({ ...patch, lease_until: null }).eq("id", id);
  if (error) console.error("[push.dispatch.patch]", error.message);
}

// Patches run ten at a time so a full batch settles quickly after the send.
async function patchAll(db, patches) {
  for (let i = 0; i < patches.length; i += 10) {
    await Promise.all(patches.slice(i, i + 10).map(([id, patch]) => patchRow(db, id, patch)));
  }
}

function chunks(list, size = IN_CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Announcement audiences resolve in JS (lib/audience), then expand into per-member rows. Failures retry, then fail loudly.
async function processFanouts(db) {
  const { data: fanouts, error } = await db.rpc("claim_fanouts", { p_limit: 10 });
  if (error) {
    console.error("[push.dispatch.fanouts]", error.message);
    return;
  }
  const sb = adminClient();
  for (const f of fanouts || []) {
    try {
      const emails = await audienceEmails(sb, f);
      const recipients = await enqueueEmails({
        projectId: f.project_id,
        eventId: f.event_id,
        type: f.type,
        emails,
        ref: f.ref || {},
        dedupe: f.dedupe_key,
        strict: true,
      });
      await db.from("fanouts").update({ status: "done", recipients, error: null, lease_until: null }).eq("id", f.id);
    } catch (e) {
      console.error("[push.dispatch.fanout]", e);
      const giveUp = f.attempts >= MAX_FANOUT_ATTEMPTS;
      await db
        .from("fanouts")
        .update({
          status: giveUp ? "failed" : "pending",
          send_after: new Date(Date.now() + 5 * 60000).toISOString(),
          error: String(e?.message || e).slice(0, 500),
          lease_until: null,
        })
        .eq("id", f.id);
    }
  }
}

// The announcement's audience spec when it has one, otherwise everyone with an order or membership in the project.
async function audienceEmails(sb, fanout) {
  const spec = fanout.audience;
  const hasSpec = spec && (typeof spec === "string" || (typeof spec === "object" && Object.keys(spec).length > 0));
  if (hasSpec && fanout.project_id) {
    const { emails } = await resolveAudienceEmails(fanout.project_id, spec, { client: sb });
    return emails;
  }
  if (!fanout.project_id) return [];
  const [orders, members] = await Promise.all([
    selectAll(() => sb.from("event_orders").select("id, buyer_email").eq("project_id", fanout.project_id).is("cancelled_at", null).order("id")),
    selectAll(() => sb.from("membership_members").select("id, email").eq("project_id", fanout.project_id).eq("status", "Active").is("deleted_at", null).order("id")),
  ]);
  if (orders.error || members.error) throw new Error((orders.error || members.error).message);
  return [
    ...new Set([...orders.data.map((o) => o.buyer_email), ...members.data.map((m) => m.email)].map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)),
  ];
}

function backoffMs(attempts) {
  return Math.min(60, 2 ** Math.max(0, attempts)) * 60000;
}

// Quiet hours for rows without an event use the project's most recent event zone rather than a fixed default.
async function projectZones(rows, rendered) {
  const need = [...new Set(rows.filter((r) => r.project_id && !rendered.get(r.id)?.tz).map((r) => r.project_id))];
  const zones = new Map();
  if (!need.length) return zones;
  const sb = adminClient();
  const { data } = await sb
    .from("events")
    .select("project_id, timezone, event_date")
    .in("project_id", need)
    .is("deleted_at", null)
    .not("timezone", "is", null)
    .order("event_date", { ascending: false, nullsFirst: false })
    .limit(500);
  for (const e of data || []) if (!zones.has(e.project_id)) zones.set(e.project_id, e.timezone);
  return zones;
}

function retryOrFail(row, error) {
  return row.attempts < MAX_ATTEMPTS
    ? { status: "queued", send_after: new Date(Date.now() + backoffMs(row.attempts)).toISOString(), last_error: error }
    : { status: "failed", last_error: error };
}

async function processRows(db, rows, stats, { fetchImpl }) {
  const now = new Date();
  const [settings, prefs, rendered] = await Promise.all([
    getProjectSettingsMap(rows.map((r) => r.project_id)),
    getMemberCategoriesMap(rows.map((r) => r.member_id)),
    renderBatch(rows),
  ]);
  const zones = await projectZones(rows, rendered);

  const patches = [];
  const sendable = [];
  for (const row of rows) {
    const s = settings.get(row.project_id);
    const r = rendered.get(row.id) || { skip: "render" };
    const test = row.type === "test";
    const copy = r.skip || r.retry ? {} : { title: r.title, body: r.body, data: r.data };
    const tz = r.tz || zones.get(row.project_id) || null;
    if (r.retry) {
      // The source data couldn't be read (DB hiccup): try again later rather than dropping it.
      const next = retryOrFail(row, r.retry);
      if (next.status === "failed") stats.failed += 1;
      patches.push([row.id, next]);
    } else if (!test && s.paused) {
      stats.skipped += 1;
      patches.push([row.id, { status: "skipped", skip_reason: "paused" }]);
    } else if (!test && !isTypeEnabled(s, row.type)) {
      stats.skipped += 1;
      patches.push([row.id, { status: "skipped", skip_reason: "type_off" }]);
    } else if (r.skip) {
      stats.skipped += 1;
      patches.push([row.id, { status: "skipped", skip_reason: r.skip }]);
    } else if (!test && pushType(row.type)?.quiet && inQuietHours(now, s.quietHours, tz)) {
      // A quiet-hours hold isn't an attempt.
      patches.push([row.id, { status: "queued", send_after: quietHoursEnd(now, s.quietHours, tz).toISOString(), attempts: Math.max(0, row.attempts - 1), ...copy }]);
    } else if (!test && prefs.get(row.member_id)[row.category] === false) {
      // Kept as history so it still shows in the app's notification list.
      stats.skipped += 1;
      patches.push([row.id, { status: "skipped", skip_reason: "muted", ...copy }]);
    } else {
      sendable.push({ row, r });
    }
  }

  const devices = sendable.length ? await listDevicesFor(sendable.map((s) => s.row.member_id)) : [];
  const byMember = new Map();
  for (const d of devices) (byMember.get(d.member_id) || byMember.set(d.member_id, []).get(d.member_id)).push(d);

  const messages = [];
  const owners = [];
  for (const { row, r } of sendable) {
    const mine = byMember.get(row.member_id) || [];
    if (!mine.length) {
      stats.skipped += 1;
      patches.push([row.id, { status: "skipped", skip_reason: "no_device", title: r.title, body: r.body, data: r.data }]);
      continue;
    }
    for (const d of mine) {
      const msg = { to: d.push_token, title: r.title, body: r.body, data: r.data, sound: "default", priority: "high", channelId: row.category };
      if (row.expires_at) msg.expiration = Math.floor(new Date(row.expires_at).getTime() / 1000);
      messages.push(msg);
      owners.push({ row, r, device: d });
    }
  }

  if (messages.length) {
    const results = await sendMessages(messages, { fetchImpl });
    const deliveries = [];
    const dead = [];
    const outcome = new Map();
    results.forEach((res, i) => {
      const { row, r, device } = owners[i];
      const error = res.ok ? null : `${res.error}: ${res.message}`.slice(0, 500);
      deliveries.push({
        notification_id: row.id,
        device_id: device.id,
        push_token: device.push_token,
        platform: device.platform,
        ticket_id: res.ticketId || null,
        status: res.ok ? "ok" : "error",
        error,
        receipt_status: res.ok && res.ticketId ? "pending" : null,
      });
      if (!res.ok && res.error === "DeviceNotRegistered") dead.push(device.push_token);
      const o = outcome.get(row.id) || { row, r, ok: 0, transient: false, error: null };
      if (res.ok) o.ok += 1;
      else {
        o.transient = o.transient || res.transient;
        o.error = error;
      }
      outcome.set(row.id, o);
    });

    // Deliveries first: if this run dies now, claim() sees the ok delivery and settles the row instead of resending.
    const { error } = await db.from("deliveries").insert(deliveries);
    if (error) console.error("[push.dispatch.deliveries]", error.message);
    await retireTokens(dead);

    for (const o of outcome.values()) {
      const copy = { title: o.r.title, body: o.r.body, data: o.r.data };
      if (o.ok > 0) {
        stats.sent += 1;
        patches.push([o.row.id, { status: "sent", sent_at: new Date().toISOString(), skip_reason: null, last_error: null, ...copy }]);
      } else if (o.transient) {
        const next = retryOrFail(o.row, o.error);
        if (next.status === "failed") stats.failed += 1;
        patches.push([o.row.id, { ...next, ...copy }]);
      } else {
        stats.failed += 1;
        patches.push([o.row.id, { status: "failed", last_error: o.error, ...copy }]);
      }
    }
  }
  await patchAll(db, patches);
}

async function checkReceipts(db, { fetchImpl }) {
  const { data, error } = await db
    .from("deliveries")
    .select("id, ticket_id, push_token, created_at")
    .eq("receipt_status", "pending")
    .lte("created_at", new Date(Date.now() - RECEIPT_DELAY_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error || !data?.length) return;
  const receipts = await getReceipts(data.map((d) => d.ticket_id).filter(Boolean), { fetchImpl });
  const okIds = [];
  const unknownIds = [];
  const failures = [];
  const dead = [];
  const checkedAt = new Date().toISOString();
  for (const d of data) {
    const r = receipts[d.ticket_id];
    if (!r) {
      if (Date.now() - new Date(d.created_at).getTime() > RECEIPT_GIVE_UP_MS) unknownIds.push(d.id);
      continue;
    }
    if (r.status === "ok") okIds.push(d.id);
    else {
      if (r.error === "DeviceNotRegistered") dead.push(d.push_token);
      failures.push([d.id, `${r.error}${r.message ? `: ${r.message}` : ""}`.slice(0, 500)]);
    }
  }
  const settle = async (ids, patch) => {
    for (const part of chunks(ids)) {
      const { error: upErr } = await db.from("deliveries").update({ ...patch, receipt_checked_at: checkedAt }).in("id", part);
      if (upErr) console.error("[push.dispatch.receipts]", upErr.message);
    }
  };
  await settle(okIds, { receipt_status: "ok" });
  await settle(unknownIds, { receipt_status: "unknown" });
  for (let i = 0; i < failures.length; i += 10) {
    await Promise.all(
      failures.slice(i, i + 10).map(([id, msg]) =>
        db.from("deliveries").update({ receipt_status: "error", receipt_error: msg, receipt_checked_at: checkedAt }).eq("id", id),
      ),
    );
  }
  await retireTokens(dead);
}

// ids: send exactly these rows now (retry/test) and skip fan-outs, receipts and the run log.
export async function runDispatch({ ids = null, budgetMs = 20000, limit = 100, fetchImpl = fetch } = {}) {
  const started = Date.now();
  const stats = { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  const db = pushDb();
  if (!db) return { ok: false, error: "unavailable", ...stats };
  if (process.env.PUSH_DISPATCH_PAUSED === "1") return { ok: true, paused: true, ...stats };
  if (!ids && (await getRuntime()).paused) return { ok: true, paused: true, ...stats };

  try {
    if (!ids) await processFanouts(db);
    do {
      const { data: rows, error } = await db.rpc("claim", { p_limit: limit, p_ids: ids, p_lease_seconds: 120 });
      if (error) throw new Error(error.message);
      if (!rows?.length) break;
      stats.claimed += rows.length;
      await processRows(db, rows, stats, { fetchImpl });
      if (ids) break;
    } while (Date.now() - started < budgetMs);
    if (!ids && Date.now() - started < budgetMs + 10000) await checkReceipts(db, { fetchImpl });
  } catch (e) {
    console.error("[push.dispatch]", e);
    stats.error = String(e?.message || e);
  }
  if (!ids) await logRun("dispatch", started, stats);
  return { ok: !stats.error, ...stats, ms: Date.now() - started };
}
