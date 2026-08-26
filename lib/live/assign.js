
export function assignAttendees(attendees, rooms, { mode = "balanced" } = {}) {
  const out = { __unassigned: [] };
  const open = (rooms || []).map((r) => ({
    id: r.id,
    capacity: Math.max(0, Number(r.capacity) || 0),
  }));
  for (const r of open) out[r.id] = [];

  const queue = [...new Set(attendees || [])];
  if (!open.length) {
    out.__unassigned = queue;
    return out;
  }

  if (mode === "sequential") {
    let i = 0;
    for (const person of queue) {
      while (i < open.length && out[open[i].id].length >= open[i].capacity) i += 1;
      if (i >= open.length) out.__unassigned.push(person);
      else out[open[i].id].push(person);
    }
    return out;
  }

  for (const person of queue) {
    const target = open
      .filter((r) => out[r.id].length < r.capacity)
      .sort((a, b) => out[a.id].length - out[b.id].length)[0];
    if (!target) out.__unassigned.push(person);
    else out[target.id].push(person);
  }
  return out;
}
