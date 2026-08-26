import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function useAppFocused(): boolean {
  const [focused, setFocused] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", setAppState);
    return () => sub.remove();
  }, []);

  return focused && appState === "active";
}

export function usePoll(fn: () => void, intervalMs: number, enabled: boolean) {
  const focused = useAppFocused();
  const active = enabled && focused;
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!active) return undefined;
    fnRef.current();
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
