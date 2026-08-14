import { useEffect, useState } from "react";

// Port of portal_kit.jsx's useCountdown. Ticks a counter each second; the parts
// are derived at render time so the effect never calls setState with a computed
// value (avoids cascading renders).

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

// A bare event_date ("2026-09-01") is local midnight, as on the web; anything
// already carrying a time (membership expires_at) is parsed as-is.
const isBareDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function diffParts(target: string): CountdownParts | null {
  const t = new Date(isBareDate(target) ? `${target}T00:00:00` : target).getTime();
  if (Number.isNaN(t)) return null;
  let ms = t - Date.now();
  const done = ms <= 0;
  ms = Math.max(0, ms);
  const days = Math.floor(ms / 864e5);
  const hours = Math.floor((ms % 864e5) / 36e5);
  const minutes = Math.floor((ms % 36e5) / 6e4);
  const seconds = Math.floor((ms % 6e4) / 1e3);
  return { days, hours, minutes, seconds, done };
}

export function useCountdown(dateStr: string | null): CountdownParts | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!dateStr) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  return dateStr ? diffParts(dateStr) : null;
}
