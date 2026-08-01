"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";

// Data access for the per-event program: events.affiliate_programs plus its
// child affiliate_tiers and affiliate_enrolments, and the reusable
// affiliate_program_templates a program is minted from.
//
// Programs are FULLY INDEPENDENT per event — creating one from a template
// copies the ladder and rules; it never links back. Pure: validate,
// console.error on failure, return null/false/[].

const PROGRAMS = "affiliate_programs";
const TIERS = "affiliate_tiers";
const ENROLMENTS = "affiliate_enrolments";
const TEMPLATES = "affiliate_program_templates";

// --- Programs ----------------------------------------------------------------

export function normalizeProgram(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    name: row.name ?? "Affiliate program",
    status: row.status ?? "draft",
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    stopAtEventStart: Boolean(row.stop_at_event_start),
    attributionWindowDays: Number(row.attribution_window_days ?? 30),
    commissionBase: row.commission_base ?? "tickets",
    discountHandling: row.discount_handling ?? "post",
    budgetCap: row.budget_cap === null ? null : Number(row.budget_cap),
    affiliateCap: row.affiliate_cap === null ? null : Number(row.affiliate_cap),
    rules: row.rules && typeof row.rules === "object" ? row.rules : {},
    autoTiers: Boolean(row.auto_tiers),
    autoTierWindowDays: Number(row.auto_tier_window_days ?? 90),
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

function programToRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    eventId: "event_id",
    name: "name",
    status: "status",
    commissionBase: "commission_base",
    discountHandling: "discount_handling",
    rules: "rules",
    metadata: "metadata",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("startsAt" in input) row.starts_at = input.startsAt || null;
  if ("endsAt" in input) row.ends_at = input.endsAt || null;
  if ("stopAtEventStart" in input) {
    row.stop_at_event_start = Boolean(input.stopAtEventStart);
  }
  if ("attributionWindowDays" in input) {
    row.attribution_window_days = Number(input.attributionWindowDays) || 30;
  }
  if ("autoTiers" in input) row.auto_tiers = Boolean(input.autoTiers);
  if ("autoTierWindowDays" in input) {
    row.auto_tier_window_days = Number(input.autoTierWindowDays) || 90;
  }
  // An empty cap means "uncapped", which is null — not zero.
  if ("budgetCap" in input) {
    row.budget_cap =
      input.budgetCap === "" || input.budgetCap === null
        ? null
        : Number(input.budgetCap);
  }
  if ("affiliateCap" in input) {
    row.affiliate_cap =
      input.affiliateCap === "" || input.affiliateCap === null
        ? null
        : Number(input.affiliateCap);
  }
  return row;
}

export async function listPrograms(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PROGRAMS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[affiliates.programs.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeProgram);
  } catch (e) {
    console.error("[affiliates.programs.list]", e);
    return null;
  }
}

export async function createProgram(projectId, input) {
  if (!projectId || !input?.eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const user = await getUser();
    const payload = {
      ...programToRow({ ...input, projectId }),
      created_by: user?.id ?? null,
    };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(PROGRAMS)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.programs.create]", error.message);
      return null;
    }
    return normalizeProgram(data);
  } catch (e) {
    console.error("[affiliates.programs.create]", e);
    return null;
  }
}

export async function updateProgram(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PROGRAMS)
      .update(programToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.programs.update]", error.message);
      return null;
    }
    return normalizeProgram(data);
  } catch (e) {
    console.error("[affiliates.programs.update]", e);
    return null;
  }
}

export async function softDeleteProgram(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(PROGRAMS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[affiliates.programs.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.programs.delete]", e);
    return false;
  }
}

// --- Tiers -------------------------------------------------------------------

export function normalizeTier(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.program_id ?? null,
    name: row.name ?? "Tier",
    rank: Number(row.rank ?? 0),
    thresholdSales: Number(row.threshold_sales ?? 0),
    thresholdRevenue: Number(row.threshold_revenue ?? 0),
    rateModel: row.rate_model ?? "percent",
    rateValue: Number(row.rate_value ?? 0),
    ticketTypeRates:
      row.ticket_type_rates && typeof row.ticket_type_rates === "object"
        ? row.ticket_type_rates
        : {},
  };
}

