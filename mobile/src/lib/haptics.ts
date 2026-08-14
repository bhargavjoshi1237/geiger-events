import * as Haptics from "expo-haptics";

// Thin wrappers so screens never import expo-haptics directly. Fire-and-forget:
// haptics are unavailable on some devices and on web, so every call is guarded.
export function tapFeedback() {
  Haptics.selectionAsync().catch(() => {});
}

export function selectionFeedback() {
  Haptics.selectionAsync().catch(() => {});
}

export function successFeedback() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function errorFeedback() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
