import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { colors } from "@/theme/tokens";

// Expo Go removed Android remote push in SDK 53 and the module throws while
// being evaluated there, so it can't be imported statically. Require it
// lazily, once, only outside Expo Go; elsewhere these helpers become no-ops.
type NotificationsModule = typeof import("expo-notifications");
let cached: NotificationsModule | null | undefined;

function notificationsModule(): NotificationsModule | null {
  if (cached === undefined) {
    // Lazy require on purpose: a static import would evaluate the module and
    // crash Expo Go before any guard could run.
    cached =
      Constants.appOwnership === "expo"
        ? null
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("expo-notifications") as NotificationsModule);
  }
  return cached;
}

// Foreground notifications still show a banner and play a sound. Call once at
// module scope of the root layout.
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

// Subscribe to notification taps. Returns an unsubscribe function; in Expo Go
// (where listeners are unavailable) it returns a no-op.
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

// Register this device for push. Returns the Expo push token, or null when the
// device can't (or won't) receive pushes. Never throws.
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
    await api("/api/portal/devices", {
      method: "POST",
      token,
      body: {
        pushToken,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version,
      },
    });
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
  if (!pushToken) return;
  await api("/api/portal/devices", {
    method: "DELETE",
    token: sessionToken,
    body: { pushToken },
  });
}

// Map a notification's data payload to an in-app path; null for anything unknown.
export function notificationRoute(
  data: Record<string, unknown>,
): string | null {
  const { type } = data;
  if (type === "announcement") return "/notifications";
  if (type === "thread" && typeof data.id === "string") return `/messages/${data.id}`;
  if (type === "ticket" && typeof data.id === "string") return `/tickets/${data.id}`;
  return null;
}
