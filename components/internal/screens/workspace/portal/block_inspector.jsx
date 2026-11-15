"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Heading3, Italic, Link2, List, Pilcrow, Plus, Trash2, X } from "lucide-react";
import { Button, Checkbox, Input, Label, Textarea } from "@geiger/ui";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { defaultBlockConfig } from "@/lib/workspace/portal/blocks.js";
import { TOKENS } from "@/lib/workspace/portal/contracts.js";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { localInputToUtc, utcToLocalInput } from "../state/format";
import { Choice, FieldChoice, FieldList, fieldsOf, ListChoice, Row, RuleField, SortField, TextInput, Toggle } from "./inspector_controls";
import { ButtonItemsEditor, DatesSettings, FactsSettings, HeroSettings, NoticeSettings, ScheduleViewSettings } from "./event_block_settings";

const EXPOSABLE = new Set(["single_select", "multi_select", "checkbox", "date", "datetime", "short_text", "email", "number"]);
const numeric = (field) => getType(field.type).cast === "numeric" || field.type === "rollup" || (field.type === "formula" && field.config.result === "number");
const editable = (field) => getType(field.type).editable && field.type !== "link_event";

// Settings shared by the list blocks (table, cards, board, calendar): which list, its filter and sort.
function SourceSettings({ ctx, config, set, kind }) {
  const objectId = config.source?.objectId;
  const changeList = (next) => set({ ...defaultBlockConfig(kind, { definition: ctx.ws.data, objectId: next, pageKind: ctx.page.kind }), title: config.title });
  return (
    <>
      <Row label="List"><ListChoice ws={ctx.ws} value={objectId} onChange={changeList} /></Row>
      {objectId ? (
        <>
          <RuleField ws={ctx.ws} objectId={objectId} value={config.source?.filter ?? null} eventId={ctx.eventId} tokens={ctx.tokens}
            hint="On top of what the viewer's roles allow." onChange={(filter) => set({ ...config, source: { ...config.source, filter } })} />
          {!["board", "calendar", "schedule", "timeline", "placement"].includes(kind) ? (
            <SortField ws={ctx.ws} objectId={objectId} value={config.source?.sort ?? []} onChange={(sort) => set({ ...config, source: { ...config.source, sort } })} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ListExtras({ ctx, config, set, cards = false }) {
  const objectId = config.source?.objectId;
  if (!objectId) return null;
  return (
    <>
      <Toggle label="Search box" checked={config.search} onChange={(search) => set({ ...config, search })} />
      <Row label="Filters people can use" hint="Up to four. Only fields every one of their roles can see are offered.">
        <FieldList ws={ctx.ws} objectId={objectId} value={config.filters ?? []} max={4} allowStatus addLabel="Add filter"
          test={(field) => EXPOSABLE.has(field.type)} onChange={(filters) => set({ ...config, filters })} />
      </Row>
      <Row label="Per page">
        <Choice value={String(config.pageSize ?? (cards ? 12 : 20))} onChange={(value) => set({ ...config, pageSize: Number(value) })}
          options={[6, 10, 12, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))} />
      </Row>
      <Toggle label="Open records" hint="Clicking a record opens its page." checked={config.open} onChange={(open) => set({ ...config, open })} />
      <Row label="When empty"><TextInput value={config.emptyText} maxLength={200} placeholder="Nothing here yet." onChange={(emptyText) => set({ ...config, emptyText })} /></Row>
    </>
  );
}

function TableSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  return (
    <>
      <SourceSettings {...props} kind="table" />
      {objectId ? <Row label="Columns"><FieldList ws={ctx.ws} objectId={objectId} value={config.columns ?? []} allowStatus onChange={(columns) => set({ ...config, columns })} /></Row> : null}
      <ListExtras {...props} />
    </>
  );
}

function CardsSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  return (
    <>
      <SourceSettings {...props} kind="cards" />
      {objectId ? (
        <>
          <Row label="Cover image"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.cover} allowNone noneLabel="No cover" test={(field) => field.type === "attachments"} onChange={(cover) => set({ ...config, cover })} /></Row>
          <Row label="On each card"><FieldList ws={ctx.ws} objectId={objectId} value={config.fields ?? []} max={6} allowStatus onChange={(fields) => set({ ...config, fields })} /></Row>
          <Row label="Cards per row"><SegmentedTabs className="w-auto" value={String(config.columns ?? 3)} onChange={(value) => set({ ...config, columns: Number(value) })} tabs={["1", "2", "3"]} /></Row>
        </>
      ) : null}
      <ListExtras {...props} cards />
    </>
  );
}

function BoardSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  return (
    <>
      <SourceSettings {...props} kind="board" />
      {objectId ? (
        <>
          <Row label="Columns from" hint="People who may change this value can drag cards between columns.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.groupBy ?? "status"} allowStatus test={(field) => field.type === "single_select"} onChange={(groupBy) => set({ ...config, groupBy })} />
          </Row>
          <Row label="On each card"><FieldList ws={ctx.ws} objectId={objectId} value={config.fields ?? []} max={4} onChange={(fields) => set({ ...config, fields })} /></Row>
          <Toggle label="Open records" checked={config.open} onChange={(open) => set({ ...config, open })} />
        </>
      ) : null}
    </>
  );
}

function CalendarSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  const dates = (field) => field.type === "date" || field.type === "datetime";
  return (
    <>
      <SourceSettings {...props} kind="calendar" />
      {objectId ? (
        <>
          <Row label="Date"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.dateField} test={dates} onChange={(dateField) => set({ ...config, dateField })} /></Row>
          <Row label="Ends" hint="Optional, for things that span several days."><FieldChoice ws={ctx.ws} objectId={objectId} value={config.endField} allowNone test={dates} onChange={(endField) => set({ ...config, endField })} /></Row>
          <Row label="Opens on"><SegmentedTabs className="w-auto" value={config.view ?? "month"} onChange={(view) => set({ ...config, view })} tabs={[{ label: "Month", value: "month" }, { label: "Week", value: "week" }]} /></Row>
          <StartDate config={config} set={set} />
          <Toggle label="Open records" checked={config.open} onChange={(open) => set({ ...config, open })} />
        </>
      ) : null}
    </>
  );
}

