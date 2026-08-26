"use client";

import React from "react";
import { applyNavVisibility } from "@geiger/ui";

import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { mergeAddonNav } from "@/addons/registry";
import { useAddons } from "@/context/addons-context";
import { useNavVisibility } from "@/context/nav-visibility-context";
import { useRbac } from "@/context/rbac-context";
import { tabPermissionKey } from "@/lib/rbac";

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

export function useNavLoading() {
  const { loading: addonsLoading } = useAddons();
  const { loading: rbacLoading } = useRbac();
  const { loading: visibilityLoading } = useNavVisibility();

  return addonsLoading || rbacLoading || visibilityLoading;
}

export default useVisibleNav;
