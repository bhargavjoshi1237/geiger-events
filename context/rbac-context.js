"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { can as rbacCan, evaluate as rbacEvaluate, resolveGrants } from "@geiger/rbac";

import rbacConfig from "@/geiger-rbac.config";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listRoles, listUserGrants } from "@/lib/supabase/rbac";

// What the signed-in user may do in the active project.
//
// This is the piece that was missing: the roles matrix has been editable for a
// while, but nothing ever resolved the current user's grants, so every check in
// the app returned true. The provider loads (roles, my grants) once per
// (project, user), flattens them with @geiger/rbac, and exposes an explainable
// decision to every surface.
//
// THE TRANSITION CONTRACT. `available` is false when the user holds no grants
// in this project — either the backfill hasn't reached them or the DB isn't
// configured. In that state can() returns true, exactly matching the old
// roleHasPermission() behaviour, so adopting the package cannot lock anyone out
// of a screen they could reach yesterday. Real denial arrives with the RLS
// policies, which are per-table migrations, not this provider. Once every
// member holds a grant, flip FALLBACK_ALLOW to false and the UI becomes strict.
//
// Outside the workspace (public event page, members portal, landing playground)
// there is no provider, so useRbac() returns a permissive stand-in rather than
// throwing — shared components render anywhere.

const FALLBACK_ALLOW = true;

// Sentinel for "nothing loaded yet". Loading is derived from which project the
// current rows belong to rather than held in its own flag — a setLoading(true)
// in the effect body would cascade renders on every project switch.
const UNLOADED = Symbol("rbac:unloaded");

const RbacContext = createContext(null);

const PERMISSIVE = Object.freeze({
  roles: Object.freeze([]),
  grants: Object.freeze([]),
  resolved: null,
  loading: false,
  available: false,
  userId: null,
  isOwner: false,
  can: () => FALLBACK_ALLOW,
  decide: () => ({
    allowed: FALLBACK_ALLOW,
    code: "no_provider",
    reason: "Authorization is not loaded on this surface.",
    via: null,
  }),
  refresh: async () => {},
});

export function RbacProvider({ children }) {
  const project = useOptionalProject();
  const projectId = project?.projectId || null;

  const [userId, setUserId] = useState(null);
  const [roles, setRoles] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loadedFor, setLoadedFor] = useState(UNLOADED);

  const load = useCallback(async () => {
    const user = await getUser();
    const uid = user?.id ?? null;
    if (!projectId || !uid) {
      return { uid, roleRows: [], grantRows: [] };
    }
    const [roleRows, grantRows] = await Promise.all([
      listRoles(projectId),
      listUserGrants(projectId, uid),
    ]);
    return { uid, roleRows: roleRows ?? [], grantRows: grantRows ?? [] };
  }, [projectId]);

  // Every setState happens in the async continuation — a synchronous setState in
  // an effect body cascades renders (same rule as nav-visibility-context).
  useEffect(() => {
    let alive = true;
    load().then(({ uid, roleRows, grantRows }) => {
      if (!alive) return;
      setUserId(uid);
      setRoles(roleRows);
      setGrants(grantRows);
      setLoadedFor(projectId);
    });
    return () => {
      alive = false;
    };
  }, [load, projectId]);

  const refresh = useCallback(async () => {
    const { uid, roleRows, grantRows } = await load();
    setUserId(uid);
    setRoles(roleRows);
    setGrants(grantRows);
    setLoadedFor(projectId);
  }, [load, projectId]);

  // While a project switch is in flight the rows still describe the previous
  // project, so nothing is enforced until they catch up.
  const loading = loadedFor !== projectId;

  // Flatten once per (roles, grants) rather than on every check — a screen
  // gating a dozen controls would otherwise re-expand every wildcard twelve
  // times per render.
  const resolved = useMemo(
    () => resolveGrants({ config: rbacConfig, roles, grants }),
    [roles, grants],
  );

  // Enforce only once this project's own grants are in hand. Gating on stale or
  // half-loaded rows would flash an empty sidebar on every project switch.
  const available = !loading && grants.length > 0;

  const value = useMemo(() => {
    const options = { config: rbacConfig, roles, grants, actorId: userId, resolved };

    const decide = (key, extra = {}) => {
      if (!available) {
        return {
          allowed: FALLBACK_ALLOW,
          code: "no_grants",
          reason:
            "You hold no roles in this workspace yet, so permissions aren't being enforced in the UI.",
          via: null,
        };
      }
      return rbacEvaluate(key, { ...options, ...extra });
    };

    return {
      roles,
      grants,
      resolved,
      loading,
      available,
      userId,
      // The wildcard is what Owner holds; useful for "you can't remove the last
      // owner" style guards in the Team screen.
      isOwner: roles.some(
        (r) =>
          grants.some((g) => g.roleId === r.id) &&
          (r.permissions || []).includes("*"),
      ),
      can: (key, extra) =>
        available ? rbacCan(key, { ...options, ...extra }) : FALLBACK_ALLOW,
      decide,
      refresh,
    };
  }, [roles, grants, resolved, loading, available, userId, refresh]);

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

// Safe anywhere: returns a permissive stand-in outside the workspace.
export function useRbac() {
  return useContext(RbacContext) ?? PERMISSIVE;
}

// Convenience for a single gate.
export function useCan(key, extra) {
  const { can } = useRbac();
  return can(key, extra);
}
