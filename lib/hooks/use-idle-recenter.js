"use client";

import { useCallback, useEffect, useRef } from "react";

// Idle re-centring for a scrollable list — the editors' right-hand section nav.
// The countdown starts when a section is selected and whenever the list is
// scrolled; every further interaction restarts it. Once the list has sat
// untouched for `delay`, the selected item glides back to the middle of the
// column, so coming back to the nav always shows where you are with its
// neighbours around it.
//
// The glide is a rAF tween rather than native smooth scrolling, so it's slow
// enough to read as deliberate — and grabbing the list mid-glide cancels it and
// hands control straight back.
//
// Attach the returned ref to the scroll container and mark the selected element
// with `data-active="true"`.

const INTERACTION_EVENTS = ["wheel", "pointerdown", "touchstart", "keydown"];

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function useIdleRecenter(
  activeKey,
  { delay = 10000, duration = 700, selector = "[data-active='true']" } = {},
) {
  const ref = useRef(null);
  const timer = useRef(null);
  const frame = useRef(0);
  const animating = useRef(false);

  const stopGlide = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    animating.current = false;
  }, []);

  const center = useCallback(() => {
    timer.current = null;
    const el = ref.current;
    const target = el?.querySelector(selector);
    if (!el || !target) return;

    // Not scrollable — e.g. the stacked mobile layout, or a short list.
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;

    // Rect maths rather than offsetTop: items are nested inside group wrappers
    // and the scroll container isn't their offset parent.
    const elRect = el.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta =
      targetRect.top + targetRect.height / 2 - (elRect.top + elRect.height / 2);
    const from = el.scrollTop;
    const to = Math.max(0, Math.min(max, from + delta));
    const distance = to - from;
    if (Math.abs(distance) < 2) return; // already centred

    stopGlide();

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduced || duration <= 0) {
      el.scrollTop = to;
      return;
    }

    // `animating` marks the scroll events this tween emits so they don't arm a
    // fresh countdown behind it.
    animating.current = true;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.scrollTop = from + distance * easeInOutCubic(t);
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      frame.current = 0;
      animating.current = false;
    };
    frame.current = requestAnimationFrame(step);
  }, [selector, duration, stopGlide]);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(center, delay);
  }, [center, delay]);

  // Selecting a section starts the countdown — the list doesn't have to be
  // scrolled by hand first — so the nav settles onto each new selection.
  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [activeKey, arm]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const onScroll = () => {
      if (!animating.current) arm();
    };
    // Touching the list mid-glide cancels it and restarts the countdown, so the
    // animation never fights the user for the scrollbar.
    const onInteract = () => {
      if (animating.current) stopGlide();
      arm();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    for (const type of INTERACTION_EVENTS) {
      el.addEventListener(type, onInteract, { passive: true });
    }
    return () => {
      el.removeEventListener("scroll", onScroll);
      for (const type of INTERACTION_EVENTS) {
        el.removeEventListener(type, onInteract);
      }
      stopGlide();
    };
  }, [arm, stopGlide]);

  return ref;
}
