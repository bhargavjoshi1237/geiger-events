"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { compressImageUnder } from "@/lib/image/compress";

// Reusable image storage for the Events area. All event media lives in the
// public "products" bucket under events/<event-uuid>/. Writes are authoritative
// (RLS: only the event's creator); reads are public, so we persist the direct
// public URL in flow_events.cover_url / gallery.
//
//   import { uploadEventImage } from "@/lib/supabase/storage";
//   const { url } = await uploadEventImage(eventId, file, { compress: true });

export const EVENT_MEDIA_BUCKET = "products";

export function eventMediaPrefix(eventId) {
  return `events/${eventId}`;
}

// Venue media lives alongside event media in the same public bucket, under
// venues/<venue-uuid>/.
export function venueMediaPrefix(venueId) {
  return `venues/${venueId}`;
}

// Conference record media (speaker headshots, sponsor logos) lives in the same
// public bucket, under conference/<record-uuid>/.
export function conferenceMediaPrefix(recordId) {
  return `conference/${recordId}`;
}

// Inventory product photos live in the same public bucket, under
// inventory/<item-uuid>/. A variant is its own item row, so it gets its own
// folder — the UI falls back to the parent's photo when a variant has none.
export function inventoryMediaPrefix(itemId) {
  return `inventory/${itemId}`;
}

// Badge/pass design assets (background art, section images, QR centre marks)
// live in the same public bucket under badges/<project-uuid>/. They belong to a
// project's saved designs rather than to any one event.
export function badgeMediaPrefix(projectId) {
  return `badges/${projectId}`;
}

// Public URL for a stored object path.
export function buildPublicUrl(path) {
  if (!path) return null;
  const sb = createClient();
  const { data } = sb.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function extFromFile(file) {
  const fromName = (file?.name || "").split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = (file?.type || "").split("/")[1];
  return (fromType || "jpg").toLowerCase();
}

function uniqueName(file) {
  const ts = new Date().toISOString().replace(/[.:]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}.${extFromFile(file)}`;
}

/**
 * Upload one image for an event. Compresses to <500 KB by default. Returns
 * `{ path, url }` on success, or `null` on failure (validation, auth/RLS, or
 * network) — the caller decides UX. Only the event's creator is allowed to
 * write (enforced by storage RLS).
 */
export async function uploadEventImage(eventId, file, options = {}) {
  if (!eventId || !file || !isSupabaseConfigured()) return null;
  const { compress = true } = options;
  try {
    const payload = compress ? await compressImageUnder(file, 500) : file;
    const path = `${eventMediaPrefix(eventId)}/${uniqueName(payload)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: payload.type || file.type || "image/jpeg",
      });
    if (error) {
      console.error("[storage.uploadEventImage]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadEventImage]", e);
    return null;
  }
}

/**
 * Upload one video for an event (cover, gallery, page background). Videos are
 * never compressed — they're already encoded, and re-encoding a video in the
 * browser isn't supported. Returns `{ path, url }` on success, or `null` on
 * failure (validation, auth/RLS, or network) — the caller decides UX. Only the
 * event's creator is allowed to write (enforced by storage RLS).
 */
export async function uploadEventVideo(eventId, file) {
  if (!eventId || !file || !isSupabaseConfigured()) return null;
  try {
    const path = `${eventMediaPrefix(eventId)}/${uniqueName(file)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "video/mp4",
      });
    if (error) {
      console.error("[storage.uploadEventVideo]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadEventVideo]", e);
    return null;
  }
}

/**
 * Upload one image for a venue. Compresses to <500 KB by default. Returns
 * `{ path, url }` on success, or `null` on failure. Only the venue's creator is
 * allowed to write (enforced by storage RLS). Mirrors uploadEventImage.
 */
export async function uploadVenueImage(venueId, file, options = {}) {
  if (!venueId || !file || !isSupabaseConfigured()) return null;
  const { compress = true } = options;
  try {
    const payload = compress ? await compressImageUnder(file, 500) : file;
    const path = `${venueMediaPrefix(venueId)}/${uniqueName(payload)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: payload.type || file.type || "image/jpeg",
      });
    if (error) {
      console.error("[storage.uploadVenueImage]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadVenueImage]", e);
    return null;
  }
}

