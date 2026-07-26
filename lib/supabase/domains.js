// Data layer for org domains (public.org_domains) and plan entitlements
// (public.organizations.metadata.subscription). Reads across the `public` schema
// (the events client is pinned to the `events` schema).
//
// The org chain: project (from URL) → organization_id → public.organizations →
// metadata.subscription (what the org purchased) + public.org_domains (subdomain).
//
// DB is snake_case; callers get camelCase view models.
// Guarded tristate return: null (no-DB/failure), [] (empty), object/true (data).

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "./events";

// Helper: a public-schema client (mirrors the one in project-context.js).
function publicClient() {
  return createClient().schema("public");
}

// ─── Product catalog (subset — only the add-ons we care about) ───────────────
// Mirrors geiger-dash lib/pricing/plans.js. Only the subdomain product matters
// here; the rest are listed for completeness.

const ALL_PRODUCT_IDS = [
  "campaign", "flow", "events", "assets", "comms", "forms", "grey",
  "office", "docs", "content", "pods", "chat", "notes", "canvas",
  "property", "oauth", "subdomain", "domain", "emailTemplate",
];

// ─── Normalize / helpers ─────────────────────────────────────────────────────

export function normalizeOrgDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    subdomain: row.subdomain ?? "",
    type: row.type ?? "subdomain",
    status: row.status ?? "active",
    verified: Boolean(row.verified),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Derive entitlements from an organization's metadata.subscription.
 * Mirrors geiger-dash lib/billing/entitlements.js — returns what products
 * the org has purchased (unlockedProducts), or null for unrestricted.
 */
export function getOrgEntitlements(organization) {
  const meta =
    organization?.metadata && typeof organization.metadata === "object"
      ? organization.metadata
      : {};
  const sub =
    meta.subscription && typeof meta.subscription === "object"
      ? meta.subscription
      : null;

  // No subscription → no products unlocked (except unrestricted/grandfathered).
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
    return {
      hasSubscription: false,
      planKey: null,
      unlockedProducts: [],
      limits: { projects: 0, seats: 0 },
    };
  }

  if (sub.currentPeriodEnd && Date.now() >= new Date(sub.currentPeriodEnd).getTime()) {
    return {
      hasSubscription: false,
      planKey: null,
      unlockedProducts: [],
      limits: { projects: 0, seats: 0 },
    };
  }

  const unlockedProducts = Array.isArray(sub.products)
    ? sub.products.filter((id) => ALL_PRODUCT_IDS.includes(id))
    : [];

  return {
    hasSubscription: true,
    planKey: sub.planKey ?? null,
    unlockedProducts,
    limits: {
      projects: sub.metrics?.projects ?? 1,
      seats: sub.metrics?.seats ?? 5,
    },
  };
}

/** true when the org's entitlements include a given product id. */
export function isProductUnlocked(entitlements, productId) {
  if (!entitlements) return false;
  return entitlements.unlockedProducts.includes(productId);
}

// ─── Data access ─────────────────────────────────────────────────────────────

/**
 * Load the organization that owns the given project, with its metadata.
 * Returns null on no-DB / failure, or the org row (camelCase with metadata).
 */
export async function getOrgByProject(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = publicClient();
    // Get the project to find its organization_id.
    const { data: project, error: projErr } = await sb
      .from("projects")
      .select("organization_id")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (projErr) {
      console.error("[domains.getOrgByProject]", projErr.message);
      return null;
    }
    if (!project?.organization_id) return null;

    // Read the org.
    const { data: org, error: orgErr } = await sb
      .from("organizations")
      .select("id, name, slug, owner, created_by, metadata")
      .eq("id", project.organization_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (orgErr) {
      console.error("[domains.getOrgByProject]", orgErr.message);
      return null;
    }
    if (!org) return null;

    return {
      id: org.id,
      name: org.name ?? "",
      slug: org.slug ?? "",
      owner: org.owner ?? null,
      createdBy: org.created_by ?? null,
      metadata: org.metadata ?? {},
    };
  } catch (e) {
    console.error("[domains.getOrgByProject]", e);
    return null;
  }
}

/**
 * Fetch the org's active subdomain row (or null).
 * Returns null on no-DB / failure, or the normalized domain object.
 */
export async function getOrgDomain(organizationId) {
  if (!isSupabaseConfigured() || !organizationId) return null;
  try {
    const sb = publicClient();
    const { data, error } = await sb
      .from("org_domains")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "subdomain")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      // RLS may deny non-owners — that's expected, not a crash.
      if (error.code === "PGRST116") return null;
      console.error("[domains.getOrgDomain]", error.message);
      return null;
    }
    return normalizeOrgDomain(data);
  } catch (e) {
    console.error("[domains.getOrgDomain]", e);
    return null;
  }
}
