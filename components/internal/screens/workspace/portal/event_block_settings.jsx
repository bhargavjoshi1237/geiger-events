"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, IconPicker, Input, Textarea } from "@geiger/ui";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { toKebab } from "../state/format";
import { Choice, Row, TextInput, Toggle } from "./inspector_controls";

const pagesOf = (ctx) => ctx.pages.filter((page) => page.kind === "page");

// Up to four buttons that open a portal page or a website (Buttons and Welcome blocks).
export function ButtonItemsEditor({ ctx, items = [], onChange }) {
  const update = (index, patch) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Input className="h-8" value={item.label ?? ""} maxLength={40} placeholder="Label" onChange={(e) => update(index, { label: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <SegmentedTabs className="w-auto" value={item.kind ?? "page"} onChange={(kind) => update(index, { kind, target: "" })} tabs={[{ label: "Page", value: "page" }, { label: "Website", value: "url" }]} />
          {item.kind === "url" ? <TextInput value={item.target} maxLength={500} placeholder="https://… or mailto:…" onChange={(target) => update(index, { target })} />
            : <Choice value={item.target || null} options={pagesOf(ctx).map((page) => ({ value: page.slug, label: page.title }))} placeholder="Choose a page" onChange={(target) => update(index, { target })} />}
          <SegmentedTabs className="w-auto" value={item.style ?? "primary"} onChange={(style) => update(index, { style })} tabs={[{ label: "Solid", value: "primary" }, { label: "Outline", value: "outline" }]} />
        </div>
      ))}
      {items.length < 4 ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...items, { label: "Open", kind: "page", target: "", style: items.length ? "outline" : "primary" }])}>
          <Plus className="h-4 w-4" />Add button
        </Button>
      ) : null}
    </>
  );
}

// Icon, caption and value rows (Welcome and Details blocks).
function FactItemsEditor({ items = [], onChange }) {
  const update = (index, patch) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <IconPicker value={item.icon} onValueChange={(icon) => update(index, { icon: toKebab(icon) })} className="h-8 w-auto shrink-0" />
            <Input className="h-8" value={item.label ?? ""} maxLength={60} placeholder="Caption, e.g. When" onChange={(e) => update(index, { label: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <Input className="h-8" value={item.value ?? ""} maxLength={200} placeholder="Mon 8 – Wed 10 December" onChange={(e) => update(index, { value: e.target.value })} />
        </div>
      ))}
      {items.length < 8 ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...items, { icon: "info", label: "", value: "" }])}><Plus className="h-4 w-4" />Add a detail</Button>
      ) : null}
    </>
  );
}

export function HeroSettings({ ctx, config, set }) {
  return (
    <>
      <Row label="Heading" hint="Use {{event.name}} or {{person.name}}."><TextInput value={config.heading} maxLength={160} onChange={(heading) => set({ ...config, heading })} /></Row>
      <Row label="Text"><Textarea rows={4} value={config.text ?? ""} maxLength={1000} onChange={(e) => set({ ...config, text: e.target.value })} /></Row>
      <Toggle label="Count down to the event" hint="“Starts in 23 days”, from the event's date." checked={config.badge !== "none"} onChange={(on) => set({ ...config, badge: on ? "countdown" : "none" })} />
      <Row label="Cover image" hint="Optional: an https:// link to a wide photo."><TextInput value={config.image} maxLength={2000} placeholder="https://…" onChange={(image) => set({ ...config, image })} /></Row>
      <Row label="Buttons"><ButtonItemsEditor ctx={ctx} items={config.buttons ?? []} onChange={(buttons) => set({ ...config, buttons })} /></Row>
      <Row label="Key facts" hint="Shown beside the heading."><FactItemsEditor items={config.facts ?? []} onChange={(facts) => set({ ...config, facts })} /></Row>
    </>
  );
}

export function NoticeSettings({ config, set, TextEditor }) {
  return (
    <>
      <Row label="Icon"><IconPicker value={config.icon} onValueChange={(icon) => set({ ...config, icon: toKebab(icon) })} /></Row>
      <TextEditor config={config} set={set} align={false} />
    </>
  );
}

export function FactsSettings({ config, set }) {
  return (
    <>
      <Row label="Title"><TextInput value={config.title} onChange={(title) => set({ ...config, title })} /></Row>
      <Row label="Details"><FactItemsEditor items={config.items ?? []} onChange={(items) => set({ ...config, items })} /></Row>
    </>
  );
}

export function DatesSettings({ config, set }) {
  const items = config.items ?? [];
  const update = (index, patch) => set({ ...config, items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  return (
    <>
      <Row label="Title"><TextInput value={config.title} onChange={(title) => set({ ...config, title })} /></Row>
      <Row label="Dates" hint="The next one is highlighted. Leave the note empty to show “In 5 days”.">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2">
              <Input type="date" className="h-8" value={item.date ?? ""} onChange={(e) => update(index, { date: e.target.value })} />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Remove" onClick={() => set({ ...config, items: items.filter((_, i) => i !== index) })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Input className="h-8" value={item.label ?? ""} maxLength={120} placeholder="Poster submissions close" onChange={(e) => update(index, { label: e.target.value })} />
            <Input className="h-8" value={item.note ?? ""} maxLength={120} placeholder="Note (optional)" onChange={(e) => update(index, { note: e.target.value })} />
          </div>
        ))}
        {items.length < 12 ? (
          <Button type="button" variant="outline" size="sm" className="justify-self-start"
            onClick={() => set({ ...config, items: [...items, { date: new Date().toISOString().slice(0, 10), label: "", note: "" }] })}><Plus className="h-4 w-4" />Add a date</Button>
        ) : null}
      </Row>
    </>
  );
}

// How a schedule shows: the day grid, a day-by-day agenda, or every day side by side.
export function ScheduleViewSettings({ ctx, config, set }) {
  const view = config.view ?? "grid";
  return (
    <>
      <Row label="Show as" hint={view === "agenda" ? "Every day as a list, with day tabs, filters for the choice fields below and search." : view === "glance" ? "Every day side by side, for a home page." : "One day at a time, rooms or tracks as columns."}>
        <SegmentedTabs fullWidth value={view} onChange={(next) => set({ ...config, view: next })} tabs={[{ label: "Grid", value: "grid" }, { label: "Agenda", value: "agenda" }, { label: "Glance", value: "glance" }]} />
      </Row>
      {view === "glance" ? (
        <Row label="Link to the full programme" hint="Optional: a button in the corner.">
          <Choice value={config.more?.page ?? null} allowNone noneLabel="No link" options={pagesOf(ctx).map((page) => ({ value: page.slug, label: page.title }))}
            onChange={(page) => set({ ...config, more: page ? { label: config.more?.label || "Full programme", page } : null })} />
          {config.more?.page ? <TextInput value={config.more.label} maxLength={40} placeholder="Full programme" onChange={(label) => set({ ...config, more: { ...config.more, label } })} /> : null}
        </Row>
      ) : null}
    </>
  );
}
