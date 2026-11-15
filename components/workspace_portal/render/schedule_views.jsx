"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import {
  Badge, Button, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, SearchInput, SegmentedTabs, Toolbar,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { COLOR_SWATCH } from "@/components/internal/screens/workspace/state/format";
import { parseDay } from "./dated";
import { CellValue, isVisibleOn } from "./values";

const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const format = (day, options) => parseDay(day).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "Times in Lisbon" from the event's time zone.
export const zoneNote = (timeZone) => (timeZone && timeZone !== "UTC" ? `Times in ${timeZone.split("/").pop().replace(/_/g, " ")}` : "Times in UTC");

// The shown extra fields that are single choices, with their options (track, type…).
function choiceFields(list, config) {
  return (config.fields ?? []).map((id) => list.fields.find((field) => field.id === id)).filter((field) => field?.type === "single_select");
}

function optionOf(field, row) {
  const value = row.values?.[field?.id];
  return field?.config?.options?.find((option) => option.id === value) ?? null;
}

function Dot({ option }) {
  return <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", COLOR_SWATCH[option?.color] ?? COLOR_SWATCH.gray)} />;
}

// The first extra field under the title (a coloured dot for a choice), the second as a quiet pill.
function Extra({ list, field, row, pill = false }) {
  if (!field || !isVisibleOn(row, field.id)) return null;
  if (field.type === "single_select") {
    const option = optionOf(field, row);
    if (!option) return null;
    return pill ? (
      <Badge variant="outline" className="whitespace-nowrap">{option.label}</Badge>
    ) : (
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground"><Dot option={option} /><span className="truncate">{option.label}</span></span>
    );
  }
  return <span className="flex min-w-0 text-[12.5px] text-muted-foreground"><CellValue list={list} fieldId={field.id} record={row} /></span>;
}

