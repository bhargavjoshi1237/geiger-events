// Placement maths: items (talks, exhibitors, volunteers) placed into places (rooms, booths, shifts) with capacity. Pure.

const placeIdsOf = (item, linkFieldId) => (item.links?.[linkFieldId] ?? []).map((link) => link.id).filter(Boolean);
const numberOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : fallback);

// Fill per place, the unplaced tray, and flags: over capacity, and one item in two places at the same time.
export function placementState({ items, places, linkFieldId, capacityFieldId = null, startField = null, endField = null }) {
  const byPlace = new Map(places.map((place) => [place.id, []]));
  const tray = [];
  for (const item of items) {
    const placed = placeIdsOf(item, linkFieldId).filter((id) => byPlace.has(id));
    if (!placed.length) tray.push(item);
    for (const id of placed) byPlace.get(id).push(item);
  }
  const timed = startField && endField;
  const windowOf = (place) => {
    const start = Date.parse(place.values?.[startField] ?? "");
    const end = Date.parse(place.values?.[endField] ?? "");
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
  };
  const overlaps = [];
  if (timed) {
    const windows = new Map(places.map((place) => [place.id, windowOf(place)]));
    for (const item of items) {
      const mine = placeIdsOf(item, linkFieldId).filter((id) => windows.get(id));
      for (let i = 0; i < mine.length; i += 1) {
        for (let j = i + 1; j < mine.length; j += 1) {
          const a = windows.get(mine[i]);
          const b = windows.get(mine[j]);
          if (a.start < b.end && b.start < a.end) overlaps.push({ itemId: item.id, places: [mine[i], mine[j]] });
        }
      }
    }
  }
  return {
    places: places.map((place) => {
      const used = byPlace.get(place.id).length;
      const capacity = capacityFieldId ? numberOr(place.values?.[capacityFieldId], null) : null;
      return { id: place.id, place, items: byPlace.get(place.id), used, capacity, over: capacity !== null && used > capacity };
    }),
    tray,
    overlaps,
  };
}

// Fills open capacity in order: each unplaced item goes to the first place with room (and a matching choice, when set).
// Returns [{ itemId, placeId }] without changing anything; places without a capacity take any number.
export function autoPlace({ items, places, linkFieldId, capacityFieldId = null, match = null, limit = 500 }) {
  const state = placementState({ items, places, linkFieldId, capacityFieldId });
  const room = new Map(state.places.map((entry) => [entry.id, entry.capacity === null ? Infinity : Math.max(0, entry.capacity - entry.used)]));
  const valueOf = (record, fieldId) => {
    const value = record.values?.[fieldId];
    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  };
  const fits = (item, place) => !match || valueOf(item, match.itemField).some((value) => valueOf(place, match.placeField).includes(value));
  const pairs = [];
  for (const item of state.tray) {
    if (pairs.length >= limit) break;
    const place = places.find((candidate) => room.get(candidate.id) > 0 && fits(item, candidate));
    if (!place) continue;
    room.set(place.id, room.get(place.id) - 1);
    pairs.push({ itemId: item.id, placeId: place.id });
  }
  return pairs;
}