function tierToRow(input) {
  const row = {};
  if ("programId" in input) row.program_id = input.programId;
  if ("name" in input) row.name = input.name;
  if ("rank" in input) row.rank = Number(input.rank) || 0;
  if ("thresholdSales" in input) row.threshold_sales = Number(input.thresholdSales) || 0;
  if ("thresholdRevenue" in input) {
    row.threshold_revenue = Number(input.thresholdRevenue) || 0;
  }
  if ("rateModel" in input) row.rate_model = input.rateModel;
  if ("rateValue" in input) row.rate_value = Number(input.rateValue) || 0;
  if ("ticketTypeRates" in input) {
    row.ticket_type_rates =
      input.ticketTypeRates && typeof input.ticketTypeRates === "object"
        ? input.ticketTypeRates
        : {};
  }
  return row;
}

export async function listTiers(programId) {
  if (!programId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TIERS)
      .select("*")
      .eq("program_id", programId)
      .is("deleted_at", null)
      .order("rank", { ascending: true });
    if (error) {
      console.error("[affiliates.tiers.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeTier);
  } catch (e) {
    console.error("[affiliates.tiers.list]", e);
    return null;
  }
}

export async function createTier(programId, input) {
  if (!programId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = tierToRow({ ...input, programId });
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(TIERS).insert(payload).select("*").single();
    if (error) {
      console.error("[affiliates.tiers.create]", error.message);
      return null;
    }
    return normalizeTier(data);
  } catch (e) {
    console.error("[affiliates.tiers.create]", e);
    return null;
  }
}

export async function updateTier(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TIERS)
      .update(tierToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.tiers.update]", error.message);
      return null;
    }
    return normalizeTier(data);
  } catch (e) {
    console.error("[affiliates.tiers.update]", e);
    return null;
  }
}

export async function softDeleteTier(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TIERS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[affiliates.tiers.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.tiers.delete]", e);
    return false;
  }
}

// --- Enrolments --------------------------------------------------------------

export function normalizeEnrolment(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.program_id ?? null,
    affiliateId: row.affiliate_id ?? null,
    tierId: row.tier_id ?? null,
    tierLocked: Boolean(row.tier_locked),
    rateModel: row.rate_model ?? null,
    rateValue: row.rate_value === null ? null : Number(row.rate_value),
    refSlug: row.ref_slug ?? "",
    code: row.code ?? "",
    discountRecordId: row.discount_record_id ?? null,
    status: row.status ?? "active",
    cap: row.cap === null ? null : Number(row.cap),
    // Present when the caller joined the affiliate row (see listEnrolments).
    affiliate: row.affiliates ? normalizeJoinedAffiliate(row.affiliates) : null,
  };
}

function normalizeJoinedAffiliate(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    status: row.status ?? "invited",
  };
}

function enrolmentToRow(input) {
  const row = {};
  const map = {
    programId: "program_id",
    affiliateId: "affiliate_id",
    tierId: "tier_id",
    refSlug: "ref_slug",
    code: "code",
    discountRecordId: "discount_record_id",
    status: "status",
    metadata: "metadata",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("tierLocked" in input) row.tier_locked = Boolean(input.tierLocked);
  if ("rateModel" in input) row.rate_model = input.rateModel || null;
  if ("rateValue" in input) {
    row.rate_value =
      input.rateValue === "" || input.rateValue === null
        ? null
        : Number(input.rateValue);
  }
  if ("cap" in input) {
    row.cap = input.cap === "" || input.cap === null ? null : Number(input.cap);
  }
  if ("code" in input) row.code = input.code ? String(input.code).trim() : null;
  return row;
}

// Enrolments for one program, with the affiliate person joined so the program
// editor can render a roster without a second round trip.
export async function listEnrolments(programId) {
  if (!programId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ENROLMENTS)
      .select("*, affiliates(id, name, email, status)")
      .eq("program_id", programId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[affiliates.enrolments.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeEnrolment);
  } catch (e) {
    console.error("[affiliates.enrolments.list]", e);
    return null;
  }
}

// Every program one affiliate is in — powers their portal "My programs" view.
export async function listEnrolmentsForAffiliate(affiliateId) {
  if (!affiliateId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ENROLMENTS)
      .select("*")
      .eq("affiliate_id", affiliateId)
      .is("deleted_at", null);
    if (error) {
      console.error("[affiliates.enrolments.forAffiliate]", error.message);
      return null;
    }
    return (data || []).map(normalizeEnrolment);
  } catch (e) {
    console.error("[affiliates.enrolments.forAffiliate]", e);
    return null;
  }
}

