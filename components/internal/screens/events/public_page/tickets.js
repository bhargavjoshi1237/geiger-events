export function groupTickets(event, tickets) {
  const groups = Array.isArray(event.ticketGroups) ? [...event.ticketGroups] : [];
  if (!groups.length) return null;
  groups.sort(
    (a, b) =>
      (a.rank ?? 1) - (b.rank ?? 1) || (a.name || "").localeCompare(b.name || ""),
  );
  const idSet = new Set(groups.map((g) => g.tierId));
  const sections = groups
    .map((g) => ({ ...g, items: tickets.filter((t) => t.groupId === g.tierId) }))
    .filter((s) => s.items.length);
  const ungrouped = tickets.filter((t) => !t.groupId || !idSet.has(t.groupId));
  if (!sections.length) return null;
  return { sections, ungrouped };
}

export function eventBase(event) {
  if (event.sold > 0 && event.revenue > 0) {
    return Math.max(5, Math.round(event.revenue / event.sold / 5) * 5);
  }
  return 25;
}

export function buildTickets(event, resolved) {
  const source =
    Array.isArray(resolved) && resolved.length
      ? resolved
      : Array.isArray(event.tickets) && event.tickets.length
        ? event.tickets
        : null;
  if (source) {
    const groupById = new Map(
      (Array.isArray(event.tickets) ? event.tickets : []).map((t) => [t.id, t.groupId ?? null]),
    );
    return source
      .filter((t) => (t.rules?.visibility || "public") !== "hidden")
      .map((t) => ({
        id: t.id ?? null,
        name: t.name || "Ticket",
        price: Number(t.price) || 0,
        qty: Number(t.qty) || 0,
        note: t.description || "",
        ticketTypeId: t.ticketTypeId ?? null,
        groupId: t.groupId ?? groupById.get(t.id) ?? null,
        rules: t.rules && typeof t.rules === "object" ? t.rules : {},
      }));
  }
  if (event.type === "Online" && event.revenue === 0) {
    return [{ name: "Free registration", price: 0, note: "Online access link sent on registration" }];
  }
  return [{ name: "General Admission", price: Math.max(0, eventBase(event)), note: "Standard entry" }];
}

export function seatLabelSummary(seats, sections) {
  if (!seats?.length) return "";
  const sectionName = new Map((sections || []).map((s) => [s.id, s.name]));
  const groups = new Map();
  for (const seat of seats) {
    const key = `${seat.sectionId}|${seat.rowLabel}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seat.seatLabel);
  }
  return [...groups.entries()]
    .map(([key, labels]) => {
      const [sectionId, rowLabel] = key.split("|");
      const nums = labels.map((l) => Number(l)).filter((n) => Number.isFinite(n));
      const consecutive =
        nums.length === labels.length &&
        nums.length > 1 &&
        Math.max(...nums) - Math.min(...nums) === nums.length - 1;
      const seatPart = consecutive
        ? `Seats ${Math.min(...nums)}-${Math.max(...nums)}`
        : `Seat${labels.length > 1 ? "s" : ""} ${labels.join(", ")}`;
      const name = sectionName.get(sectionId);
      return [name, rowLabel ? `Row ${rowLabel}` : null, seatPart]
        .filter(Boolean)
        .join(" · ");
    })
    .join("  |  ");
}
