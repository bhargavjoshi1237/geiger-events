import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ToastProvider } from "@/components/ui/Toast";
import { configureNotificationHandler, notificationRoute } from "@/lib/push";
import { PortalDataProvider } from "@/state/data";
import { LivePlayerProvider } from "@/state/live_player";
import { SessionProvider, useSession } from "@/state/session";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <SessionProvider>
            <PortalDataProvider>
              <LivePlayerProvider>
                <RootNavigator />
              </LivePlayerProvider>
            </PortalDataProvider>
          </SessionProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { status } = useSession();
  const [splashDone, setSplashDone] = useState(false);

  // Hide the native splash as soon as the first frame is drawn so it hands off
  // to the animated one with no white flash.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // Route tapped notifications into the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = notificationRoute(response.notification.request.content.data ?? {});
      if (route) router.push(route);
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      {!splashDone ? (
        <AnimatedSplash ready={status !== "loading"} onFinish={() => setSplashDone(true)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