export async function createEnrolment(programId, input) {
  if (!programId || !input?.affiliateId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = enrolmentToRow({ ...input, programId });
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(ENROLMENTS)
      .insert(payload)
      .select("*, affiliates(id, name, email, status)")
      .single();
    if (error) {
      console.error("[affiliates.enrolments.create]", error.message);
      return null;
    }
    return normalizeEnrolment(data);
  } catch (e) {
    console.error("[affiliates.enrolments.create]", e);
    return null;
  }
}

export async function updateEnrolment(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ENROLMENTS)
      .update(enrolmentToRow(patch))
      .eq("id", id)
      .select("*, affiliates(id, name, email, status)")
      .single();
    if (error) {
      console.error("[affiliates.enrolments.update]", error.message);
      return null;
    }
    return normalizeEnrolment(data);
  } catch (e) {
    console.error("[affiliates.enrolments.update]", e);
    return null;
  }
}

export async function softDeleteEnrolment(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ENROLMENTS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[affiliates.enrolments.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.enrolments.delete]", e);
    return false;
  }
}

// --- Templates ---------------------------------------------------------------

export function normalizeTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Untitled template",
    description: row.description ?? "",
    rules: row.rules && typeof row.rules === "object" ? row.rules : {},
    tiers: Array.isArray(row.tiers) ? row.tiers : [],
    createdAt: row.created_at ?? null,
  };
}

export async function listTemplates(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TEMPLATES)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[affiliates.templates.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeTemplate);
  } catch (e) {
    console.error("[affiliates.templates.list]", e);
    return null;
  }
}

export async function createTemplate(projectId, input) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const user = await getUser();
    const payload = {
      project_id: projectId,
      name: input.name || "Untitled template",
      description: input.description || "",
      rules: input.rules || {},
      tiers: Array.isArray(input.tiers) ? input.tiers : [],
      created_by: user?.id ?? null,
    };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TEMPLATES)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.templates.create]", error.message);
      return null;
    }
    return normalizeTemplate(data);
  } catch (e) {
    console.error("[affiliates.templates.create]", e);
    return null;
  }
}

export async function updateTemplate(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const row = {};
    if ("name" in patch) row.name = patch.name;
    if ("description" in patch) row.description = patch.description;
    if ("rules" in patch) row.rules = patch.rules || {};
    if ("tiers" in patch) row.tiers = Array.isArray(patch.tiers) ? patch.tiers : [];
    const { data, error } = await sb
      .from(TEMPLATES)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.templates.update]", error.message);
      return null;
    }
    return normalizeTemplate(data);
  } catch (e) {
    console.error("[affiliates.templates.update]", e);
    return null;
  }
}

export async function softDeleteTemplate(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TEMPLATES)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[affiliates.templates.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.templates.delete]", e);
    return false;
  }
}

// Mint a program for an event from a template. COPY-ON-CREATE: the tiers and
// rules are duplicated onto the new program, which then evolves independently —
// editing the template later never touches a program built from it.
export async function createProgramFromTemplate(projectId, eventId, template, overrides = {}) {
  const program = await createProgram(projectId, {
    eventId,
    name: overrides.name || template?.name || "Affiliate program",
    status: "draft",
    rules: template?.rules || {},
    ...overrides,
  });
  if (!program) return null;

  const tiers = Array.isArray(template?.tiers) ? template.tiers : [];
  for (const [index, tier] of tiers.entries()) {
    // Sequential on purpose: a partial ladder is easier to reason about than a
    // racing batch, and a template has a handful of tiers at most.
    await createTier(program.id, { ...tier, rank: tier.rank ?? index });
  }
  return program;
}