/**
 * Upload one image for a conference record (speaker headshot / sponsor logo).
 * Compresses to <500 KB by default. Returns `{ path, url }` on success, or
 * `null` on failure. Only the record's creator may write (storage RLS). Mirrors
 * uploadVenueImage.
 */
export async function uploadConferenceImage(recordId, file, options = {}) {
  if (!recordId || !file || !isSupabaseConfigured()) return null;
  const { compress = true } = options;
  try {
    const payload = compress ? await compressImageUnder(file, 500) : file;
    const path = `${conferenceMediaPrefix(recordId)}/${uniqueName(payload)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: payload.type || file.type || "image/jpeg",
      });
    if (error) {
      console.error("[storage.uploadConferenceImage]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadConferenceImage]", e);
    return null;
  }
}

/**
 * Upload the product photo for an inventory item (or variant). Compresses to
 * <500 KB by default. Returns `{ path, url }` on success, or `null` on failure.
 * Only the item's creator may write (storage RLS). Mirrors uploadVenueImage.
 */
export async function uploadInventoryImage(itemId, file, options = {}) {
  if (!itemId || !file || !isSupabaseConfigured()) return null;
  const { compress = true } = options;
  try {
    const payload = compress ? await compressImageUnder(file, 500) : file;
    const path = `${inventoryMediaPrefix(itemId)}/${uniqueName(payload)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: payload.type || file.type || "image/jpeg",
      });
    if (error) {
      console.error("[storage.uploadInventoryImage]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadInventoryImage]", e);
    return null;
  }
}

/**
 * Upload one badge-design asset for a project. Compresses to <500 KB by default.
 * Returns `{ path, url }` on success, or `null` on failure. Mirrors
 * uploadEventImage; writes are allowed for any project the caller can reach.
 */
export async function uploadBadgeImage(projectId, file, options = {}) {
  if (!projectId || !file || !isSupabaseConfigured()) return null;
  const { compress = true } = options;
  try {
    const payload = compress ? await compressImageUnder(file, 500) : file;
    const path = `${badgeMediaPrefix(projectId)}/${uniqueName(payload)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: payload.type || file.type || "image/jpeg",
      });
    if (error) {
      console.error("[storage.uploadBadgeImage]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadBadgeImage]", e);
    return null;
  }
}

/**
 * Upload one self-hosted font file pulled in by a brand import, under
 * events/<event-uuid>/fonts/. Never compressed — that path is canvas image
 * re-encoding and would destroy a font binary. Returns `{ path, url }`, or
 * `null` on failure so the caller can fall back to hotlinking the source.
 */
export async function uploadEventFont(eventId, file) {
  if (!eventId || !file || !isSupabaseConfigured()) return null;
  try {
    const path = `${eventMediaPrefix(eventId)}/fonts/${uniqueName(file)}`;
    const sb = createClient();
    const { error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .upload(path, file, {
        // Fonts are immutable once stored (the name carries a timestamp), so
        // they can cache far longer than an image the user may replace.
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type || "font/woff2",
      });
    if (error) {
      console.error("[storage.uploadEventFont]", error.message);
      return null;
    }
    return { path, url: buildPublicUrl(path) };
  } catch (e) {
    console.error("[storage.uploadEventFont]", e);
    return null;
  }
}

// Existing images for an event, newest first, as { name, path, url }.
export async function listEventImages(eventId) {
  if (!eventId || !isSupabaseConfigured()) return [];
  try {
    const sb = createClient();
    const prefix = eventMediaPrefix(eventId);
    const { data, error } = await sb.storage
      .from(EVENT_MEDIA_BUCKET)
      .list(prefix, { sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      console.error("[storage.listEventImages]", error.message);
      return [];
    }
    return (data || [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const path = `${prefix}/${f.name}`;
        return { name: f.name, path, url: buildPublicUrl(path) };
      });
  } catch (e) {
    console.error("[storage.listEventImages]", e);
    return [];
  }
}

// Remove an image by its full object path. Returns true on success.
export async function removeEventImage(path) {
  if (!path || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.storage.from(EVENT_MEDIA_BUCKET).remove([path]);
    if (error) {
      console.error("[storage.removeEventImage]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage.removeEventImage]", e);
    return false;
  }
}

// The storage object path for a previously-stored public URL (for deletion).
export function pathFromPublicUrl(url) {
  if (!url) return null;
  const marker = `/object/public/${EVENT_MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
