"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@geiger/ui";
import { SearchInput, Toolbar } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { ExposedFilters } from "./filters";
import { SORTABLE_SYSTEM, useList, useOpenRecord } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue, fieldName } from "./values";

// Search box, exposed filters and paging shared by the table and cards blocks.
export function useListParams(config) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [offset, setOffset] = useState(0);
  const params = { ...(search.trim() ? { search: search.trim() } : {}), filters, ...(sort ? { sort } : {}), offset };
  return {
    params, search, filters, sort, offset,
    setSearch: (value) => { setSearch(value); setOffset(0); },
    setFilters: (value) => { setFilters(value); setOffset(0); },
    setSort: (value) => { setSort(value); setOffset(0); },
    setOffset,
    pageSize: config.pageSize ?? 20,
  };
}

export function ListToolbar({ config, list, state }) {
  const hasFilters = config.filters?.length > 0;
  if (!config.search && !hasFilters) return null;
  return (
    <Toolbar className="border-b border-border px-4 py-2.5">
      <ExposedFilters list={list} fieldIds={config.filters} value={state.filters} onChange={state.setFilters} />
      {config.search ? <SearchInput value={state.search} onChange={state.setSearch} placeholder={`Search ${list?.plural?.toLowerCase() ?? ""}…`} /> : <span />}
    </Toolbar>
  );
}

export function Pager({ offset, pageSize, total, onChange }) {
  if (total <= pageSize && offset === 0) return null;
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm text-text-secondary">
      <span className="tabular-nums">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Previous page" disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - pageSize))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Next page" disabled={to >= total}
          onClick={() => onChange(offset + pageSize)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function TableBlock({ block, fill }) {
  const config = block.config;
  const { list } = useList(config.source?.objectId);
  const state = useListParams(config);
  const { data, error, loading, refreshing, reload } = useBlockData(block, state.params);
  const openRecord = useOpenRecord();
  const queryable = new Set(list?.queryable ?? []);
  const titleId = list?.titleFieldId;
  const columns = (config.columns ?? []).filter((id) => id !== titleId && (id === "status" ? list?.statuses?.length : list?.fields.some((field) => field.id === id)));
  const canSort = (id) => SORTABLE_SYSTEM.has(id) || queryable.has(id);
  const toggleSort = (id) => {
    if (!canSort(id)) return;
    state.setSort(state.sort?.field === id ? (state.sort.dir === "asc" ? { field: id, dir: "desc" } : null) : { field: id, dir: "asc" });
  };

  const header = (id, label, className) => {
    const active = state.sort?.field === id;
    const Arrow = state.sort?.dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <th key={id} className={cn("whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-text-secondary", className)}>
        {canSort(id) ? (
          <button type="button" onClick={() => toggleSort(id)} className="inline-flex items-center gap-1 hover:text-foreground">
            {label}{active ? <Arrow className="h-3 w-3" /> : null}
          </button>
        ) : label}
      </th>
    );
  };

  let body;
  if (!list) body = <Restricted />;
  else if (loading) body = <BlockLoading label={`Loading ${list.plural}`} />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!data?.rows.length) body = <EmptyRows text={state.search || Object.keys(state.filters).length ? "Nothing matches." : config.emptyText} />;
  else {
    body = (
      <div className={cn("overflow-x-auto transition-opacity", refreshing && "opacity-60")}>
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {header("title", titleId ? list.fields.find((field) => field.id === titleId)?.name ?? "Name" : list.name, "min-w-48")}
              {columns.map((id) => header(id, fieldName(list, id)))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} onClick={config.open ? () => openRecord(row) : undefined}
                className={cn("border-b border-border last:border-0", config.open && "cursor-pointer hover:bg-surface-subtle")}>
                <td className="max-w-80 px-4 py-2.5">
                  <span className="block truncate font-medium text-foreground">{row.title || `${list.numberPrefix}-${row.number}`}</span>
                </td>
                {columns.map((id) => (
                  <td key={id} className="max-w-72 px-4 py-2.5 align-middle text-foreground">
                    <div className="flex min-w-0 items-center"><CellValue list={list} fieldId={id} record={row} /></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <BlockFrame title={config.title} fill={fill}>
      <ListToolbar config={config} list={list} state={state} />
      {body}
      {data?.rows?.length ? <Pager offset={state.offset} pageSize={state.pageSize} total={data.total} onChange={state.setOffset} /> : null}
    </BlockFrame>
  );
}
