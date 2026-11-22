import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { PUSH_CATEGORIES } from "@/lib/push_catalog";
import { colors } from "@/theme/tokens";

const PUSH_TOKEN_KEY = "geiger.portal.pushToken";

type NotificationsModule = typeof import("expo-notifications");
type NotificationResponse = import("expo-notifications").NotificationResponse;
type NotificationPermissionsStatus = import("expo-notifications").NotificationPermissionsStatus;
type DevicePushToken = import("expo-notifications").DevicePushToken;
let cached: NotificationsModule | null | undefined;
// Fetching a token can itself fire the token listener; registration already covers that one.
let registering = false;

export type NotificationData = Record<string, unknown>;

export type NotificationTap = { id: string; data: NotificationData };

export type PushRegistration =
  | { ok: true; pushToken: string }
  | { ok: false; reason: "unsupported" | "denied" | "failed" };

// "unavailable" is Expo Go or the web, where the notifications module can't load.
export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

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

export async function clearStoredPushToken(): Promise<void> {
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

function easProjectId(): string | null {
  const id: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof id === "string" && id ? id : null;
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
  // Channels must exist before a push names one, or Android files it under "Miscellaneous".
  void setupNotificationChannels();
}

// One channel per category (ids match the server's channelId) so members can tune each in system settings too.
async function setupNotificationChannels(): Promise<void> {
  const Notifications = notificationsModule();
  if (!Notifications || Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      lightColor: colors.primary,
    });
    await Promise.all(
      PUSH_CATEGORIES.map((c) =>
        Notifications.setNotificationChannelAsync(c.key, {
          name: c.label,
          description: c.description,
          importance: c.urgent
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
          lightColor: colors.primary,
        }),
      ),
    );
  } catch (e) {
    console.warn("[push] channel setup failed", e);
  }
}

function forgetLastResponse(Notifications: NotificationsModule): void {
  try {
    Notifications.clearLastNotificationResponse();
  } catch (e) {
    console.warn("[push] clearing the last notification response failed", e);
  }
}

function tapOf(response: NotificationResponse): NotificationTap {
  const { request } = response.notification;
  return { id: request.identifier, data: (request.content.data ?? {}) as NotificationData };
}

// Clearing after each tap stops a later launch (an OTA reload included) from replaying it.
export function addNotificationResponseHandler(
  onOpen: (tap: NotificationTap) => void,
): () => void {
  const Notifications = notificationsModule();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(tapOf(response));
    forgetLastResponse(Notifications);
  });
  return () => sub.remove();
}

// The tap that launched the app from cold, if any — taken once so it can't be routed twice.
export function takeLaunchNotificationTap(): NotificationTap | null {
  const Notifications = notificationsModule();
  if (!Notifications) return null;
  try {
    const response = Notifications.getLastNotificationResponse();
    if (!response) return null;
    forgetLastResponse(Notifications);
    return tapOf(response);
  } catch (e) {
    console.warn("[push] reading the launch notification failed", e);
    return null;
  }
}

function permissionOf(
  status: NotificationPermissionsStatus,
  Notifications: NotificationsModule,
): PushPermission {
  if (status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return "granted";
  }
  return status.canAskAgain ? "undetermined" : "denied";
}

export async function getPushPermission(): Promise<PushPermission> {
  const Notifications = notificationsModule();
  if (!Notifications) return "unavailable";
  try {
    return permissionOf(await Notifications.getPermissionsAsync(), Notifications);
  } catch (e) {
    console.warn("[push] getPermissionsAsync failed", e);
    return "unavailable";
  }
}

export async function requestPushPermission(): Promise<PushPermission> {
  const Notifications = notificationsModule();
  if (!Notifications) return "unavailable";
  try {
    return permissionOf(await Notifications.requestPermissionsAsync(), Notifications);
  } catch (e) {
    console.warn("[push] requestPermissionsAsync failed", e);
    return "unavailable";
  }
}

async function sendRegistration(
  Notifications: NotificationsModule,
  sessionToken: string,
  projectId: string,
  devicePushToken?: DevicePushToken,
): Promise<string | null> {
  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
  const res = await api("/api/portal/devices", {
    method: "POST",
    token: sessionToken,
    body: {
      pushToken,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version,
    },
  });
  if (!res.ok) return null;
  await storePushToken(pushToken);
  return pushToken;
}

export async function registerForPush(sessionToken: string): Promise<PushRegistration> {
  registering = true;
  try {
    const Notifications = notificationsModule();
    if (!Notifications || !Device.isDevice) return { ok: false, reason: "unsupported" };
    const projectId = easProjectId();
    if (!projectId) {
      console.warn("[push] no EAS project id — skipping registration");
      return { ok: false, reason: "unsupported" };
    }

    await setupNotificationChannels();

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return { ok: false, reason: "denied" };

    const pushToken = await sendRegistration(Notifications, sessionToken, projectId);
    return pushToken ? { ok: true, pushToken } : { ok: false, reason: "failed" };
  } catch (e) {
    console.warn("[push] registration failed", e);
    return { ok: false, reason: "failed" };
  } finally {
    registering = false;
  }
}

// FCM/APNs can roll the device token while the app runs; re-register so pushes keep arriving.
export function addPushTokenChangeHandler(
  sessionToken: string,
  onChange: (pushToken: string) => void,
): () => void {
  const Notifications = notificationsModule();
  const projectId = easProjectId();
  if (!Notifications || !projectId) return () => {};
  const sub = Notifications.addPushTokenListener((devicePushToken) => {
    if (registering) return;
    void (async () => {
      try {
        // Push switched off on this device: nothing to keep registered.
        const previous = await getStoredPushToken();
        if (!previous) return;
        const next = await sendRegistration(Notifications, sessionToken, projectId, devicePushToken);
        if (!next || next === previous) return;
        onChange(next);
        void api("/api/portal/devices", {
          method: "DELETE",
          token: sessionToken,
          body: { pushToken: previous },
        });
      } catch (e) {
        console.warn("[push] re-registration failed", e);
      }
    })();
  });
  return () => sub.remove();
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

// An in-app expo-router path; "//host" would read as an external URL.
export function appRoute(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

// data.route is the server's expo-router path; the type mapping covers pushes sent before routes existed.
export function notificationRoute(data: NotificationData): string | null {
  const route = appRoute(data.route);
  if (route) return route;
  const { type } = data;
  if (type === "announcement") return "/notifications";
  if (type === "thread" && typeof data.id === "string") return `/messages/${data.id}`;
  if (type === "ticket" && typeof data.id === "string") return `/tickets/${data.id}`;
  return null;
}
