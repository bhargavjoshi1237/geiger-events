"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for reusable registration forms. The only place that talks
// to events.registration_forms. Pure: validate, console.error on failure,
// return null / false / [] — never throw, never toast (the screen owns UX).

const TABLE = "registration_forms";

export function normalizeForm(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    fields: Array.isArray(row.fields) ? row.fields : [],
    settings:
      row.settings && typeof row.settings === "object" ? row.settings : {},
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    ...meta,
  };
}

// Emits a column only when its key is present in `input`, so one updateForm()
// serves a full save or a single-field patch (`{ status }`, `{ fields }`…).
function toRow(input) {
  const row = {};
  if ("name" in input) row.name = input.name;
  if ("description" in input) row.description = input.description;
  if ("status" in input) row.status = input.status;
  if ("createdBy" in input) row.created_by = input.createdBy;
  if ("fields" in input) {
    row.fields = Array.isArray(input.fields) ? input.fields : [];
  }
  if ("settings" in input) {
    row.settings =
      input.settings && typeof input.settings === "object"
        ? input.settings
        : {};
  }
  return row;
}

export async function listForms() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[forms.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeForm);
  } catch (e) {
    console.error("[forms.list]", e);
    return null;
  }
}

export async function getForm(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[forms.get]", error.message);
      return null;
    }
    return normalizeForm(data);
  } catch (e) {
    console.error("[forms.get]", e);
    return null;
  }
}

export async function createForm(input) {
  if (!isSupabaseConfigured()) return null;
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
      console.error("[forms.create]", error.message);
      return null;
    }
    return normalizeForm(data);
  } catch (e) {
    console.error("[forms.create]", e);
    return null;
  }
}

export async function updateForm(id, patch) {
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
      console.error("[forms.update]", error.message);
      return null;
    }
    return normalizeForm(data);
  } catch (e) {
    console.error("[forms.update]", e);
    return null;
  }
}

export async function softDeleteForm(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[forms.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[forms.delete]", e);
    return false;
  }
}
