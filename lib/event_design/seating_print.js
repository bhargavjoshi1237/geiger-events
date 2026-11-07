import { surnameKey } from "./seating_chart.js";

// Print-ready HTML for Seating Charts: seating list (by table + find-your-table), 4-up tent place cards, table signs, caterer summary.

export const PAPER_SIZES = {
  a4: { label: "A4", wMm: 210, hMm: 297 },
  letter: { label: "US Letter", wMm: 215.9, hMm: 279.4 },
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const paperOf = (paper) => PAPER_SIZES[paper] || PAPER_SIZES.a4;

const BASE_CSS = [
  "*{box-sizing:border-box}",
  "body{margin:0;background:#fff;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
  ".page{position:relative;overflow:hidden;break-after:page;page-break-after:always}",
  ".page:last-child{break-after:auto;page-break-after:auto}",
  "@media screen{body{background:#e4e4e7;padding:8mm}.page{background:#fff;margin:0 auto 8mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}}",
].join("");

// Sheet documents (cards, signs) print edge to edge; flowing documents (lists, tables) get a page margin instead.
function documentHtml(title, paper, css, body, { flow = false } = {}) {
  const p = paperOf(paper);
  const margin = flow ? 12 : 0;
  const flowCss = flow
    ? `.pad{padding:0}@media screen{.pad{width:${p.wMm}mm;min-height:${p.hMm}mm;padding:${margin}mm;background:#fff;margin:0 auto 8mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}}`
    : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>@page{size:${p.wMm}mm ${p.hMm}mm;margin:${margin}mm}${BASE_CSS}.page{width:${p.wMm}mm;height:${p.hMm}mm}${css}${flowCss}</style>` +
    `</head><body>${body}<script>window.onload=function(){window.print()}</script></body></html>`
  );
}

const subtitle = (meta) => [meta?.eventName, meta?.planName, meta?.date].filter(Boolean).map(esc).join(" · ");

// Seating list: every table with its seats, then an alphabetical "find your table" list. `tables`: [{ label, seats: [{ seatNo, name, meal, dietary, vip }] }].
export function buildSeatingListHtml({ meta, tables, paper = "a4" }) {
  const css = [
    "h1{font-size:18pt;margin:0}",
    ".sub{font-size:9pt;color:#71717a;margin:2mm 0 6mm}",
    ".grid{columns:2;column-gap:8mm}",
    ".tbl{break-inside:avoid;margin:0 0 5mm;border:0.3mm solid #d4d4d8;border-radius:2mm;padding:3mm 4mm}",
    ".tbl h2{font-size:11pt;margin:0 0 1.5mm;display:flex;justify-content:space-between}",
    ".tbl h2 span{font-weight:400;color:#71717a;font-size:9pt}",
    ".row{display:flex;gap:2mm;font-size:9pt;line-height:1.45}",
    ".row .n{width:6mm;color:#a1a1aa;text-align:right}",
    ".row .name{flex:1}",
    ".row .meal{color:#52525b}",
    ".row.empty .name{color:#a1a1aa}",
    ".find{columns:3;column-gap:6mm;font-size:9pt;line-height:1.55}",
    ".find div{display:flex;justify-content:space-between;gap:2mm;break-inside:avoid;border-bottom:0.2mm dotted #d4d4d8}",
    ".find b{font-weight:600}",
  ].join("");

  const tableCards = tables
    .map((t) => {
      const filled = t.seats.filter((s) => s.name).length;
      const rows = t.seats
        .map(
          (s) =>
            `<div class="row${s.name ? "" : " empty"}"><span class="n">${esc(s.seatNo ?? "")}</span>` +
            `<span class="name">${s.name ? `${esc(s.name)}${s.vip ? " ★" : ""}${s.dietary ? ` <i>(${esc(s.dietary)})</i>` : ""}` : "—"}</span>` +
            `<span class="meal">${esc(s.meal || "")}</span></div>`,
        )
        .join("");
      return `<div class="tbl"><h2>${esc(t.label)}<span>${filled} / ${t.seats.length}</span></h2>${rows}</div>`;
    })
    .join("");

  const everyone = tables
    .flatMap((t) => t.seats.filter((s) => s.name).map((s) => ({ name: s.name, table: t.label })))
    .sort((a, b) => surnameKey(a.name).localeCompare(surnameKey(b.name)));
  const findRows = everyone.map((p) => `<div><span>${esc(p.name)}</span><b>${esc(p.table)}</b></div>`).join("");

  const body =
    `<section class="pad"><h1>Seating list</h1><p class="sub">${subtitle(meta)}</p><div class="grid">${tableCards}</div></section>` +
    `<section class="pad" style="break-before:page;page-break-before:always"><h1>Find your table</h1><p class="sub">${subtitle(meta)}</p>` +
    `<div class="find">${findRows || "<p>No one is seated yet.</p>"}</div></section>`;
  return documentHtml(`${meta?.eventName || "Event"} — seating list`, paper, css, body, { flow: true });
}

// Tent place cards, 4-up (2 × 2), folded across the middle: the top half prints upside down so the card reads from both sides.
export function buildPlaceCardsHtml({ meta, cards, paper = "a4", showMeal = true }) {
  const p = paperOf(paper);
  const w = p.wMm / 2;
  const h = p.hMm / 2;
  const css = [
    `.sheet{display:grid;grid-template-columns:repeat(2,${w}mm);grid-template-rows:repeat(2,${h}mm)}`,
    ".card{position:relative;border:0.2mm dashed #d4d4d8;display:grid;grid-template-rows:1fr 1fr}",
    ".half{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6mm 8mm;gap:2mm}",
    ".half.top{transform:rotate(180deg)}",
    ".fold{position:absolute;left:4mm;right:4mm;top:50%;border-top:0.2mm dotted #a1a1aa}",
    ".name{font-size:20pt;font-weight:600;line-height:1.15;font-family:Georgia,'Times New Roman',serif}",
    ".table{font-size:11pt;color:#52525b;letter-spacing:.04em;text-transform:uppercase}",
    ".meal{font-size:8pt;color:#71717a}",
    ".event{font-size:8pt;color:#a1a1aa}",
  ].join("");
  const face = (c, cls) =>
    `<div class="half ${cls}"><div class="name">${esc(c.name)}</div><div class="table">${esc(c.table || "")}</div>` +
    (showMeal && c.meal ? `<div class="meal">${esc(c.meal)}${c.dietary ? ` · ${esc(c.dietary)}` : ""}</div>` : "") +
    (meta?.eventName ? `<div class="event">${esc(meta.eventName)}</div>` : "") +
    `</div>`;
  const pages = chunk(cards, 4)
    .map(
      (group) =>
        `<div class="page"><div class="sheet">${group
          .map((c) => `<div class="card">${face(c, "top")}${face(c, "bottom")}<span class="fold"></span></div>`)
          .join("")}</div></div>`,
    )
    .join("");
  return documentHtml(`${meta?.eventName || "Event"} — place cards`, paper, css, pages || '<div class="page"></div>');
}

// Table number signs: one tent sign per sheet, folded across the middle.
export function buildTableSignsHtml({ meta, tables, paper = "a4" }) {
  const css = [
    ".page{display:grid;grid-template-rows:1fr 1fr}",
    ".half{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4mm;text-align:center;padding:10mm}",
    ".half.top{transform:rotate(180deg)}",
    ".word{font-size:16pt;letter-spacing:.3em;text-transform:uppercase;color:#71717a}",
    ".num{font-size:110pt;font-weight:700;line-height:1;font-family:Georgia,'Times New Roman',serif}",
    ".num.long{font-size:48pt}",
    ".event{font-size:10pt;color:#a1a1aa}",
    ".fold{position:absolute;left:8mm;right:8mm;top:50%;border-top:0.2mm dotted #a1a1aa}",
  ].join("");
  const face = (t, cls) => {
    const numeric = /^Table (\d+)$/.exec(t.label);
    const big = numeric ? numeric[1] : t.label;
    return (
      `<div class="half ${cls}">${numeric ? '<div class="word">Table</div>' : ""}` +
      `<div class="num${String(big).length > 3 ? " long" : ""}">${esc(big)}</div>` +
      (meta?.eventName ? `<div class="event">${esc(meta.eventName)}</div>` : "") +
      `</div>`
    );
  };
  const pages = tables.map((t) => `<div class="page">${face(t, "top")}${face(t, "bottom")}<span class="fold"></span></div>`).join("");
  return documentHtml(`${meta?.eventName || "Event"} — table signs`, paper, css, pages || '<div class="page"></div>');
}

// Caterer summary: meals per table (columns = every meal on the chart) with dietary notes, and totals.
export function buildCatererSummaryHtml({ meta, tables, paper = "a4" }) {
  const meals = [...new Set(tables.flatMap((t) => t.meals.map((m) => m.meal)).filter(Boolean))].sort();
  const hasNone = tables.some((t) => t.meals.some((m) => !m.meal));
  const cols = [...meals, ...(hasNone ? [""] : [])];
  const count = (t, meal) => t.meals.find((m) => m.meal === meal)?.count || 0;
  const css = [
    "h1{font-size:18pt;margin:0}",
    ".sub{font-size:9pt;color:#71717a;margin:2mm 0 6mm}",
    "table{width:100%;border-collapse:collapse;font-size:9pt}",
    "th,td{border-bottom:0.2mm solid #e4e4e7;padding:1.6mm 2mm;text-align:left;vertical-align:top}",
    "th{font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#71717a}",
    "td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}",
    "tfoot td{font-weight:700;border-top:0.4mm solid #18181b}",
    ".diet{color:#52525b}",
  ].join("");
  const head = `<tr><th>Table</th>${cols.map((m) => `<th class="n">${esc(m || "No choice")}</th>`).join("")}<th class="n">Guests</th><th>Dietary &amp; access</th></tr>`;
  const rows = tables
    .map((t) => {
      const total = t.meals.reduce((s, m) => s + m.count, 0);
      const diet = t.dietary.map((d) => `${esc(d.name)}: ${esc(d.note)}`).join("<br>");
      return `<tr><td>${esc(t.label)}</td>${cols.map((m) => `<td class="n">${count(t, m) || ""}</td>`).join("")}<td class="n">${total}</td><td class="diet">${diet}</td></tr>`;
    })
    .join("");
  const totals = cols.map((m) => tables.reduce((s, t) => s + count(t, m), 0));
  const grand = tables.reduce((s, t) => s + t.meals.reduce((x, m) => x + m.count, 0), 0);
  const foot = `<tr><td>Total</td>${totals.map((n) => `<td class="n">${n}</td>`).join("")}<td class="n">${grand}</td><td></td></tr>`;
  const body =
    `<section class="pad"><h1>Caterer summary</h1><p class="sub">${subtitle(meta)}</p>` +
    `<table><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></section>`;
  return documentHtml(`${meta?.eventName || "Event"} — caterer summary`, paper, css, body, { flow: true });
}
