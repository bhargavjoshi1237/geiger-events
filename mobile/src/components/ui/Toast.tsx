import { Feather } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInUp,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, spring, type } from "@/theme/tokens";

const TOAST_DURATION = 3200;
const MAX_TOASTS = 3;

type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_ICON: Record<ToastKind, React.ComponentProps<typeof Feather>["name"]> = {
  success: "check-circle",
  error: "alert-circle",
  info: "info",
};

const KIND_COLOR: Record<ToastKind, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++nextId.current;
      setToasts((list) => [{ id, kind, message }, ...list].slice(0, MAX_TOASTS));
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION));
      if (kind === "success") successFeedback();
      else if (kind === "error") errorFeedback();
      else tapFeedback();
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.stack, { top: insets.top + spacing.md }]}
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Ref-suffixed so the React Compiler lets the gesture worklet mutate it.
  const offsetYRef = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      offsetYRef.value = Math.max(-200, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < -40 || e.velocityY < -500) {
        runOnJS(onDismiss)();
      } else {
        offsetYRef.value = withSpring(0, spring);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetYRef.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInUp.springify().damping(18)}
        exiting={FadeOutUp}
        style={[styles.toast, animStyle]}
      >
        <Feather name={KIND_ICON[toast.kind]} size={16} color={KIND_COLOR[toast.kind]} />
        <Text style={styles.message} numberOfLines={3}>
          {toast.message}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceDialog,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 440,
  },
  message: {
    flexShrink: 1,
    ...type.label,
    color: colors.foreground,
  },
});
