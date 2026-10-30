import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for public.mcp_custom_clients: AI apps a user added by hand. Pure: console.error and
// return null / false / [], never throw. DB is snake_case; the UI is camelCase.

const TABLE = "mcp_custom_clients";

function publicClient() {
  return createClient().schema("public");
}

function normalizeClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    redirectUri: row.redirect_uri ?? "",
    createdAt: row.created_at ?? null,
  };
}

export async function listMcpClients(userId) {
  if (!userId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await publicClient()
      .from(TABLE)
      .select("id,name,redirect_uri,created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[mcpClients.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeClient);
  } catch (e) {
    console.error("[mcpClients.list]", e);
    return null;
  }
}

export async function createMcpClient({ id, userId, name, redirectUri }) {
  if (!userId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await publicClient()
      .from(TABLE)
      .insert({ id, user_id: userId, created_by: userId, name, redirect_uri: redirectUri || null })
      .select("id,name,redirect_uri,created_at")
      .single();
    if (error) {
      console.error("[mcpClients.create]", error.message);
      return null;
    }
    return normalizeClient(data);
  } catch (e) {
    console.error("[mcpClients.create]", e);
    return null;
  }
}

export async function softDeleteMcpClient(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const { error } = await publicClient().from(TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("[mcpClients.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mcpClients.delete]", e);
    return false;
  }
}
