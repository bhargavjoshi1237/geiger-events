import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
  getPushPermission,
  requestPushPermission,
  type PushPermission,
} from "@/lib/push";
import { normalizePreferences, type PushPreferences } from "@/lib/push_catalog";
import { useSession, type PushToggleResult } from "@/state/session";
import type { PushCategoryKey, PushPreferencesResponse } from "@/types/portal";

const PREFS_PATH = "/api/portal/push/preferences";

// This device's push switch, shared by More and Account → Notifications.
export function usePushToggle() {
  const { pushStatus, setPushEnabled } = useSession();
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(
    async (next: boolean): Promise<PushToggleResult> => {
      setBusy(true);
      const result = await setPushEnabled(next);
      setBusy(false);
      if (result === "ok") success(next ? "Push notifications on." : "Push notifications off.");
      else if (result === "denied") error("Notifications are blocked. Allow them in Settings.");
      else if (result === "unsupported") error("This device can't register for push notifications.");
      else error("Couldn't turn on push notifications. Try again.");
      return result;
    },
    [setPushEnabled, success, error],
  );

  return {
    pushOn: pushStatus === "on",
    unsupported: pushStatus === "unsupported",
    busy,
    toggle,
  };
}

// The OS-level permission, re-read on return to the foreground since it changes in system settings.
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);

  const refresh = useCallback(async () => {
    const next = await getPushPermission();
    setPermission(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    const read = () =>
      void getPushPermission().then((next) => {
        if (active) setPermission(next);
      });
    read();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const request = useCallback(async () => {
    const next = await requestPushPermission();
    setPermission(next);
    return next;
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch((e: unknown) => console.warn("[push] openSettings failed", e));
  }, []);

  return { permission, refresh, request, openSettings };
}

// Per-category switches: they live on the server, so they apply to every device the member uses.
export function usePushPreferences() {
  const { token } = useSession();
  const { error } = useToast();
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<PushPreferences | null>(null);
  // Saves run one at a time so an older PUT can never land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const apply = useCallback((next: PushPreferences) => {
    latest.current = next;
    setPrefs(next);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api<PushPreferencesResponse>(PREFS_PATH, { token }).then((res) => {
      if (!active) return;
      if (res.ok) apply(normalizePreferences(res.data.categories));
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [token, apply, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  const setCategory = useCallback(
    (key: PushCategoryKey, value: boolean) => {
      const current = latest.current;
      if (!token || !current) return;
      apply({ ...current, [key]: value });
      queue.current = queue.current.then(async () => {
        if (!latest.current) return;
        const res = await api<PushPreferencesResponse>(PREFS_PATH, {
          method: "PUT",
          token,
          body: { categories: latest.current },
        });
        if (res.ok || !latest.current) return;
        apply({ ...latest.current, [key]: !value });
        error(res.error || "Couldn't save your notification settings.");
      });
    },
    [token, apply, error],
  );

  return { prefs, failed, retry, setCategory };
}
