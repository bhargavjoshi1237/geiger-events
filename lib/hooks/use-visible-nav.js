"use client";

import React from "react";

import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { mergeAddonNav } from "@/addons/registry";
import { useAddons } from "@/context/addons-context";
import { roleHasPermission, tabPermissionKey } from "@/lib/rbac";

// The nav the current user can actually reach: core sections with the project's
// enabled addons spliced in, then filtered by the active role.
//
// Every surface that lists destinations reads it from here — the sidebar and the
// topbar's command palette — so the two can't drift. Passing the raw
// `workspaceNav` to one of them is what let an enabled addon go unsearchable
// while a role-hidden tab stayed reachable through search.
//
// Addons are merged *before* the permission filter, so an addon is gated on the
// same code path as core nav and can't route around RBAC by contributing nav.
// Outside the workspace (public event page, portal, landing playground)
// `useAddons()` resolves to the everything-off stand-in, so this is safe to call
// anywhere.

const NO_ROLES = [];

export function useVisibleNav({ roleId = "workspace_owner", roles = NO_ROLES } = {}) {
  const { enabledIds, positions } = useAddons();

  return React.useMemo(
    () =>
      mergeAddonNav(workspaceNav, enabledIds, positions).filter((item) =>
        roleHasPermission(roles, roleId, tabPermissionKey(item.title)),
      ),
    [enabledIds, positions, roles, roleId],
  );
}

export default useVisibleNav;
