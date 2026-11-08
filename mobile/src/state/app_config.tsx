import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import type { AppConfig, AppSection } from "@/types/portal";

// Until the server answers (or when it can't), the app shows everything — the behaviour before configs existed.
export const DEFAULT_APP_CONFIG: AppConfig = {
  sections: {
    memberships: true,
    live: true,
    watch: true,
    orders: true,
    community: true,
    qa: true,
    messages: true,
    notifications: true,
    agenda: true,
    speakers: true,
    sponsors: true,
    map: true,
    networking: true,
    discussions: true,
  },
  home: {
    welcome: "",
    liveStrip: true,
    recentOrders: true,
    shortcuts: ["community", "watch", "memberships"],
  },
};

type AppConfigState = AppConfig & {
  isOn: (section: AppSection) => boolean;
  refreshAppConfig: () => Promise<void>;
};

const AppConfigContext = createContext<AppConfigState | null>(null);

// Returns null on any failure so the caller keeps whatever config it already has.
async function fetchAppConfig(token: string): Promise<AppConfig | null> {
  const res = await api<AppConfig>("/api/portal/app-config", { token });
  return res.ok ? res.data : null;
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { token, status } = useSession();
  // Keyed by token so a different member never sees the previous member's config.
  const [loaded, setLoaded] = useState<{ token: string; config: AppConfig } | null>(null);

  const refreshAppConfig = useCallback(async () => {
    if (!token) return;
    const config = await fetchAppConfig(token);
    if (config) setLoaded({ token, config });
  }, [token]);

  // Set state only in the promise callback, not synchronously in the effect body.
  useEffect(() => {
    if (status !== "authed" || !token) return;
    void fetchAppConfig(token).then((config) => {
      if (config) setLoaded({ token, config });
    });
  }, [status, token]);

  // Organisers change sections from the dashboard; pick that up when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refreshAppConfig();
    });
    return () => sub.remove();
  }, [refreshAppConfig]);

  const config =
    status === "authed" && loaded && loaded.token === token ? loaded.config : DEFAULT_APP_CONFIG;

  const isOn = useCallback((section: AppSection) => config.sections[section] !== false, [config]);

  const value = useMemo(
    () => ({ ...config, isOn, refreshAppConfig }),
    [config, isOn, refreshAppConfig],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigState {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within an AppConfigProvider");
  return ctx;
}
