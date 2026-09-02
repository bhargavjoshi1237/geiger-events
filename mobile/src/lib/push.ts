import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { colors } from "@/theme/tokens";

const PUSH_TOKEN_KEY = "geiger.portal.pushToken";

type NotificationsModule = typeof import("expo-notifications");
let cached: NotificationsModule | null | undefined;

// The registered token is persisted so "push is on" survives a relaunch —
// the session token alone can't tell us whether this device is registered.
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch (e) {
    console.warn("[push] getStoredPushToken failed", e);
    return null;
  }
}

async function storePushToken(pushToken: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  } catch (e) {
    console.warn("[push] storePushToken failed", e);
  }
}

async function clearStoredPushToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch (e) {
    console.warn("[push] clearStoredPushToken failed", e);
  }
}

function notificationsModule(): NotificationsModule | null {
  if (cached === undefined) {
    cached =
      Constants.appOwnership === "expo"
        ? null
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("expo-notifications") as NotificationsModule);
  }
  return cached;
}

export function configureNotificationHandler() {
  const Notifications = notificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function addNotificationResponseHandler(
  onOpen: (data: Record<string, unknown>) => void,
): () => void {
  const Notifications = notificationsModule();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen((response.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  return () => sub.remove();
}

export async function registerForPush(token: string): Promise<string | null> {
  try {
    const Notifications = notificationsModule();
    if (!Notifications || !Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        lightColor: colors.primary,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[push] no EAS project id — skipping registration");
      return null;
    }

    const pushToken = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
    const res = await api("/api/portal/devices", {
      method: "POST",
      token,
      body: {
        pushToken,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version,
      },
    });
    if (!res.ok) return null;
    await storePushToken(pushToken);
    return pushToken;
  } catch (e) {
    console.warn("[push] registration failed", e);
    return null;
  }
}

export async function unregisterPush(
  sessionToken: string,
  pushToken: string | null,
): Promise<void> {
  await clearStoredPushToken();
  if (!pushToken) return;
  await api("/api/portal/devices", {
    method: "DELETE",
    token: sessionToken,
    body: { pushToken },
  });
}

export function notificationRoute(
  data: Record<string, unknown>,
): string | null {
  const { type } = data;
  if (type === "announcement") return "/notifications";
  if (type === "thread" && typeof data.id === "string") return `/messages/${data.id}`;
  if (type === "ticket" && typeof data.id === "string") return `/tickets/${data.id}`;
  return null;
}
