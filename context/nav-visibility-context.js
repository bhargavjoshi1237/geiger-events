"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { canToggleNavItem, defaultHiddenNav, sanitizeHidden } from "@geiger/ui";

import navConfig from "@/geiger-ui.config";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { useOptionalProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getNavPrefs, saveNavPrefs } from "@/lib/supabase/nav_prefs";
import { getUser } from "@/lib/supabase/user";
import {
  sameStringList,
  usePaintFromShellCache,
  writeShellCache,
} from "@/lib/workspace/shell_cache";

// Which sidebar entries the signed-in user has hidden, for the active project.
//
// Sidebar curation is a personal preference, so this is keyed by (project, user)
// in public.user_nav_prefs — unlike addon enablement, which is shared by the
// whole project. The rules about what may be hidden live in geiger-ui.config.js
// and are enforced by @geiger/ui; this context only loads, checks and persists.
//
// The hidden list is read back from a local cache before the first paint and the
// database read only revalidates it, so a reload paints the sidebar the user
// curated instead of flashing the full nav for a round trip. A failed read is
// not an answer — it leaves the painted list alone rather than un-hiding
// everything.
//
// Writes are optimistic: local state updates immediately, then persists; a falsy
// return rolls the change back and the caller toasts.

const CACHE = "nav-hidden";

const NavVisibilityContext = createContext(null);

// Everything-visible stand-in for trees with no provider (public event pages,
// the members portal, the landing playground), so useVisibleNav() — and any
// shared component that reads it — is safe to call anywhere.
const ALL_VISIBLE = Object.freeze({
  hidden: Object.freeze([]),
  loading: false,
  available: false,
  config: navConfig,
  setHidden: async () => ({ ok: false, reason: "" }),
  showAll: async () => false,
});

export function NavVisibilityProvider({ children }) {
  const project = useOptionalProject();
  // The route carries the project id synchronously; the project record itself is
  // a fetch away. Reading it from the URL is what lets the cached list paint on
  // the first frame instead of one round trip later.
  const { projectId: routeProjectId } = useWorkspaceUrl();
  const projectId = routeProjectId || project?.projectId || null;

  const [hidden, setHiddenState] = useState(() => defaultHiddenNav(navConfig));
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Paint the last known list before the browser paints, so the sidebar never
  // flashes an entry this user has hidden.
  usePaintFromShellCache(CACHE, projectId, (entry) => {
    setHiddenState(sanitizeHidden(entry.value, workspaceNav, navConfig));
    setLoading(false);
  });

  // Revalidate against the database — once per mount, not once per navigation:
  // the provider lives in the project layout, so a tab change no longer remounts
  // it. Every setState happens in the async continuation; a synchronous setState
  // in an effect body cascades renders.
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getUser();
      const prefs = projectId ? await getNavPrefs(projectId, user?.id ?? null) : null;
      if (!alive) return;
      setUserId(user?.id ?? null);
      setLoading(false);
      // null is "unconfigured or the read failed", never "nothing is hidden" —
      // keep whatever is already on screen instead of un-hiding the lot.
      if (!prefs) return;
      // A stored list can outlive a renamed screen or a newly locked entry, so
      // never trust it straight from the database.
      const next = sanitizeHidden(prefs.hidden, workspaceNav, navConfig);
      setHiddenState((prev) => (sameStringList(prev, next) ? prev : next));
      writeShellCache(CACHE, projectId, user?.id ?? null, next);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const persist = useCallback(
    async (next, previous) => {
      setHiddenState(next);
      if (!projectId) return true;
      const ok = await saveNavPrefs(projectId, userId, next);
      if (!ok) {
        setHiddenState(previous);
        return false;
      }
      // Cache the saved list, not the optimistic one, so a reload can only ever
      // paint something the database agreed to.
      writeShellCache(CACHE, projectId, userId, next);
      return true;
    },
    [projectId, userId],
  );

  // Flip one entry. Refuses — with the reason to show the user — when the change
  // would leave a visible screen without something it needs.
  const setHidden = useCallback(
    async (title, nextHidden) => {
      const check = canToggleNavItem(title, {
        nav: workspaceNav,
        hidden,
        config: navConfig,
        nextHidden,
      });
      if (!check.allowed) return { ok: false, reason: check.reason };

      const next = nextHidden
        ? hidden.concat(title)
        : hidden.filter((t) => t !== title);
      const ok = await persist(next, hidden);
      return { ok, reason: ok ? "" : "Couldn't save your navigation settings." };
    },
    [hidden, persist],
  );

  // Showing everything can never violate the invariant, so it needs no checks.
  const showAll = useCallback(
    () => (hidden.length === 0 ? Promise.resolve(true) : persist([], hidden)),
    [hidden, persist],
  );

  const value = useMemo(
    () => ({
      hidden,
      loading,
      available: true,
      config: navConfig,
      setHidden,
      showAll,
    }),
    [hidden, loading, setHidden, showAll],
  );

  return (
    <NavVisibilityContext.Provider value={value}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  return useContext(NavVisibilityContext) ?? ALL_VISIBLE;
}
