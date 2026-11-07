"use client";

import { mealTally, seatingByBlock, seatLabel, surnameKey } from "@/lib/event_design";
import {
  buildCatererSummaryHtml,
  buildPlaceCardsHtml,
  buildSeatingListHtml,
  buildTableSignsHtml,
} from "@/lib/event_design/seating_print";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";

// Seating Charts outputs: printable pages (new tab, auto print dialog) and the CSV export.

const dietLine = (g) => [g.dietary, g.accessibility].filter(Boolean).join(" · ");

function openPrint(html) {
  const win = window.open("", "_blank");
  if (!win) return "Allow pop-ups to open the print page.";
  win.document.write(html);
  win.document.close();
  return null;
}

// Tables with seated guests (or every table for signs), in chart order.
function tablesFor({ blocks, guests }) {
  return seatingByBlock(blocks, guests).map((t) => ({
    label: t.block.label,
    kind: t.block.kind,
    seats: [
      ...t.seats.map((s) => ({
        seatNo: s.seatNo,
        name: s.guest?.name || "",
        meal: s.guest?.meal || "",
        dietary: s.guest ? dietLine(s.guest) : "",
        vip: Boolean(s.guest?.vip),
      })),
      ...t.tbd.map((g) => ({ seatNo: "–", name: g.name, meal: g.meal, dietary: dietLine(g), vip: g.vip })),
    ],
    meals: t.meals,
    dietary: t.guests.filter((g) => dietLine(g)).map((g) => ({ name: g.name, note: dietLine(g) })),
    count: t.guests.length,
  }));
}

// → error string (pop-up blocked / nothing to print) or null.
export function printSeating(kind, { blocks, guests, meta, paper, showMeal }) {
  const tables = tablesFor({ blocks, guests });
  const used = tables.filter((t) => t.count > 0);
  if (kind === "signs") {
    const signs = tables.filter((t) => t.kind === "table");
    if (!signs.length) return "There are no tables on this plan.";
    return openPrint(buildTableSignsHtml({ meta, tables: signs, paper }));
  }
  if (!used.length) return "Seat some guests first.";
  if (kind === "list") return openPrint(buildSeatingListHtml({ meta, tables: used, paper }));
  if (kind === "caterer") return openPrint(buildCatererSummaryHtml({ meta, tables: used, paper }));
  if (kind === "cards") {
    const cards = used
      .flatMap((t) => t.seats.filter((s) => s.name).map((s) => ({ name: s.name, table: t.label, meal: s.meal, dietary: s.dietary })))
      .sort((a, b) => surnameKey(a.name).localeCompare(surnameKey(b.name)));
    return openPrint(buildPlaceCardsHtml({ meta, cards, paper, showMeal }));
  }
  return null;
}

export function exportSeatingCsv({ guests, index, filename }) {
  const rows = [...guests].sort((a, b) => Number(b.seated) - Number(a.seated) || a.name.localeCompare(b.name));
  downloadCsv(
    [
      { header: "Name", value: (g) => g.name },
      { header: "Email", value: (g) => g.email },
      { header: "Table", value: (g) => (g.seated ? index.byItem.get(g.itemId)?.label || "" : "") },
      { header: "Seat", value: (g) => (g.seated ? seatLabel(index, g.itemId, g.seatIndex).split(" · ")[1] || "" : "") },
      { header: "Status", value: (g) => (g.orphan ? "Needs reseating" : g.seated ? "Seated" : g.stale ? "No longer attending" : "Not seated") },
      { header: "Ticket", value: (g) => g.tier },
      { header: "Party", value: (g) => g.partyLabel },
      { header: "Meal", value: (g) => g.meal },
      { header: "Dietary", value: (g) => g.dietary },
      { header: "Accessibility", value: (g) => g.accessibility },
      { header: "VIP", value: (g) => (g.vip ? "Yes" : "") },
      { header: "Notes", value: (g) => g.notes },
    ],
    rows,
    filename,
  );
}

export const overallMeals = (guests) => mealTally((guests || []).filter((g) => !g.stale));
