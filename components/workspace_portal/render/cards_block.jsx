"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockError, BlockFrame, BlockLoading, EmptyRows, Restricted } from "./block_frame";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { ListToolbar, Pager, useListParams } from "./table_block";
import { useBlockData } from "./use_block_data";
import { CellValue, fieldName, isVisibleOn, StatusChip } from "./values";

const COLUMNS = { 1: "", 2: "@xl/block:grid-cols-2", 3: "@xl/block:grid-cols-2 @4xl/block:grid-cols-3" };
const covers = new Map();

// The first image on a record, through a short-lived link (cached for a few minutes).
function Cover({ record, fieldId }) {
  const { api } = usePortalView();
  const file = (record.values?.[fieldId] ?? []).find((item) => item.type?.startsWith("image/"));
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) return undefined;
    let alive = true;
    const cached = covers.get(file.id);
    const pending = cached && cached.expires > Date.now() ? Promise.resolve({ data: { url: cached.url } })
      : api.signFile({ recordId: record.id, fieldId, fileId: file.id, inline: true });
    pending.then(({ data }) => {
      if (!alive || !data?.url) return;
      if (!cached || cached.url !== data.url) covers.set(file.id, { url: data.url, expires: Date.now() + 8 * 60_000 });
      setUrl(data.url);
    });
    return () => { alive = false; };
  }, [api, file, fieldId, record.id]);

  return (
    <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-t-xl border-b border-border bg-surface-subtle">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-text-tertiary" />}
    </div>
  );
}

export function RecordCard({ list, record, fields, cover, onOpen }) {
  const shown = fields.filter((id) => id !== list.titleFieldId && id !== "status" && isVisibleOn(record, id));
  return (
    <article onClick={onOpen} className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-surface-card", onOpen && "cursor-pointer hover:border-foreground/25")}>
      {cover ? <Cover record={record} fieldId={cover} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold text-foreground">{record.title || `${list.numberPrefix}-${record.number}`}</h3>
          {fields.includes("status") ? <StatusChip list={list} status={record.status} /> : null}
        </div>
        {shown.length ? (
          <dl className="grid gap-2">
            {shown.map((id) => (
              <div key={id} className="grid min-w-0 gap-0.5">
                <dt className="text-xs text-text-tertiary">{fieldName(list, id)}</dt>
                <dd className="flex min-w-0 text-sm text-foreground"><CellValue list={list} fieldId={id} record={record} /></dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </article>
  );
}

export function CardsBlock({ block, fill }) {
  const config = block.config;
  const { list } = useList(config.source?.objectId);
  const state = useListParams(config);
  const { data, error, loading, refreshing, reload } = useBlockData(block, state.params);
  const openRecord = useOpenRecord();
  const cover = config.cover && list?.fields.some((field) => field.id === config.cover) ? config.cover : null;

  let body;
  if (!list) body = <Restricted />;
  else if (loading) body = <BlockLoading label={`Loading ${list.plural}`} />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted) body = <Restricted />;
  else if (!data?.rows.length) body = <EmptyRows text={state.search || Object.keys(state.filters).length ? "Nothing matches." : config.emptyText} />;
  else {
    body = (
      <div className="@container/block p-4">
        <div className={cn("grid grid-cols-1 gap-3 transition-opacity", COLUMNS[config.columns] ?? COLUMNS[3], refreshing && "opacity-60")}>
          {data.rows.map((row) => (
            <RecordCard key={row.id} list={list} record={row} fields={config.fields ?? []} cover={cover}
              onOpen={config.open ? () => openRecord(row) : undefined} />
          ))}
        </div>
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