// Where a calendar, schedule or timeline opens: today, the earliest record, or a fixed day.
function StartDate({ config, set }) {
  const mode = config.startDate === "first" ? "first" : config.startDate ? "date" : "today";
  return (
    <Row label="Starts at">
      <SegmentedTabs className="w-auto" value={mode} onChange={(next) => set({ ...config, startDate: next === "first" ? "first" : next === "date" ? new Date().toISOString().slice(0, 10) : null })}
        tabs={[{ label: "Today", value: "today" }, { label: "First record", value: "first" }, { label: "A date", value: "date" }]} />
      {mode === "date" ? <Input type="date" value={config.startDate} onChange={(e) => set({ ...config, startDate: e.target.value || null })} /> : null}
    </Row>
  );
}

const dateTime = (field) => field.type === "datetime";
const dated = (field) => field.type === "date" || field.type === "datetime";

function ScheduleSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  return (
    <>
      <SourceSettings {...props} kind="schedule" />
      {objectId ? (
        <>
          <Row label="Starts"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.startField} test={dateTime} onChange={(startField) => set({ ...config, startField })} /></Row>
          <Row label="Ends" hint="Or a duration. Without either, items last 30 minutes."><FieldChoice ws={ctx.ws} objectId={objectId} value={config.endField} allowNone noneLabel="No end field" test={dateTime} onChange={(endField) => set({ ...config, endField })} /></Row>
          {!config.endField ? <Row label="Duration"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.durationField} allowNone noneLabel="No duration field" test={(field) => field.type === "duration"} onChange={(durationField) => set({ ...config, durationField })} /></Row> : null}
          <Row label="Columns by" hint="A room, track or venue space. People who can change it can drag items between columns.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.laneField} allowNone noneLabel="One column"
              test={(field) => field.type === "single_select" || field.type === "link_record" || (field.type === "link_event" && field.config?.target === "venue_space")} onChange={(laneField) => set({ ...config, laneField })} />
          </Row>
          <Row label="Flag a person in two places" hint="Optional: the link field that holds speakers or staff.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.peopleField} allowNone noneLabel="Don't check" test={(field) => field.type === "link_record"} onChange={(peopleField) => set({ ...config, peopleField })} />
          </Row>
          <ScheduleViewSettings ctx={ctx} config={config} set={set} />
          <Row label="On each item" hint={config.view === "agenda" || config.view === "glance" ? "The first shows with a coloured dot, the second as a tag. Choice fields become filters." : undefined}>
            <FieldList ws={ctx.ws} objectId={objectId} value={config.fields ?? []} max={3} onChange={(fields) => set({ ...config, fields })} />
          </Row>
          <StartDate config={config} set={set} />
          <Row label={config.view === "agenda" || config.view === "glance" ? "Days" : "Days at a time"}><Choice value={String(config.days ?? 3)} onChange={(days) => set({ ...config, days: Number(days) })} options={[1, 2, 3, 4, 5, 7, 10, 14].map((n) => ({ value: String(n), label: String(n) }))} /></Row>
          <Toggle label="Open records" checked={config.open} onChange={(open) => set({ ...config, open })} />
        </>
      ) : null}
    </>
  );
}

function TimelineSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  return (
    <>
      <SourceSettings {...props} kind="timeline" />
      {objectId ? (
        <>
          <Row label="Starts"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.startField} test={dated} onChange={(startField) => set({ ...config, startField })} /></Row>
          <Row label="Ends"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.endField} allowNone noneLabel="No end field" test={dated} onChange={(endField) => set({ ...config, endField })} /></Row>
          <Row label="Rows by"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.groupBy} allowStatus allowNone noneLabel="One row" test={(field) => field.type === "single_select" || field.type === "link_record"} onChange={(groupBy) => set({ ...config, groupBy })} /></Row>
          <Row label="Opens on"><SegmentedTabs className="w-auto" value={config.scale ?? "week"} onChange={(scale) => set({ ...config, scale })} tabs={[{ label: "Day", value: "day" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }]} /></Row>
          <StartDate config={config} set={set} />
          <Toggle label="Open records" checked={config.open} onChange={(open) => set({ ...config, open })} />
        </>
      ) : null}
    </>
  );
}

