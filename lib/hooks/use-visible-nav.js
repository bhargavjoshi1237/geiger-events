"use client";

import React from "react";
import { applyNavVisibility } from "@geiger/ui";

import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { mergeAddonNav } from "@/addons/registry";
import { useAddons } from "@/context/addons-context";
import { useNavVisibility } from "@/context/nav-visibility-context";
import { useRbac } from "@/context/rbac-context";
import { tabPermissionKey } from "@/lib/rbac";

// The nav the current user can actually reach: core sections with the project's
// enabled addons spliced in, filtered by what the user is granted, then narrowed
// to what they chose to keep in Settings → Navigation.
//
// Every surface that lists destinations reads it from here — the sidebar and the
// topbar's command palette — so the two can't drift. Passing the raw
// `workspaceNav` to one of them is what let an enabled addon go unsearchable
// while a role-hidden tab stayed reachable through search.
//
// Order matters. Addons are merged *before* the permission filter, so an addon
// is gated on the same code path as core nav and can't route around RBAC by
// contributing nav. Personal visibility comes *last*, so hiding an entry is
// always a narrowing of what the grant already allows — never a widening.
//
// The gate reads @geiger/rbac through useRbac(), which resolves the signed-in
// user's grants for the active project. Nav uses the coarse question ("could you
// ever reach this?") rather than a scoped one — a section is about capability,
// not about one particular event. Hiding is still curation, not an authorization
// boundary: a hidden screen's URL resolves, the same way this filter is
// advisory until the per-table RLS policies land.

export function useCuratableNav() {
  const { enabledIds, positions } = useAddons();
  const { can } = useRbac();

  return React.useMemo(
    () =>
      mergeAddonNav(workspaceNav, enabledIds, positions).filter((item) =>
        can(tabPermissionKey(item.title)),
      ),
    [enabledIds, positions, can],
  );
}

export function useVisibleNav() {
  const curatable = useCuratableNav();
  const { hidden, config } = useNavVisibility();

  return React.useMemo(
    () => applyNavVisibility(curatable, hidden, config),
    [curatable, hidden, config],
  );
}

// True until the list above can be trusted. Every one of its three inputs — the
// project's addons, this user's grants, their own curation — needs a round trip,
// and the page is server-rendered, so the browser paints the markup before any
// of them can even be asked for. Rendering the nav in that window shows entries
// that disappear a moment later; surfaces should render a placeholder instead.
//
// Outside the workspace the stand-in contexts report loaded, so shared
// components that read this render immediately.
export function useNavLoading() {
  const { loading: addonsLoading } = useAddons();
  const { loading: rbacLoading } = useRbac();
  const { loading: visibilityLoading } = useNavVisibility();

  return addonsLoading || rbacLoading || visibilityLoading;
}

export default useVisibleNav;
