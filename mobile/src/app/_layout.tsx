import { Stack, router } from "expo-router";
import type { Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Splash } from "@/components/Splash";
import { ToastProvider } from "@/components/ui/Toast";
import {
  addNotificationResponseHandler,
  configureNotificationHandler,
  notificationRoute,
} from "@/lib/push";
import { PortalDataProvider } from "@/state/data";
import { LivePlayerProvider } from "@/state/live_player";
import { SessionProvider, useSession } from "@/state/session";
import { useAppFonts } from "@/theme/load_fonts";
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
  const fontsReady = useAppFonts();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(
    () =>
      addNotificationResponseHandler((data) => {
        const route = notificationRoute(data);
        if (route) router.push(route as Href);
      }),
    [],
  );

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
        <Stack.Screen name="pass/[id]" options={{ animation: "fade_from_bottom" }} />
      </Stack>
      {!splashDone ? (
        <Splash ready={status !== "loading" && fontsReady} onFinish={() => setSplashDone(true)} />
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
