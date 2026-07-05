"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for Discovery — a project's public organiser profile and the
// audience that follows it. Owns events.organiser_profile (one row per project)
// and events.organiser_followers. Pure: validate, console.error on failure,
// return null/[]/false — never throw, never toast (the screen owns UX). DB is
// snake_case, UI camelCase; map at this boundary.

const PROFILE_TABLE = "organiser_profile";
const FOLLOWERS_TABLE = "organiser_followers";

// DB row -> camelCase view model. metadata is the expansion bag.
export function normalizeProfile(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    displayName: row.display_name ?? "",
    tagline: row.tagline ?? "",
    bio: row.bio ?? "",
    avatarUrl: row.avatar_url ?? "",
    bannerUrl: row.banner_url ?? "",
    website: row.website ?? "",
    location: row.location ?? "",
    contactEmail: row.contact_email ?? "",
    links: Array.isArray(row.links) ? row.links : [],
    createdBy: row.created_by ?? null,
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one updateProfile serves both a full save and a single-field edit.
function toRow(input) {
  const row = {};
  const map = {
    displayName: "display_name",
    tagline: "tagline",
    bio: "bio",
    avatarUrl: "avatar_url",
    bannerUrl: "banner_url",
    website: "website",
    location: "location",
    contactEmail: "contact_email",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key] ?? "";
  }
  if ("links" in input) {
    row.links = Array.isArray(input.links) ? input.links : [];
  }
  return row;
}

export function normalizeFollower(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    email: row.email ?? "",
    name: row.name ?? "",
    source: row.source ?? "wall",
    createdAt: row.created_at ?? "",
  };
}

// Resolve a project's profile, creating it on first open (member RLS lets the
// caller insert into a project they belong to). Mirrors getWall's get-or-create.
export async function getProfile(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PROFILE_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[discovery.getProfile]", error.message);
      return null;
    }
    if (data) return normalizeProfile(data);

    const { data: created, error: createError } = await sb
      .from(PROFILE_TABLE)
      .insert({ project_id: projectId })
      .select("*")
      .single();
    if (createError) {
      // Lost a get-or-create race: re-select the winner's row.
      const { data: existing } = await sb
        .from(PROFILE_TABLE)
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) return normalizeProfile(existing);
      console.error("[discovery.createProfile]", createError.message);
      return null;
    }
    return normalizeProfile(created);
  } catch (e) {
    console.error("[discovery.getProfile]", e);
    return null;
  }
}

// Public, read-only resolve for the /w/<slug> wall — never creates a row, so an
// anonymous visitor (no insert rights) simply gets null when none exists.
export async function getPublicProfile(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PROFILE_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[discovery.getPublicProfile]", error.message);
      return null;
    }
    return normalizeProfile(data);
  } catch (e) {
    console.error("[discovery.getPublicProfile]", e);
    return null;
  }
}

export async function updateProfile(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PROFILE_TABLE)
      .update(toRow(patch))
      .eq("project_id", projectId)
      .select("*")
      .single();
    if (error) {
      console.error("[discovery.updateProfile]", error.message);
      return null;
    }
    return normalizeProfile(data);
  } catch (e) {
    console.error("[discovery.updateProfile]", e);
    return null;
  }
}

// The project's followers, newest first.
export async function listFollowers(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(FOLLOWERS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[discovery.listFollowers]", error.message);
      return null;
    }
    return (data || []).map(normalizeFollower);
  } catch (e) {
    console.error("[discovery.listFollowers]", e);
    return null;
  }
}

// Hard delete — an unfollow frees the email to re-follow later.
export async function removeFollower(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(FOLLOWERS_TABLE).delete().eq("id", id);
    if (error) {
      console.error("[discovery.removeFollower]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[discovery.removeFollower]", e);
    return false;
  }
}

// Public follow — anonymous buyers subscribe through the SECURITY DEFINER RPC.
// Idempotent (a repeat follow is a no-op). Returns true on success.
export async function followOrganiser(projectId, email, name = "") {
  if (!projectId || !email || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("follow_organiser", {
      p_project_id: projectId,
      p_email: email,
      p_name: name,
    });
    if (error) {
      console.error("[discovery.followOrganiser]", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[discovery.followOrganiser]", e);
    return false;
  }
}
