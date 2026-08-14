import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { colors } from "@/theme/tokens";

// Foreground notifications still show a banner and play a sound. Call once at
// module scope of the root layout.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Register this device for push. Returns the Expo push token, or null when the
// device can't (or won't) receive pushes. Never throws.
export async function registerForPush(token: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

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
