"use client";

import { useEffect, useSyncExternalStore } from "react";

import { normalisePlanningRules, validatePlanCapacity } from "@/lib/event_design";
import { getDesignSettings } from "@/lib/supabase/design_settings";

// Project planning rules, loaded once per project and shared by every editor slot and screen (primed again after a save).

const DEFAULT_RULES = normalisePlanningRules(null);
const store = new Map();
const pending = new Set();
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function primePlanningRules(projectId, rules) {
  if (!projectId) return;
  store.set(projectId, { rules: normalisePlanningRules(rules), loaded: true });
  emit();
}

function load(projectId) {
  if (!projectId || store.has(projectId) || pending.has(projectId)) return;
  pending.add(projectId);
  getDesignSettings(projectId).then((settings) => {
    pending.delete(projectId);
    store.set(projectId, { rules: settings?.rules || DEFAULT_RULES, loaded: true, customised: Boolean(settings?.customised) });
    emit();
  });
}

const EMPTY = { rules: DEFAULT_RULES, loaded: false, customised: false };

// → { rules, loaded, customised }; defaults until the project's row arrives (or when it can't be read).
export function usePlanningRules(projectId) {
  const entry = useSyncExternalStore(
    subscribe,
    () => store.get(projectId) || EMPTY,
    () => EMPTY,
  );
  useEffect(() => {
    load(projectId);
  }, [projectId]);
  return entry;
}

// One validation per document edit, shared by the status item, overlay and inspector slots.
const validations = new WeakMap();
export function validateCached(doc, space, rules) {
  if (!doc) return null;
  const hit = validations.get(doc);
  if (hit && hit.space === space && hit.rules === rules) return hit.result;
  const result = validatePlanCapacity(doc, { rules, space });
  validations.set(doc, { space, rules, result });
  return result;
}
