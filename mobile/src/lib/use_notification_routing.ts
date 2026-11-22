import { router, useSegments } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useRef } from "react";

import {
  addNotificationResponseHandler,
  notificationRoute,
  takeLaunchNotificationTap,
  type NotificationTap,
} from "@/lib/push";
import { useSession } from "@/state/session";

// Opens the screen a tapped push points at; a cold-start tap waits until the member is signed in and the app shell is up.
export function useNotificationRouting(): void {
  const { status } = useSession();
  const segments = useSegments();
  // "/" is still redirecting and (auth) means nobody is signed in to open it for.
  const ready = status === "authed" && segments.length > 0 && segments[0] !== "(auth)";
  const readyRef = useRef(ready);
  const pending = useRef<string | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    // The launch tap can also reach the listener, so each notification is routed once by id.
    const accept = (tap: NotificationTap) => {
      if (handled.current.has(tap.id)) return;
      handled.current.add(tap.id);
      const route = notificationRoute(tap.data);
      if (!route) return;
      if (readyRef.current) router.push(route as Href);
      else pending.current = route;
    };
    const launch = takeLaunchNotificationTap();
    if (launch) accept(launch);
    return addNotificationResponseHandler(accept);
  }, []);

  useEffect(() => {
    if (status === "guest") pending.current = null;
    if (!ready || !pending.current) return;
    const route = pending.current;
    pending.current = null;
    router.push(route as Href);
  }, [ready, status]);
}
