"use client";

import { getUser } from "@/lib/supabase/user";
import { copyFloorPlan, createFloorPlan } from "@/lib/supabase/floor_plans";

// New plan from a template / library diagram (objects keep absolute positions) or a blank room.
export async function createPlanFrom(input, { projectId, kind = "plan" } = {}) {
  const user = await getUser();
  const base = {
    projectId,
    kind,
    name: input.name,
    venueId: input.venueId ?? null,
    venueSpaceId: input.venueSpaceId ?? null,
    eventId: kind === "plan" ? input.eventId ?? null : null,
    widthM: input.widthM,
    lengthM: input.lengthM,
    unit: input.unit,
    setupStyle: input.setupStyle,
    createdBy: user?.id ?? null,
  };
  const source = input.sourcePlan;
  if (!source) {
    return createFloorPlan({
      ...base,
      templateCategory: kind === "template" ? input.templateCategory || "" : "",
      outline: { type: "rect" },
      objects: [],
    });
  }
  const sameRoom =
    Math.abs(source.widthM - input.widthM) < 0.01 && Math.abs(source.lengthM - input.lengthM) < 0.01;
  return copyFloorPlan(source, {
    ...base,
    templateCategory: kind === "template" ? input.templateCategory || source.templateCategory : "",
    outline: sameRoom ? source.outline : { type: "rect" },
  });
}
