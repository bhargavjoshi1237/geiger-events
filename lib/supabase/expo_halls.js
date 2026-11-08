"use client";

import { getUser } from "./user";
import { getHallMap, listHallMaps, updateBooth, updateHallMap } from "./hall_maps";
import { createFloorPlan, getFloorPlan, listFloorPlans, saveFloorPlan, softDeleteFloorPlan } from "./floor_plans";
import { normaliseBoothFields, planFromHallBooths } from "@/lib/event_design";

// Expo halls = an expo floor plan (the design, drawn in the Event Design editor) paired with its hall map (the ids
// events sell booths against). Halls from before the editor are map-only until first opened. Never throws.

// Every live hall in the project: { id, plan, map } — plan null for a legacy hall that hasn't been converted yet.
export async function listExpoHalls(projectId) {
  if (!projectId) return null;
  const [plans, maps] = await Promise.all([
    listFloorPlans(projectId, { kind: "expo" }),
    listHallMaps(null, { projectId }),
  ]);
  if (plans === null || maps === null) return null;
  const mapById = new Map(maps.map((m) => [m.id, m]));
  const linked = new Set(plans.map((p) => p.hallMapId).filter(Boolean));
  const halls = plans.map((plan) => ({ id: plan.id, plan, map: mapById.get(plan.hallMapId) || null }));
  for (const map of maps) {
    if (!linked.has(map.id) && map.status !== "Archived") halls.push({ id: map.id, plan: null, map });
  }
  return halls;
}

// A legacy (percent-only) hall → its expo plan, keeping every booth id so assignments carry over.
// Booths the old board left unplaced (0,0) are lined up along the top edge instead of piling in the corner.
export async function convertLegacyHall(map, { projectId }) {
  if (!map?.id || !projectId) return null;
  const [full, user] = await Promise.all([getHallMap(map.id), getUser()]);
  if (!full) return null;
  let parked = 0;
  const booths = full.booths.map((b) => {
    if (b.metadata?.placed !== false) return b;
    const i = parked++;
    return { ...b, x: 2 + (i % 10) * 9.6, y: 2 + Math.floor(i / 10) * 8, width: 8, height: 6, rotation: 0 };
  });
  return createFloorPlan({
    projectId,
    kind: "expo",
    hallMapId: map.id,
    venueId: map.venueId,
    name: map.name || "Exhibitor hall",
    status: "draft",
    notes: "",
    metadata: {},
    createdBy: user?.id ?? null,
    ...planFromHallBooths(booths, full.map.aspect),
  });
}

// Takes a hall out of use: the plan is deleted and the map archived (never deleted — sold booths hang off it).
export async function archiveExpoHall(hall) {
  const results = await Promise.all([
    hall?.plan ? softDeleteFloorPlan(hall.plan.id) : true,
    hall?.map ? updateHallMap(hall.map.id, { status: "Archived" }) : true,
  ]);
  return results.every(Boolean);
}

// Edits one booth's number / sale fields. On a designed hall this goes through the plan (its source of truth) and
// re-syncs; on a legacy hall it writes the row. → the saved plan or booth, "conflict", or null.
export async function updateExpoBooth({ plan, booth }, { label, sizeClass, price, zone }) {
  if (plan) {
    const fresh = await getFloorPlan(plan.id);
    if (!fresh || !fresh.objects.some((o) => o.id === booth.id)) return null;
    const objects = fresh.objects.map((o) =>
      o.id === booth.id
        ? { ...o, label: String(label ?? o.label).trim(), booth: normaliseBoothFields({ ...o.booth, sizeClass, price, zone }) }
        : o,
    );
    return saveFloorPlan(fresh.id, { ...fresh, objects }, fresh.version);
  }
  const fields = normaliseBoothFields({ sizeClass, price, zone });
  return updateBooth(booth.id, {
    code: String(label ?? booth.code).trim(),
    name: String(label ?? booth.code).trim(),
    sizeClass: fields.sizeClass,
    price: fields.price,
    hall: fields.zone,
  });
}