function PlacementSettings(props) {
  const { ctx, config, set } = props;
  const objectId = config.source?.objectId;
  const link = fieldsOf(ctx.ws, objectId).find((field) => field.id === config.linkField);
  const placesId = link?.config?.targetObjectId ?? null;
  const choice = (field) => field.type === "single_select" || field.type === "multi_select";
  return (
    <>
      <SourceSettings {...props} kind="placement" />
      {objectId ? (
        <>
          <Row label="Placed through" hint="The link field that says where each item goes. Dragging changes it.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.linkField} test={(field) => field.type === "link_record"} onChange={(linkField) => set({ ...config, linkField, capacityField: null, startField: null, endField: null, match: null, placesFilter: null })} />
          </Row>
          {placesId ? (
            <>
              <RuleField ws={ctx.ws} objectId={placesId} value={config.placesFilter ?? null} eventId={ctx.eventId} tokens={ctx.tokens} label="Only these places" onChange={(placesFilter) => set({ ...config, placesFilter })} />
              <Row label="Capacity"><FieldChoice ws={ctx.ws} objectId={placesId} value={config.capacityField} allowNone noneLabel="No limit" test={numeric} onChange={(capacityField) => set({ ...config, capacityField })} /></Row>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Place starts"><FieldChoice ws={ctx.ws} objectId={placesId} value={config.startField} allowNone noneLabel="Not timed" test={dateTime} onChange={(startField) => set({ ...config, startField })} /></Row>
                <Row label="Place ends"><FieldChoice ws={ctx.ws} objectId={placesId} value={config.endField} allowNone noneLabel="Not timed" test={dateTime} onChange={(endField) => set({ ...config, endField })} /></Row>
              </div>
              <Row label="Auto-place matching" hint="Optional: only place items whose choice matches the place's, like track or skill.">
                <div className="grid grid-cols-2 gap-2">
                  <FieldChoice ws={ctx.ws} objectId={objectId} value={config.match?.itemField} allowNone noneLabel="Item: any" test={choice} onChange={(itemField) => set({ ...config, match: itemField ? { itemField, placeField: config.match?.placeField ?? null } : null })} />
                  <FieldChoice ws={ctx.ws} objectId={placesId} value={config.match?.placeField} allowNone noneLabel="Place: any" test={choice} onChange={(placeField) => set({ ...config, match: config.match?.itemField && placeField ? { ...config.match, placeField } : null })} />
                </div>
              </Row>
            </>
          ) : null}
          <Row label="On each item"><FieldList ws={ctx.ws} objectId={objectId} value={config.fields ?? []} max={3} onChange={(fields) => set({ ...config, fields })} /></Row>
          <Toggle label="Auto-place button" hint="Fills open capacity in order." checked={config.autoPlace !== false} onChange={(autoPlace) => set({ ...config, autoPlace })} />
          <Toggle label="Open records" checked={config.open} onChange={(open) => set({ ...config, open })} />
        </>
      ) : null}
    </>
  );
}

function ScannerSettings({ ctx, config, set }) {
  const objectId = config.objectId;
  const links = (field) => field.type === "link_record";
  const context = fieldsOf(ctx.ws, objectId).find((field) => field.id === config.contextField);
  const onRecordPage = ctx.page.kind === "record" && context?.config?.targetObjectId === ctx.page.objectId;
  return (
    <>
      <Row label="Record attendance in"><ListChoice ws={ctx.ws} value={objectId} onChange={(next) => set({ ...defaultBlockConfig("scanner", { definition: ctx.ws.data, objectId: next, pageKind: ctx.page.kind }), title: config.title })} /></Row>
      {objectId ? (
        <>
          <Row label="Who attended" hint="Passes and tickets are matched to this list: by a linked ticket, or the same email.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.personField} test={links} onChange={(personField) => set({ ...config, personField })} />
          </Row>
          <Row label="For what (optional)" hint="Like a session: one attendance record per person for each.">
            <FieldChoice ws={ctx.ws} objectId={objectId} value={config.contextField} allowNone noneLabel="Once per person" test={links} onChange={(contextField) => set({ ...config, contextField, context: contextField ? "choose" : "none" })} />
          </Row>
          {config.contextField ? (
            <Row label="Choose it">
              <SegmentedTabs className="w-auto" value={onRecordPage && config.context === "page" ? "page" : "choose"} onChange={(value) => set({ ...config, context: value })}
                tabs={[...(onRecordPage ? [{ label: "This record", value: "page" }] : []), { label: "From a list", value: "choose" }]} />
            </Row>
          ) : null}
          <Row label="Time of check-in"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.timeField} allowNone noneLabel="Not recorded" test={dateTime} onChange={(timeField) => set({ ...config, timeField })} /></Row>
          <Toggle label="Camera scanning" checked={config.camera !== false} onChange={(camera) => set({ ...config, camera })} />
          <Toggle label="Find by name" checked={config.search !== false} onChange={(search) => set({ ...config, search })} />
        </>
      ) : null}
    </>
  );
}

