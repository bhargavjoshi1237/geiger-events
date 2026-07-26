"use client";

import { passSvg, resolveTemplate } from "@/lib/passes/render";
import { sheetGrid } from "@/lib/passes/stock";

// Builds the print sheet: attendees grouped by the template their tier resolves
// to, each group laid out on its own paginated grid. Named @page rules let two
// templates with different page sizes print in one job; browsers that don't
// support them fall back to the default page size, which still prints.

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]),
  );

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

// [{ template, attendees }] in template order, skipping templates nobody uses.
export function groupByTemplate(templates, attendees) {
  const groups = new Map();
  for (const attendee of attendees) {
    const template = resolveTemplate(templates, attendee.tier);
    if (!template) continue;
    if (!groups.has(template.id)) groups.set(template.id, { template, attendees: [] });
    groups.get(template.id).attendees.push(attendee);
  }
  return [...groups.values()];
}

const CROP_MARKS =
  '<span class="cm h" style="left:-4mm;top:-0.1mm"></span>' +
  '<span class="cm v" style="left:-0.1mm;top:-4mm"></span>' +
  '<span class="cm h" style="right:-4mm;top:-0.1mm"></span>' +
  '<span class="cm v" style="right:-0.1mm;top:-4mm"></span>' +
  '<span class="cm h" style="left:-4mm;bottom:-0.1mm"></span>' +
  '<span class="cm v" style="left:-0.1mm;bottom:-4mm"></span>' +
  '<span class="cm h" style="right:-4mm;bottom:-0.1mm"></span>' +
  '<span class="cm v" style="right:-0.1mm;bottom:-4mm"></span>';

export function buildPrintDocument({ templates, event, attendees, qrSettings }) {
  const groups = groupByTemplate(templates, attendees);
  const pageRules = [];
  const sheets = [];

  groups.forEach((group, index) => {
    const grid = sheetGrid(group.template.sheet, group.template.stock);
    const pageName = `pg${index}`;
    pageRules.push(
      `@page ${pageName}{size:${grid.page.wMm}mm ${grid.page.hMm}mm;margin:0}` +
        `.${pageName}{page:${pageName};width:${grid.page.wMm}mm;height:${grid.page.hMm}mm;padding:${grid.margin}mm}`,
    );

    const cropMarks = group.template.sheet?.cropMarks ? CROP_MARKS : "";
    for (const page of chunk(group.attendees, grid.perPage)) {
      const cells = page
        .map(
          (attendee) =>
            `<div class="cell">${cropMarks}${passSvg(group.template, {
              event,
              attendee,
              qrSettings,
              logoHref: group.template.logoUrl || "",
            })}</div>`,
        )
        .join("");
      sheets.push(
        `<div class="sheet ${pageName}">` +
          `<div class="grid" style="grid-template-columns:repeat(${grid.cols},${grid.wMm}mm);` +
          `gap:${grid.gutter}mm">${cells}</div></div>`,
      );
    }
  });

  const css = [
    "*{box-sizing:border-box}",
    "body{margin:0;background:#fff}",
    ".sheet{break-after:page;page-break-after:always}",
    ".sheet:last-child{break-after:auto;page-break-after:auto}",
    ".grid{display:grid;justify-content:start;align-content:start}",
    ".cell{position:relative;break-inside:avoid;page-break-inside:avoid}",
    ".cell>svg{display:block}",
    ".cm{position:absolute;background:#999}",
    ".cm.h{width:3mm;height:.2mm}",
    ".cm.v{width:.2mm;height:3mm}",
    "@media screen{body{background:#e5e5e5;padding:8mm}.sheet{background:#fff;margin:0 auto 8mm;box-shadow:0 1px 6px rgba(0,0,0,.2)}}",
    ...pageRules,
  ].join("");

  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<title>${escapeHtml(event?.name || "Passes")} — passes</title>` +
    `<style>${css}</style></head><body>${sheets.join("")}` +
    `<script>window.onload=function(){window.print()}</script></body></html>`
  );
}

// Opens the print sheet in a new tab. Returns an error string when the browser
// blocked the pop-up, so the screen can toast it.
export function printPasses(args) {
  const win = window.open("", "_blank");
  if (!win) return "Allow pop-ups to open the print sheet.";
  win.document.write(buildPrintDocument(args));
  win.document.close();
  return null;
}
