"use client";

import React, { useLayoutEffect, useRef, useState } from "react";

// Renders children at a fixed desktop logical width, then CSS-scales them down to
// fill the available width — so real app screens keep their intended multi-column
// desktop layout instead of collapsing/clipping inside a narrow preview frame.
// The inner box height is expressed relative to the (fixed-height) parent and the
// same scale, so the scaled content lines up flush with the frame — no dead space.
export function ScaledViewport({ width = 1180, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      <div
        className="origin-top-left"
        style={{
          width,
          height: scale ? `${100 / scale}%` : "100%",
          transform: scale ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default ScaledViewport;