// Organiser code: HTML, CSS and JavaScript tabs, an optional list the code can read, and the frame height.
function CustomSettings({ ctx, config, set }) {
  const [tab, setTab] = useState("html");
  const objectId = config.source?.objectId ?? null;
  return (
    <>
      <SegmentedTabs className="w-auto" value={tab} onChange={setTab} tabs={[{ label: "HTML", value: "html" }, { label: "CSS", value: "css" }, { label: "JavaScript", value: "js" }]} />
      <Textarea key={tab} rows={14} spellCheck={false} wrap="off" className="font-mono text-xs" value={config[tab] ?? ""} aria-label={tab.toUpperCase()}
        onChange={(e) => set({ ...config, [tab]: e.target.value })} />
      <p className="text-xs text-text-tertiary">
        Runs sandboxed: no cookies, no network (scripts and styles may load from cdnjs or jsDelivr). Use <code>await geiger.data({"{ search, offset }"})</code> for the
        rows this viewer may see, <code>geiger.openRecord(id)</code>, <code>geiger.navigate(&quot;page-address&quot;)</code> and <code>geiger.resize(px)</code>.
      </p>
      <Row label="Reads records from">
        <Choice value={objectId} allowNone noneLabel="No list" options={ctx.ws.objects.map((object) => ({ value: object.id, label: object.plural }))}
          onChange={(next) => set({ ...config, source: next ? { objectId: next, filter: null, sort: [] } : null })} />
      </Row>
      {objectId ? (
        <RuleField ws={ctx.ws} objectId={objectId} value={config.source?.filter ?? null} eventId={ctx.eventId} tokens={ctx.tokens}
          hint="On top of what the viewer's roles allow." onChange={(filter) => set({ ...config, source: { ...config.source, filter } })} />
      ) : null}
      <Row label="Height (px)" hint="The frame also grows to fit its content."><Input type="number" min={80} max={2000} value={config.height ?? 320} onChange={(e) => set({ ...config, height: Number(e.target.value) || 320 })} /></Row>
      <Toggle label="Show in a card" checked={config.frame !== false} onChange={(frame) => set({ ...config, frame })} />
    </>
  );
}

function PassSettings({ config, set }) {
  return (
    <>
      <Row label="Instructions"><TextInput value={config.text} maxLength={500} placeholder="Show this at the door." onChange={(text) => set({ ...config, text })} /></Row>
      <p className="text-xs text-text-tertiary">Each signed-in person sees a QR code for their own record in the people list. Scanner blocks accept it.</p>
    </>
  );
}

