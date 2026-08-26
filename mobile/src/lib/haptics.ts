import * as Haptics from "expo-haptics";

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
