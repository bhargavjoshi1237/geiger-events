import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useToast } from "@/components/ui/Toast";

type UpdatesModule = typeof import("expo-updates");
type UpdatesState = Pick<
  ReturnType<UpdatesModule["useUpdates"]>,
  "isUpdatePending" | "isStartupProcedureRunning"
>;

const CHECK_EVERY_MS = 15 * 60 * 1000;

// A dev client built before expo-updates was added has no native module, and importing the package would throw.
const Updates: UpdatesModule | null = requireOptionalNativeModule("ExpoUpdates")
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-updates") as UpdatesModule)
  : null;

// Dev servers and Expo Go serve their own bundle; only release builds take OTA updates.
const OTA_ON = Boolean(Updates?.isEnabled) && !__DEV__;

const IDLE: UpdatesState = { isUpdatePending: false, isStartupProcedureRunning: false };
const useNoUpdates = (): UpdatesState => IDLE;
const useUpdatesState: () => UpdatesState = Updates ? Updates.useUpdates : useNoUpdates;

let lastCheckAt = 0;
let checking = false;

// Downloads a newer update when there is one; it applies on the next restart. Throttled to one check per 15 min.
async function checkAndFetch(): Promise<void> {
  if (!Updates || !OTA_ON || checking || Date.now() - lastCheckAt < CHECK_EVERY_MS) return;
  lastCheckAt = Date.now();
  checking = true;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable || check.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
  } catch (e) {
    console.warn("[updates] check failed", e);
  } finally {
    checking = false;
  }
}

async function restartIntoUpdate(): Promise<void> {
  try {
    await Updates?.reloadAsync();
  } catch (e) {
    console.warn("[updates] reload failed", e);
  }
}

// Checks on launch and on return to the foreground, then offers a restart once an update is downloaded.
export function useOtaUpdates(): void {
  const { isUpdatePending, isStartupProcedureRunning } = useUpdatesState();
  const { info } = useToast();
  const pendingRef = useRef(isUpdatePending);
  const offered = useRef(false);

  useEffect(() => {
    pendingRef.current = isUpdatePending;
  }, [isUpdatePending]);

  // The launch-time native check runs first; checking alongside it would race the same download.
  useEffect(() => {
    if (!OTA_ON || isStartupProcedureRunning || pendingRef.current) return;
    void checkAndFetch();
  }, [isStartupProcedureRunning]);

  useEffect(() => {
    if (!OTA_ON) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !pendingRef.current) void checkAndFetch();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!OTA_ON || !isUpdatePending || offered.current) return;
    offered.current = true;
    info("Update ready", {
      persistent: true,
      action: { label: "Restart", onPress: () => void restartIntoUpdate() },
    });
  }, [isUpdatePending, info]);
}

export type BuildInfo = {
  version: string;
  // null on dev builds and Expo Go, which have no update channel.
  channel: string | null;
  updateId: string | null;
  updateCreatedAt: Date | null;
  embedded: boolean;
};

export function buildInfo(): BuildInfo {
  const live = Updates?.isEnabled ? Updates : null;
  const embedded = !live || live.isEmbeddedLaunch;
  return {
    version: Constants.expoConfig?.version || "1.0.0",
    channel: live?.channel ?? null,
    updateId: embedded ? null : (live?.updateId ?? null),
    updateCreatedAt: embedded ? null : (live?.createdAt ?? null),
    embedded,
  };
}