// A day-by-day list of sessions with day tabs, choice filters and search — the public programme.
export function AgendaView({ list, config, items, days, laneLabel, onOpen }) {
  const [day, setDay] = useState("all");
  const [chosen, setChosen] = useState({});
  const [search, setSearch] = useState("");
  const extras = (config.fields ?? []).map((id) => list.fields.find((field) => field.id === id)).filter(Boolean);
  const filters = choiceFields(list, config);
  const term = search.trim().toLowerCase();
  const matches = (item) => (!term || String(item.row.title ?? "").toLowerCase().includes(term))
    && filters.every((field) => !chosen[field.id]?.length || chosen[field.id].includes(item.row.values?.[field.id]));
  const shownDays = days.filter((value) => day === "all" || value === day);
  const tabs = [{ label: "All days", value: "all" }, ...days.map((value) => ({ label: format(value, { weekday: "short", day: "numeric" }), value }))];

  return (
    <div className="@container/block grid min-w-0 gap-7">
      {config.title ? <h2 className="text-base font-semibold text-foreground">{config.title}</h2> : null}
      <Toolbar>
        {days.length > 1 ? <SegmentedTabs tabs={tabs} value={day} onChange={setDay} className="w-auto" /> : <span />}
        <div className="flex items-center gap-2">
          {filters.map((field) => {
            const picked = chosen[field.id] ?? [];
            return (
              <DropdownMenu key={field.id}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("bg-transparent font-normal text-muted-foreground", picked.length && "border-border-strong text-foreground")}>
                    {field.name}{picked.length ? ` · ${picked.length}` : ""}<ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs font-medium text-text-secondary">{field.name}</DropdownMenuLabel>
                  {(field.config?.options ?? []).map((option) => (
                    <DropdownMenuCheckboxItem key={option.id} checked={picked.includes(option.id)} onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(on) => setChosen((current) => ({ ...current, [field.id]: on ? [...picked, option.id] : picked.filter((id) => id !== option.id) }))}>
                      <Dot option={option} />{option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {picked.length ? (
                    <>
                      <DropdownMenuSeparator />
                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setChosen((current) => ({ ...current, [field.id]: [] }))}>Clear</Button>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${list.plural.toLowerCase()}`} />
        </div>
      </Toolbar>

      {shownDays.map((value) => {
        const rows = items.filter((item) => item.day === value && matches(item));
        return (
          <section key={value} className="grid gap-3">
            <div className="flex items-baseline gap-2.5 px-1">
              <span className="text-base font-semibold text-foreground">{format(value, { weekday: "long" })}</span>
              <span className="font-mono text-[13px] text-text-secondary">{format(value, { day: "numeric", month: "long" })}</span>
              <span className="flex-1" />
              <span className="text-[12.5px] text-text-secondary">{plural(rows.length, list.name.toLowerCase())}</span>
            </div>
            {rows.length ? (
              <div className="flex flex-col gap-px overflow-hidden rounded-[14px] border border-border bg-border">
                {rows.map((item) => {
                  const room = laneLabel(item);
                  return (
                    <div key={item.id} role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined} onClick={onOpen ? () => onOpen(item.row) : undefined}
                      onKeyDown={onOpen ? (event) => { if (event.target === event.currentTarget && event.key === "Enter") onOpen(item.row); } : undefined}
                      className={cn("grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 bg-surface-subtle px-5 py-4 text-left @2xl/block:grid-cols-[72px_minmax(0,1fr)_132px_156px]",
                        onOpen && "cursor-pointer hover:bg-surface-card")}>
                      <span className="self-start font-mono text-[13.5px] font-medium text-foreground @2xl/block:self-center">{clock(item.startMin)}</span>
                      <span className="grid min-w-0 gap-1.5">
                        <span className="text-[14.5px] font-medium leading-snug text-foreground">{item.row.title || `${list.numberPrefix}-${item.row.number}`}</span>
                        <Extra list={list} field={extras[0]} row={item.row} />
                        <span className="flex flex-wrap items-center gap-2 @2xl/block:hidden">
                          <Extra list={list} field={extras[1]} row={item.row} pill />
                          {room ? <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-text-tertiary" />{room}</span> : null}
                        </span>
                      </span>
                      <span className="hidden @2xl/block:block"><Extra list={list} field={extras[1]} row={item.row} pill /></span>
                      <span className="hidden min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground @2xl/block:flex">
                        {room ? <><MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" /><span className="truncate">{room}</span></> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="rounded-[14px] border border-dashed border-border px-5 py-6 text-center text-sm text-text-secondary">Nothing on this day{term || Object.values(chosen).some((ids) => ids?.length) ? " matches" : ""}.</p>}
          </section>
        );
      })}
    </div>
  );
}

// Each day as a column of its sessions: time, title and where — the programme at a glance.
export function GlanceView({ list, config, items, days, laneLabel, onOpen }) {
  const dot = choiceFields(list, config)[0];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-border">
      {days.map((value) => {
        const rows = items.filter((item) => item.day === value);
        return (
          <div key={value} className="flex flex-col gap-4 bg-surface-subtle px-5 pb-[22px] pt-[18px]">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold text-foreground">{format(value, { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="text-xs text-text-secondary">{plural(rows.length, list.name.toLowerCase())}</span>
            </div>
            {rows.map((item) => {
              const room = laneLabel(item);
              const option = dot && isVisibleOn(item.row, dot.id) ? optionOf(dot, item.row) : null;
              return (
                <button key={item.id} type="button" disabled={!onOpen} onClick={() => onOpen?.(item.row)} className="grid gap-1.5 text-left">
                  <span className="font-mono text-xs text-muted-foreground">{clock(item.startMin)}</span>
                  <span className={cn("text-pretty text-[13.5px] font-medium leading-snug text-foreground", onOpen && "hover:underline")}>{item.row.title || `${list.numberPrefix}-${item.row.number}`}</span>
                  {room || option ? <span className="flex items-center gap-1.5 text-xs text-text-secondary">{option ? <Dot option={option} /> : null}{room ?? option?.label}</span> : null}
                </button>
              );
            })}
            {!rows.length ? <p className="text-xs text-text-tertiary">Nothing scheduled.</p> : null}
          </div>
        );
      })}
    </div>
  );
}
