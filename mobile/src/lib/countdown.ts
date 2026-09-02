import { useEffect, useState } from "react";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

const isBareDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function diffParts(target: string | null): CountdownParts | null {
  if (!target) return null;
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

// The parts live in state rather than being derived per render: Date.now() is
// invisible to the React Compiler, so a derived value would be memoised on
// dateStr and freeze at whatever it read first.
export function useCountdown(dateStr: string | null): CountdownParts | null {
  const [parts, setParts] = useState(() => diffParts(dateStr));
  const [seenDate, setSeenDate] = useState(dateStr);

  // Re-seed during render so a new target never shows the old one's remainder.
  if (seenDate !== dateStr) {
    setSeenDate(dateStr);
    setParts(diffParts(dateStr));
  }

  useEffect(() => {
    if (!dateStr) return undefined;
    const id = setInterval(() => setParts(diffParts(dateStr)), 1000);
    return () => clearInterval(id);
  }, [dateStr]);

  return parts;
}
