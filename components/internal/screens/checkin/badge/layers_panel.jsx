"use client";

import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  QrCode,
  Square,
  Trash2,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FIELD_CATALOG, elementLabel, newElement, sideLayout } from "@/lib/passes/layout";

import { PanelSection } from "./panel";

const KIND_ICON = { text: Type, qr: QrCode, image: ImageIcon, box: Square };

const GROUPS = ["Event", "Attendee", "Ticket", "Pass", "Other"];

// The left rail: everything on the face being designed, front-most first. Select
// to edit, toggle to hide it from print, reorder to change what overlaps what.
export function LayersPanel({ template, side = "front", selectedId, onSelect, onChange }) {
  const elements = sideLayout(template, side).elements || [];
  const set = (next) => onChange({ elements: next });

  const patch = (id, p) => set(elements.map((el) => (el.id === id ? { ...el, ...p } : el)));

  const remove = (id) => {
    set(elements.filter((el) => el.id !== id));
    if (selectedId === id) onSelect(null);
  };

  // Later in the array paints later, so "up" in the list is one step to the back.
  const move = (id, delta) => {
    const index = elements.findIndex((el) => el.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= elements.length) return;
    const next = [...elements];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    set(next);
  };

  const addField = (field) => {
    const created = newElement("text", {
      field,
      text: field === "custom" ? "Custom text" : "",
      x: 6,
      y: 12,
      w: 40,
    });
    set([...elements, created]);
    onSelect(created.id);
  };

  const addKind = (kind) => {
    const created = newElement(kind, { x: 6, y: 12 });
    set([...elements, created]);
    onSelect(created.id);
  };

  const used = new Set(elements.filter((el) => el.kind === "text").map((el) => el.field));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PanelSection label={side === "back" ? "On the back" : "On the front"}>
        <div className="space-y-1">
          {/* Front-most first reads the way the card looks. */}
          {[...elements].reverse().map((el) => {
            const Icon = KIND_ICON[el.kind] || Type;
            const active = el.id === selectedId;
            return (
              <div
                key={el.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-surface-card",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(el.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      el.hidden ? "text-text-tertiary" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      el.hidden ? "text-text-tertiary line-through" : "text-foreground",
                    )}
                  >
                    {elementLabel(el)}
                  </span>
                </button>

                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Bring forward"
                    onClick={() => move(el.id, 1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Send backward"
                    onClick={() => move(el.id, -1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400 hover:text-red-400"
                    aria-label="Delete"
                    onClick={() => remove(el.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={el.hidden ? "Show" : "Hide"}
                  onClick={() => patch(el.id, { hidden: !el.hidden })}
                >
                  {el.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}

          {!elements.length ? (
            <p className="px-1 py-2 text-xs text-text-tertiary">
              {side === "back"
                ? "The back is blank — it only prints once you put something on it."
                : "Nothing on the card yet — add a field below, or draw a section on the canvas."}
            </p>
          ) : null}
        </div>

        <div className="pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add to card
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 border-border bg-surface-subtle shadow-xl">
              {GROUPS.map((group) => {
                const items = FIELD_CATALOG.filter((f) => f.group === group);
                if (!items.length) return null;
                return (
                  <React.Fragment key={group}>
                    <DropdownMenuLabel className="text-xs text-text-tertiary">
                      {group}
                    </DropdownMenuLabel>
                    {items.map((f) => (
                      <DropdownMenuItem
                        key={f.key}
                        onClick={() => addField(f.key)}
                        className="justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Type className="h-4 w-4" /> {f.label}
                        </span>
                        {f.key !== "custom" && used.has(f.key) ? (
                          <span className="text-xs text-text-tertiary">on card</span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </React.Fragment>
                );
              })}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem onClick={() => addKind("qr")}>
                <QrCode className="h-4 w-4" /> QR code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addKind("image")}>
                <ImageIcon className="h-4 w-4" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addKind("box")}>
                <Square className="h-4 w-4" /> Section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PanelSection>
    </div>
  );
}

export default LayersPanel;
