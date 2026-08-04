"use client";

import React from "react";
import { applyNavVisibility } from "@geiger/ui";

import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { mergeAddonNav } from "@/addons/registry";
import { useAddons } from "@/context/addons-context";
import { useNavVisibility } from "@/context/nav-visibility-context";
import { roleHasPermission, tabPermissionKey } from "@/lib/rbac";

// The nav the current user can actually reach: core sections with the project's
// enabled addons spliced in, filtered by the active role, then narrowed to what
// the user chose to keep in Settings → Navigation.
//
// Every surface that lists destinations reads it from here — the sidebar and the
// topbar's command palette — so the two can't drift. Passing the raw
// `workspaceNav` to one of them is what let an enabled addon go unsearchable
// while a role-hidden tab stayed reachable through search.
//
// Order matters. Addons are merged *before* the permission filter, so an addon
// is gated on the same code path as core nav and can't route around RBAC by
// contributing nav. Personal visibility comes *last*, so hiding an entry is
// always a narrowing of what the role already allows — never a widening.
//
// Hiding is a curation of the sidebar, not an authorization boundary: a hidden
// screen's URL still resolves (slugs are built from the whole static nav), the
// same way RBAC gating here is advisory. Outside the workspace (public event
// page, portal, landing playground) `useAddons()` and `useNavVisibility()`
// resolve to their stand-ins, so this is safe to call anywhere.

const NO_ROLES = [];

// Everything the user is *allowed* to reach, before their own curation — addons
// merged in, role filter applied. This is what Settings → Navigation lists, so
// hidden entries are still there to switch back on.
export function useCuratableNav({ roleId = "workspace_owner", roles = NO_ROLES } = {}) {
  const { enabledIds, positions } = useAddons();

  return React.useMemo(
    () =>
      mergeAddonNav(workspaceNav, enabledIds, positions).filter((item) =>
        roleHasPermission(roles, roleId, tabPermissionKey(item.title)),
      ),
    [enabledIds, positions, roles, roleId],
  );
}

export function useVisibleNav(options) {
  const curatable = useCuratableNav(options);
  const { hidden, config } = useNavVisibility();

  return React.useMemo(
    () => applyNavVisibility(curatable, hidden, config),
    [curatable, hidden, config],
  );
}

export default useVisibleNav;
