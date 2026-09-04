"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Measures the room a canvas has and returns the scale that fits the chosen
// device width into it. Attach the returned ref to the element doing the
// containing; `fit` is 1 when there is room to spare, never more.
export function useFitZoom(width, gutter = 32) {
  const [available, setAvailable] = useState(0);
  const ref = useRef(null);

  const attach = useCallback((el) => {
    ref.current = el;
    if (el) setAvailable(el.clientWidth);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = available ? Math.min(1, Math.max(0.1, (available - gutter) / width)) : 1;
  return { attach, fit };
}
