// Org and project reads for the desktop org picker; membership and plan rules mirror geiger-dash.
import { LAST_ORG_KEY } from "./config";

const ORG_FIELDS = "id, name, avatar_url, created_at, metadata";
const EVENTS_PRODUCT = "events";
// Written by the Events workspace (context/project-context.js) whenever a project is opened.
const LAST_PROJECT_KEY = "geiger-events:last-project";
// Plan JSON keys that can name a product, as in dash's collectProductIds.
const PRODUCT_KEYS = ["id", "slug", "product", "name", "products", "selectedProducts", "selected_products", "apps", "modules"];

function toTime(value) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function firstOf(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeProductId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^geiger[-_\s]*/, "")
    .replace(/[^a-z0-9_-]/g, "");
}

function includesEvents(value) {
  if (!value) return false;
  if (typeof value === "string") return normalizeProductId(value) === EVENTS_PRODUCT;
  if (Array.isArray(value)) return value.some(includesEvents);
  if (typeof value === "object") return PRODUCT_KEYS.some((key) => includesEvents(value[key]));
  return false;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// `.schema("public")` keeps these reads right even if a caller passes the events-schema client.
export async function listOrganizations(supabase, userId) {
  const db = supabase.schema("public");
  // A fresh builder per query: postgrest builders share their URL, so one can't be reused.
  const orgs = () => db.from("organizations").select(ORG_FIELDS);
  const results = await Promise.all([
    orgs().eq("created_by", userId),
    orgs().eq("owner", userId),
    orgs().contains("metadata", { members: [userId] }),
  ]);

  const byId = new Map();
  for (const { data } of results) {
    for (const org of data || []) byId.set(String(org.id), org);
  }
  const organizations = [...byId.values()].sort((a, b) => toTime(b.created_at) - toTime(a.created_at));
  const error = results.find((result) => result.error)?.error.message || "";
  return { organizations, error };
}

export async function listEventsProjects(supabase, organizationId) {
  const { data, error } = await supabase
    .schema("public")
    .from("organization_project")
    .select("created_at, projects(id, name, avatar_url, deleted_at), plan(plan)")
    .eq("organisition", organizationId)
    .order("created_at", { ascending: false });
  if (error) return { projects: [], error: error.message };

  // A project can sit on several plan rows; keep it once if any of them includes Events.
  const byId = new Map();
  for (const row of data || []) {
    const project = firstOf(row.projects);
    if (!project || project.deleted_at || byId.has(project.id)) continue;
    if (!includesEvents(firstOf(row.plan)?.plan)) continue;
    byId.set(project.id, {
      id: project.id,
      name: project.name || "Untitled project",
      avatarUrl: project.avatar_url || null,
      createdAt: row.created_at,
    });
  }
  return { projects: [...byId.values()], error: "" };
}

// The project the workspace last opened when it's in this org, else the newest.
export function pickLaunchProject(projects) {
  if (!projects?.length) return null;
  const remembered = readStorage(LAST_PROJECT_KEY);
  return projects.find((project) => project.id === remembered) || projects[0];
}

export function rememberOrg(orgId) {
  try {
    window.localStorage.setItem(LAST_ORG_KEY, String(orgId));
  } catch {
    // Storage can be blocked; the picker just loses its "Last opened" hint.
  }
}

export function readLastOrg() {
  return readStorage(LAST_ORG_KEY);
}
