import { useRouter } from "expo-router";
import { useCallback } from "react";

import { useControl, type AppMode } from "@/state/control";

// Moving between the attendee app and Control always lands on the other mode's root, never on a stacked screen.
export function useModeSwitch() {
  const router = useRouter();
  const { setMode } = useControl();

  const go = useCallback(
    async (mode: AppMode) => {
      await setMode(mode);
      if (router.canDismiss()) router.dismissAll();
      router.replace(mode === "control" ? "/control" : "/(app)/home");
    },
    [router, setMode],
  );

  return {
    toControl: useCallback(() => go("control"), [go]),
    toAttendee: useCallback(() => go("attendee"), [go]),
  };
}