function Sections({ ctx, objectId, sections, onChange, form = false }) {
  const update = (index, patch) => onChange(sections.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  return (
    <div className="grid gap-3">
      {sections.map((section, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Input className="h-8" value={section.title ?? ""} maxLength={120} placeholder={`Section ${index + 1} title`} onChange={(e) => update(index, { title: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Remove section" onClick={() => onChange(sections.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {form ? <Textarea rows={2} value={section.description ?? ""} maxLength={1000} placeholder="Help text (optional)" onChange={(e) => update(index, { description: e.target.value })} /> : null}
          {form ? (
            <FormFields ctx={ctx} objectId={objectId} items={section.fields ?? []} onChange={(fields) => update(index, { fields })} />
          ) : (
            <FieldList ws={ctx.ws} objectId={objectId} value={section.fields ?? []} onChange={(fields) => update(index, { fields })} />
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...sections, { title: "", fields: [] }])}>
        <Plus className="h-4 w-4" />Add section
      </Button>
    </div>
  );
}

// Form questions: which fields, required, and help text for each.
function FormFields({ ctx, objectId, items, onChange, test = editable }) {
  const byId = new Map(fieldsOf(ctx.ws, objectId).map((field) => [field.id, field]));
  const ids = items.map((item) => item.fieldId).filter((id) => byId.has(id));
  return (
    <div className="grid gap-1.5">
      <FieldList ws={ctx.ws} objectId={objectId} value={ids} test={test} addLabel="Add question"
        onChange={(next) => onChange(next.map((id) => items.find((item) => item.fieldId === id) ?? { fieldId: id, required: byId.get(id)?.required ?? false, help: "" }))} />
      {ids.length ? (
        <details className="rounded-md border border-border px-2.5 py-1.5 text-xs">
          <summary className="cursor-pointer text-text-secondary">Required answers and help text</summary>
          <div className="mt-2 grid gap-2">
            {items.filter((item) => byId.has(item.fieldId)).map((item) => (
              <div key={item.fieldId} className="grid gap-1">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={item.required} onCheckedChange={(on) => onChange(items.map((x) => (x.fieldId === item.fieldId ? { ...x, required: on === true } : x)))} />
                  {byId.get(item.fieldId).name} is required
                </label>
                <Input className="h-8" value={item.help ?? ""} maxLength={300} placeholder="Help text"
                  onChange={(e) => onChange(items.map((x) => (x.fieldId === item.fieldId ? { ...x, help: e.target.value } : x)))} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function RecordSettings({ ctx, config, set }) {
  const objectId = config.objectId;
  const isRecordPage = ctx.page.kind === "record";
  return (
    <>
      <Row label="Shows">
        <SegmentedTabs className="w-auto" value={config.target ?? (isRecordPage ? "page" : "mine")}
          onChange={(target) => set({ ...config, target, objectId: target === "page" ? ctx.page.objectId : ctx.peopleId ?? objectId })}
          tabs={[...(isRecordPage ? [{ label: "This record", value: "page" }] : []), { label: "The viewer's own record", value: "mine" }]} />
      </Row>
      {config.target === "mine" ? <Row label="List"><ListChoice ws={ctx.ws} value={objectId} onChange={(next) => set({ ...config, objectId: next, sections: [] })} /></Row> : null}
      {objectId ? (
        <Row label="Sections" hint="Leave empty to show every field the viewer can see.">
          <Sections ctx={ctx} objectId={objectId} sections={config.sections ?? []} onChange={(sections) => set({ ...config, sections })} />
        </Row>
      ) : null}
      <Toggle label="Let people edit fields they're allowed to" checked={config.edit !== false} onChange={(edit) => set({ ...config, edit })} />
      <Toggle label="Comments" checked={config.comments} onChange={(comments) => set({ ...config, comments })} />
      <Toggle label="Their own activity" checked={config.activity} onChange={(activity) => set({ ...config, activity })} />
    </>
  );
}

// Automatic values a form fills in: the viewer, their email, today, this record, or a fixed value.
function Defaults({ ctx, objectId, value = [], onChange }) {
  const fields = fieldsOf(ctx.ws, objectId).filter(editable);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const tokensFor = (field) => [
    ...(field.type === "link_record" && field.config.targetObjectId === ctx.peopleId ? [{ value: TOKENS.me, label: "The person submitting" }] : []),
    ...(field.type === "link_record" && ctx.page.kind === "record" && field.config.targetObjectId === ctx.page.objectId ? [{ value: TOKENS.record, label: "This record" }] : []),
    ...(["email", "short_text"].includes(field.type) ? [{ value: TOKENS.myEmail, label: "Their email" }] : []),
    ...(field.type === "date" ? [{ value: TOKENS.today, label: "Today" }] : []),
  ];
  const tokenValue = (item) => (Array.isArray(item.value) ? item.value[0] : item.value);
  return (
    <div className="grid gap-2">
      {value.filter((item) => byId.has(item.fieldId)).map((item, index) => {
        const field = byId.get(item.fieldId);
        const tokens = tokensFor(field);
        const options = field.config?.options;
        return (
          <div key={item.fieldId} className="grid gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium text-foreground">{field.name}</span>
              <button type="button" aria-label="Remove" className="rounded p-1 text-text-tertiary hover:text-foreground" onClick={() => onChange(value.filter((_, i) => i !== index))}><X className="h-3.5 w-3.5" /></button></div>
            {tokens.length ? (
              <Choice value={tokenValue(item)} options={tokens} onChange={(next) => onChange(value.map((x, i) => (i === index ? { ...x, value: field.type === "link_record" ? [next] : next } : x)))} />
            ) : options ? (
              <Choice value={item.value} options={options.map((option) => ({ value: option.id, label: option.label }))} onChange={(next) => onChange(value.map((x, i) => (i === index ? { ...x, value: next } : x)))} />
            ) : field.type === "checkbox" ? (
              <Choice value={item.value ? "yes" : "no"} options={[{ value: "yes", label: "Checked" }, { value: "no", label: "Not checked" }]} onChange={(next) => onChange(value.map((x, i) => (i === index ? { ...x, value: next === "yes" } : x)))} />
            ) : (
              <Input className="h-8" value={item.value ?? ""} onChange={(e) => onChange(value.map((x, i) => (i === index ? { ...x, value: e.target.value } : x)))} />
            )}
          </div>
        );
      })}
      {fields.some((field) => !value.some((item) => item.fieldId === field.id)) ? (
        <Choice value={null} placeholder="Add an automatic value…" options={fields.filter((field) => !value.some((item) => item.fieldId === field.id)).map((field) => ({ value: field.id, label: field.name }))}
          onChange={(fieldId) => {
            const field = byId.get(fieldId);
            const first = tokensFor(field)[0]?.value;
            onChange([...value, { fieldId, value: first ? (field.type === "link_record" ? [first] : first) : field.type === "checkbox" ? true : field.config?.options?.[0]?.id ?? "" }]);
          }} />
      ) : null}
    </div>
  );
}

function FormSettings({ ctx, config, set }) {
  const objectId = config.objectId;
  const object = ctx.ws.objects.find((item) => item.id === objectId);
  const isRecordPage = ctx.page.kind === "record";
  const pages = ctx.pages.filter((page) => page.kind === "page");
  return (
    <>
      <Row label="Intro"><Textarea rows={3} maxLength={2000} value={config.intro ?? ""} onChange={(e) => set({ ...config, intro: e.target.value })} /></Row>
      <Row label="This form">
        <SegmentedTabs className="w-auto" value={config.mode ?? "create"} onChange={(mode) => set({ ...config, mode, target: mode === "edit" ? (isRecordPage ? "page" : "mine") : null, objectId: mode === "edit" && isRecordPage ? ctx.page.objectId : objectId })}
          tabs={[{ label: "Adds a record", value: "create" }, { label: "Edits a record", value: "edit" }]} />
      </Row>
      {config.mode === "edit" ? (
        <Row label="Edits">
          <SegmentedTabs className="w-auto" value={config.target ?? "mine"} onChange={(target) => set({ ...config, target, objectId: target === "page" ? ctx.page.objectId : ctx.peopleId ?? objectId })}
            tabs={[...(isRecordPage ? [{ label: "This record", value: "page" }] : []), { label: "The viewer's own record", value: "mine" }]} />
        </Row>
      ) : null}
      {config.mode !== "edit" || config.target === "mine" ? (
        <Row label="List"><ListChoice ws={ctx.ws} value={objectId} onChange={(next) => set({ ...defaultBlockConfig("form", { definition: ctx.ws.data, objectId: next, pageKind: ctx.page.kind }), mode: config.mode, target: config.target, title: config.title })} /></Row>
      ) : null}
      {objectId ? (
        <Row label="Questions"><Sections ctx={ctx} objectId={objectId} sections={config.sections ?? []} form onChange={(sections) => set({ ...config, sections })} /></Row>
      ) : null}
      <Toggle label="One section per step" checked={config.steps} onChange={(steps) => set({ ...config, steps })} />
      {config.mode !== "edit" && objectId ? (
        <>
          <Row label="Filled in automatically" hint="Not shown on the form. Use these to link a submission to the person sending it.">
            <Defaults ctx={ctx} objectId={objectId} value={config.defaults ?? []} onChange={(defaults) => set({ ...config, defaults })} />
          </Row>
          {object?.statuses?.length ? (
            <Row label="Status of new records"><Choice value={config.status} allowNone noneLabel="No status" options={object.statuses.map((status) => ({ value: status.key, label: status.label }))} onChange={(status) => set({ ...config, status })} /></Row>
          ) : null}
          <Toggle label="Save drafts as people type" checked={config.drafts !== false} onChange={(drafts) => set({ ...config, drafts })} />
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Row label="Opens"><Input type="datetime-local" value={utcToLocalInput(config.opensAt, ctx.timeZone)} onChange={(e) => set({ ...config, opensAt: localInputToUtc(e.target.value, ctx.timeZone) })} /></Row>
        <Row label="Closes"><Input type="datetime-local" value={utcToLocalInput(config.closesAt, ctx.timeZone)} onChange={(e) => set({ ...config, closesAt: localInputToUtc(e.target.value, ctx.timeZone) })} /></Row>
      </div>
      <Row label="Button"><TextInput value={config.submitLabel} maxLength={40} placeholder="Submit" onChange={(submitLabel) => set({ ...config, submitLabel })} /></Row>
      <Row label="After sending"><Textarea rows={2} maxLength={1000} value={config.success?.message ?? ""} placeholder="Thanks — we've received it." onChange={(e) => set({ ...config, success: { ...config.success, message: e.target.value } })} /></Row>
      <Row label="Then offer"><Choice value={config.success?.page ?? null} allowNone noneLabel="Nothing else" options={pages.map((page) => ({ value: page.slug, label: page.title }))} onChange={(page) => set({ ...config, success: { ...config.success, page } })} /></Row>
      {config.mode !== "edit" && ctx.page.audience?.public ? (
        <div className="grid gap-2 rounded-lg border border-border p-2.5">
          <Toggle label="New people can sign up here" hint="They confirm their email with a code, then join the people list." checked={config.signup?.enabled}
            onChange={(enabled) => set({ ...config, signup: { ...(config.signup ?? {}), enabled, objectId: ctx.peopleId, personFields: config.signup?.personFields ?? [] } })} />
          {config.signup?.enabled && ctx.peopleId ? (
            <Row label="Ask them for">
              <FormFields ctx={ctx} objectId={ctx.peopleId} items={config.signup.personFields ?? []} test={(field) => editable(field) && field.id !== ctx.emailFieldId}
                onChange={(personFields) => set({ ...config, signup: { ...config.signup, personFields } })} />
            </Row>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function StatsSettings({ ctx, config, set }) {
  const tiles = config.tiles ?? [];
  const update = (index, patch) => set({ ...config, tiles: tiles.map((tile, i) => (i === index ? { ...tile, ...patch } : tile)) });
  return (
    <div className="grid gap-3">
      {tiles.map((tile, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Input className="h-8" value={tile.label ?? ""} maxLength={60} placeholder="Label" onChange={(e) => update(index, { label: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Remove" disabled={tiles.length === 1} onClick={() => set({ ...config, tiles: tiles.filter((_, i) => i !== index) })}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <ListChoice ws={ctx.ws} value={tile.objectId} onChange={(objectId) => update(index, { objectId, fieldId: null, filter: null, part: null })} />
          <Choice value={tile.fn ?? "count"} onChange={(fn) => update(index, { fn })}
            options={[{ value: "count", label: "Count" }, { value: "sum", label: "Total of" }, { value: "avg", label: "Average of" }, { value: "min", label: "Lowest" }, { value: "max", label: "Highest" }, { value: "percent", label: "Percentage that match" }]} />
          {["sum", "avg", "min", "max"].includes(tile.fn) && tile.objectId ? <FieldChoice ws={ctx.ws} objectId={tile.objectId} value={tile.fieldId} test={numeric} onChange={(fieldId) => update(index, { fieldId })} /> : null}
          {tile.objectId ? <RuleField ws={ctx.ws} objectId={tile.objectId} value={tile.filter ?? null} eventId={ctx.eventId} tokens={ctx.tokens} label="Count only" onChange={(filter) => update(index, { filter })} /> : null}
          {tile.fn === "percent" && tile.objectId ? <RuleField ws={ctx.ws} objectId={tile.objectId} value={tile.part ?? null} eventId={ctx.eventId} tokens={ctx.tokens} label="Share that" onChange={(part) => update(index, { part })} /> : null}
        </div>
      ))}
      {tiles.length < 4 ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => set({ ...config, tiles: [...tiles, { label: "", objectId: tiles[0]?.objectId ?? ctx.ws.objects[0]?.id, fn: "count" }] })}>
          <Plus className="h-4 w-4" />Add number
        </Button>
      ) : null}
    </div>
  );
}

function ChartSettings({ ctx, config, set }) {
  const objectId = config.objectId;
  const group = fieldsOf(ctx.ws, objectId).find((field) => field.id === config.groupBy?.field);
  return (
    <>
      <Row label="List"><ListChoice ws={ctx.ws} value={objectId} onChange={(next) => set({ ...defaultBlockConfig("chart", { definition: ctx.ws.data, objectId: next }), title: config.title })} /></Row>
      <Row label="Chart"><SegmentedTabs className="w-auto" value={config.kind ?? "bar"} onChange={(kind) => set({ ...config, kind })} tabs={[{ label: "Bar", value: "bar" }, { label: "Line", value: "line" }, { label: "Donut", value: "donut" }]} /></Row>
      {objectId ? (
        <>
          <Row label="Group by"><FieldChoice ws={ctx.ws} objectId={objectId} value={config.groupBy?.field ?? "status"} allowStatus
            test={(field) => ["single_select", "multi_select", "checkbox", "date", "datetime"].includes(field.type)} onChange={(field) => set({ ...config, groupBy: { field } })} /></Row>
          {group && (group.type === "date" || group.type === "datetime") ? (
            <Row label="Per"><SegmentedTabs className="w-auto" value={config.groupBy?.bucket ?? "month"} onChange={(bucket) => set({ ...config, groupBy: { ...config.groupBy, bucket } })} tabs={[{ label: "Day", value: "day" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }]} /></Row>
          ) : null}
          <Row label="Measure"><Choice value={config.measure?.fn ?? "count"} onChange={(fn) => set({ ...config, measure: { fn, fieldId: fn === "count" ? null : config.measure?.fieldId ?? null } })}
            options={[{ value: "count", label: "Count" }, { value: "sum", label: "Total of" }, { value: "avg", label: "Average of" }]} /></Row>
          {config.measure?.fn && config.measure.fn !== "count" ? <FieldChoice ws={ctx.ws} objectId={objectId} value={config.measure.fieldId} test={numeric} onChange={(fieldId) => set({ ...config, measure: { ...config.measure, fieldId } })} /> : null}
          <RuleField ws={ctx.ws} objectId={objectId} value={config.filter ?? null} eventId={ctx.eventId} tokens={ctx.tokens} onChange={(filter) => set({ ...config, filter })} />
        </>
      ) : null}
    </>
  );
}

const TEXT_TOOLS = [
  [Heading2, "Heading", "formatBlock", "h2"], [Heading3, "Subheading", "formatBlock", "h3"], [Pilcrow, "Paragraph", "formatBlock", "p"],
  [Bold, "Bold", "bold"], [Italic, "Italic", "italic"], [List, "Bullet list", "insertUnorderedList"], [Link2, "Link", "createLink"],
];

// A small formatted-text editor: headings, bold, italic, lists and links. The server cleans the markup on save.
function TextSettings({ config, set, align = true }) {
  const ref = useRef(null);
  const [initial] = useState(config.html ?? "");
  const exec = (command, value) => {
    if (command === "createLink") {
      const url = window.prompt("Link address (https://…)");
      if (!url || !/^https:\/\//i.test(url)) return;
      value = url;
    }
    ref.current?.focus();
    document.execCommand(command, false, value);
    set({ ...config, html: ref.current?.innerHTML ?? "" });
  };
  return (
    <>
      <div className="rounded-lg border border-border bg-surface-card">
        <div className="flex flex-wrap gap-0.5 border-b border-border p-1">
          {TEXT_TOOLS.map(([Icon, label, command, value]) => (
            <Button key={label} type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={label} title={label} onMouseDown={(event) => { event.preventDefault(); exec(command, value); }}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
        <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
          className="min-h-40 px-3 py-2 text-sm text-foreground outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline [&>*+*]:mt-2"
          dangerouslySetInnerHTML={{ __html: initial }} onInput={(event) => set({ ...config, html: event.currentTarget.innerHTML })} />
      </div>
      <p className="text-xs text-text-tertiary">Use {"{{person.name}}"} and {"{{event.name}}"} to greet people by name.</p>
      {align ? (
        <>
          <Row label="Align"><SegmentedTabs className="w-auto" value={config.align ?? "left"} onChange={(next) => set({ ...config, align: next })} tabs={[{ label: "Left", value: "left" }, { label: "Centre", value: "center" }]} /></Row>
          <Toggle label="Show as a card" hint="A bordered box, e.g. for “Need help?”." checked={config.card} onChange={(card) => set({ ...config, card })} />
        </>
      ) : null}
    </>
  );
}

function ImageSettings({ config, set }) {
  return (
    <>
      <Row label="Image address" hint="An https:// link to the picture."><TextInput value={config.url} maxLength={2000} placeholder="https://…" onChange={(url) => set({ ...config, url })} /></Row>
      <Row label="Description" hint="Read aloud by screen readers."><TextInput value={config.alt} maxLength={200} onChange={(alt) => set({ ...config, alt })} /></Row>
      <Row label="Fit"><SegmentedTabs className="w-auto" value={config.fit ?? "cover"} onChange={(fit) => set({ ...config, fit })} tabs={[{ label: "Fill", value: "cover" }, { label: "Whole image", value: "contain" }]} /></Row>
      <Row label="Height (px)"><Input type="number" min={80} max={800} value={config.height ?? 240} onChange={(e) => set({ ...config, height: Number(e.target.value) || 240 })} /></Row>
      <Row label="Links to" hint="Optional https:// link."><TextInput value={config.link} maxLength={2000} placeholder="https://…" onChange={(link) => set({ ...config, link: link || null })} /></Row>
    </>
  );
}

function ButtonsSettings({ ctx, config, set }) {
  return (
    <>
      <ButtonItemsEditor ctx={ctx} items={config.items ?? []} onChange={(items) => set({ ...config, items })} />
      <Row label="Align"><SegmentedTabs className="w-auto" value={config.align ?? "left"} onChange={(align) => set({ ...config, align })} tabs={[{ label: "Left", value: "left" }, { label: "Centre", value: "center" }]} /></Row>
    </>
  );
}

function DividerSettings({ config, set }) {
  return (
    <>
      <Row label="Space"><SegmentedTabs className="w-auto" value={config.size ?? "md"} onChange={(size) => set({ ...config, size })} tabs={[{ label: "Small", value: "sm" }, { label: "Medium", value: "md" }, { label: "Large", value: "lg" }]} /></Row>
      <Toggle label="Show a line" checked={config.line !== false} onChange={(line) => set({ ...config, line })} />
    </>
  );
}

const SETTINGS = {
  table: TableSettings, cards: CardsSettings, board: BoardSettings, calendar: CalendarSettings, record: RecordSettings, form: FormSettings,
  stats: StatsSettings, chart: ChartSettings, text: TextSettings, image: ImageSettings, buttons: ButtonsSettings, divider: DividerSettings,
  schedule: ScheduleSettings, timeline: TimelineSettings, placement: PlacementSettings, scanner: ScannerSettings, pass: PassSettings, custom: CustomSettings,
  hero: HeroSettings, notice: NoticeBlockSettings, facts: FactsSettings, dates: DatesSettings,
};

function NoticeBlockSettings(props) {
  return <NoticeSettings {...props} TextEditor={TextSettings} />;
}
const TITLED = new Set(["table", "cards", "board", "calendar", "record", "form", "stats", "chart", "schedule", "timeline", "placement", "scanner", "pass", "custom"]);

// The settings panel for the selected block. `ctx` carries the workspace, the page and the tokens rules may use.
export function BlockInspector({ ctx, block, onChange }) {
  const Settings = SETTINGS[block.kind];
  const set = (config) => onChange({ ...block, config });
  return (
    <div className="grid gap-4">
      {TITLED.has(block.kind) ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`wp-title-${block.id}`} className="text-xs font-medium text-text-secondary">Title</Label>
          <Input id={`wp-title-${block.id}`} value={block.config.title ?? ""} maxLength={120} onChange={(e) => set({ ...block.config, title: e.target.value })} />
        </div>
      ) : null}
      {Settings ? <Settings key={block.id} ctx={ctx} config={block.config} set={set} /> : null}
    </div>
  );
}
