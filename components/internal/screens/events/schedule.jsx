"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Clock,
  Image as ImgIcon,
  Code as CodeIcon,
  Globe,
} from "lucide-react";

import { EditorSectionHeader } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  applySection,
  formatScheduleTime,
  sectionSettings,
} from "@/lib/events/schedule_items";
import { clipHostLabel } from "@/lib/clip/model";
import { removeClipAssets } from "@/lib/clip/assets";
import { ScheduleStyleButton } from "./schedule_style";
import { EMPTY_ITEM, ScheduleItemDialog } from "./schedule_item_dialog";
import { removeEventImage, pathFromPublicUrl } from "@/lib/supabase/storage";

function ScheduleRow({ item, index, count, onEdit, onRemove, onMove }) {
  const clipped = item.contentType === "clip";
  const html = item.contentType === "html";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-tertiary">
          {clipped ? (
            <Globe className="h-4 w-4" />
          ) : html ? (
            <CodeIcon className="h-4 w-4" />
          ) : (
            <ImgIcon className="h-4 w-4" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.time ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-text-secondary">
              {formatScheduleTime(item.time)}
            </span>
          ) : null}
          <p className="truncate text-sm font-medium text-foreground">
            {item.title}
          </p>
          {clipped || html ? (
            <span className="shrink-0 rounded border border-border bg-surface-subtle px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {clipped ? clipHostLabel(item.clip) || "Clip" : "HTML"}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {item.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Move up"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label="Move down"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit item"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Delete item"
          className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ScheduleSection({ event, headerItem }) {
  const [items, , saveItems] = useEventConfig(event, "schedule", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); 

  const section = sectionSettings(items);
  
  const saveSection = (next) =>
    saveItems(applySection(items, next), { successMsg: "Schedule style updated." });
  const addItem = (item) =>
    saveItems([...items, { ...item, ...section, id: `sch_${Date.now()}` }], {
      successMsg: "Schedule item added.",
    });
  
  const updateItem = (index, item) => {
    const previous = items[index];
    saveItems(
      items.map((it, i) => (i === index ? { ...it, ...item } : it)),
      { successMsg: "Schedule item updated." },
    );
    if (previous?.clip) removeClipAssets(previous.clip, { keep: item.clip });
  };

  const removeItem = (index) => {
    const target = items[index];
    saveItems(items.filter((_, i) => i !== index));
    const path = pathFromPublicUrl(target?.image);
    if (path) removeEventImage(path);
    if (target?.clip) removeClipAssets(target.clip);
  };

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= items.length) return;
    const copy = [...items];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveItems(copy);
  };
  

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Schedule"}
        description={
          headerItem?.desc ||
          "Build your event's running order. Items appear in this order in the Schedule section of your public page."
        }
        action={
          <div className="flex items-center gap-2">
            <ScheduleStyleButton
              section={section}
              onChange={saveSection}
              disabled={!items.length}
            />
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
        }
      />

      {items.length ? (
        <div className="space-y-2">
          {items.map((it, i) => (
            <ScheduleRow
              key={it.id || i}
              item={it}
              index={i}
              count={items.length}
              onEdit={() => setEditing({ index: i, item: it })}
              onRemove={() => removeItem(i)}
              onMove={(dir) => move(i, dir)}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Clock className="h-6 w-6" />
          <p className="text-sm">Add your first schedule item</p>
        </button>
      )}

      <ScheduleItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={event.id}
        initial={EMPTY_ITEM}
        onSave={addItem}
      />
      <ScheduleItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        eventId={event.id}
        initial={editing ? { ...EMPTY_ITEM, ...editing.item } : null}
        onSave={(item) => {
          updateItem(editing.index, item);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default ScheduleSection;
