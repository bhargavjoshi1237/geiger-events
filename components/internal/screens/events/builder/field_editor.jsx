"use client";

import React, { useCallback, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { hasTokens } from "@/lib/events/bindings";
import { cn } from "@/lib/utils";
import { Segmented } from "../theme_controls";
import { BindingPicker } from "./binding_picker";

export const RICHTEXT_HINT =
  "Supports **bold**, *italic*, [links](https://…), ## headings, and - bullet lists.";

function moveItem(arr, index, dir) {
  const next = index + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

function useTokenInsert(value, onChange) {
  const ref = useRef(null);

  const insert = useCallback(
    (token) => {
      const el = ref.current;
      const text = String(value ?? "");
      if (!el || el.selectionStart == null) {
        onChange(text ? `${text} ${token}` : token);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = text.slice(0, start) + token + text.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const at = start + token.length;
        el.setSelectionRange(at, at);
      });
    },
    [value, onChange],
  );

  return { ref, insert };
}

function FieldLabel({ field, bindable, onInsert, tokenized }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {field.label}
        {tokenized ? (
          <span className="rounded bg-primary/15 px-1 py-0.5 text-[0.6rem] font-medium text-primary">
            dynamic
          </span>
        ) : null}
      </span>
      {bindable ? <BindingPicker onInsert={onInsert} /> : null}
    </div>
  );
}

function TextControl({ field, value, onChange, multiline, mono }) {
  const { ref, insert } = useTokenInsert(value, onChange);
  const bindable = !!field.bindable;
  const rows = field.type === "code" ? 10 : field.type === "richtext" ? 6 : 4;

  return (
    <div className="space-y-1.5">
      <FieldLabel
        field={field}
        bindable={bindable}
        onInsert={insert}
        tokenized={hasTokens(value)}
      />
      {multiline ? (
        <Textarea
          ref={ref}
          rows={rows}
          spellCheck={!mono}
          value={value || ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn("bg-surface-card", mono && "font-mono text-xs leading-relaxed")}
        />
      ) : (
        <Input
          ref={ref}
          value={value || ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="bg-surface-card"
        />
      )}
      {field.hint || field.type === "richtext" ? (
        <p className="text-[0.7rem] leading-relaxed text-text-tertiary">
          {field.hint || RICHTEXT_HINT}
        </p>
      ) : null}
    </div>
  );
}

function RangeControl({ field, value, onChange }) {
  const current = Number(value ?? field.min ?? 0);
  return (
    <Field label={field.label} hint={field.hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-active accent-primary"
        />
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-text-secondary">
          {current}
          {field.suffix || ""}
        </span>
      </div>
    </Field>
  );
}

function ColorControl({ field, value, onChange }) {
  return (
    <Field label={field.label} hint={field.hint}>
      <div className="flex items-center gap-2">
        <span className="relative h-9 w-10 shrink-0 overflow-hidden rounded-md border border-border">
          <span
            className="block h-full w-full"
            style={{ backgroundColor: value || "#000000" }}
          />
          <input
            type="color"
            aria-label={field.label}
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <Input
          value={value || ""}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
          className="h-9 bg-surface-card font-mono text-xs"
        />
      </div>
    </Field>
  );
}

function SwitchControl({ field, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{field.label}</p>
        {field.hint ? (
          <p className="mt-0.5 text-[0.7rem] leading-relaxed text-text-tertiary">
            {field.hint}
          </p>
        ) : null}
      </div>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

function ItemsControl({ field, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];

  const setRow = (i, patch) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    onChange([
      ...rows,
      Object.fromEntries(
        field.itemFields.map((f) => [
          f.key,
          f.type === "select" ? f.options[0].key : f.type === "switch" ? false : "",
        ]),
      ),
    ]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">{field.label}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={addRow}
          className="h-7 border-border bg-transparent px-2 text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> {field.addLabel || "Add"}
        </Button>
      </div>
      {rows.length ? (
        <div className="space-y-2.5">
          {rows.map((row, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-tertiary">
                  {i + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => onChange(moveItem(rows, i, -1))}
                    aria-label="Move up"
                    className="h-6 w-6 text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === rows.length - 1}
                    onClick={() => onChange(moveItem(rows, i, 1))}
                    aria-label="Move down"
                    className="h-6 w-6 text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label="Remove"
                    className="h-6 w-6 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {field.itemFields.map((f) => (
                <BuilderField
                  key={f.key}
                  field={f}
                  value={row[f.key]}
                  onChange={(v) => setRow(i, { [f.key]: v })}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-tertiary">
          Nothing here yet.
        </p>
      )}
    </div>
  );
}

function CloneAssetsControl({ field, value, onChange }) {
  const clone = value && typeof value === "object" ? value : {};
  const url = clone.url || "";
  const assets = Array.isArray(clone.assets) ? clone.assets : [];
  const enabled = !!clone.enabled;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = (next) => onChange({ ...clone, ...next });

  const run = async () => {
    if (!url.trim()) {
      setError("Enter the page URL first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/clone-assets?url=${encodeURIComponent(url.trim())}`,
      );
      const json = await res.json().catch(() => null);
      if (!json || json.error) {
        setError(json?.error?.message || "The asset reader didn't respond. Try again.");
        return;
      }
      const next = json.assets || [];
      patch({ assets: next, enabled: next.length > 0 });
    } catch {
      setError("Something went wrong reading that page. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const css = assets.filter((a) => a.kind === "css").length;
  const js = assets.length - css;

  return (
    <Field label={field.label} hint={field.hint}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={url}
            placeholder="https://example.com/the-page"
            onChange={(e) => patch({ url: e.target.value })}
            className="h-8 bg-surface-subtle font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !url.trim()}
            onClick={run}
            className="shrink-0"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Fetch
          </Button>
        </div>

        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        ) : null}

        {assets.length ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-text-secondary">
                  {css} stylesheet{css === 1 ? "" : "s"} · {js} script{js === 1 ? "" : "s"}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => patch({ enabled: v })}
              />
            </div>
            <p className="text-[0.7rem] text-text-tertiary">
              {enabled
                ? "Loaded on your public page."
                : "Off — loaded only while switched on."}
            </p>
            <div className="space-y-1">
              {assets.slice(0, 6).map((a, i) => (
                <p
                  key={`${a.url}-${i}`}
                  className="truncate font-mono text-[0.7rem] text-text-secondary"
                >
                  <span
                    className={cn(
                      "mr-1 rounded px-1 py-px text-[0.65rem] font-semibold",
                      a.kind === "css"
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-purple-500/15 text-purple-300",
                    )}
                  >
                    {a.kind === "css" ? "css" : "js"}
                  </span>
                  {a.url}
                </p>
              ))}
              {assets.length > 6 ? (
                <p className="text-[0.7rem] text-text-tertiary">
                  +{assets.length - 6} more
                </p>
              ) : null}
            </div>
          </div>
        ) : enabled ? (
          <p className="text-[0.7rem] text-text-tertiary">
            Switched on but no assets yet — fetch them from the page URL above.
          </p>
        ) : null}
      </div>
    </Field>
  );
}

export function BuilderField({ field, value, onChange }) {
  switch (field.type) {
    case "clone-assets":
      return <CloneAssetsControl field={field} value={value} onChange={onChange} />;
    case "select":
      return (
        <Field label={field.label} hint={field.hint}>
          <Segmented
            value={value ?? field.options[0].key}
            onChange={onChange}
            options={field.options}
          />
        </Field>
      );
    case "switch":
      return <SwitchControl field={field} value={value} onChange={onChange} />;
    case "range":
      return <RangeControl field={field} value={value} onChange={onChange} />;
    case "color":
      return <ColorControl field={field} value={value} onChange={onChange} />;
    case "items":
      return <ItemsControl field={field} value={value} onChange={onChange} />;
    case "code":
      return <TextControl field={field} value={value} onChange={onChange} multiline mono />;
    case "textarea":
    case "richtext":
      return <TextControl field={field} value={value} onChange={onChange} multiline />;
    default:
      return <TextControl field={field} value={value} onChange={onChange} />;
  }
}

export function FieldList({ fields, values, onChange }) {
  const visible = (f) =>
    !f.showWhen ||
    Object.entries(f.showWhen).every(([k, v]) => (values?.[k] ?? "") === v);

  return (
    <div className="space-y-4">
      {(fields || []).filter(visible).map((field) => (
        <React.Fragment key={field.key}>
          {field.group ? (
            <p className="border-t border-border pt-4 text-[0.65rem] font-semibold uppercase tracking-wider text-text-tertiary">
              {field.group}
            </p>
          ) : null}
          <BuilderField
            field={field}
            value={values?.[field.key]}
            onChange={(v) => onChange(field.key, v)}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
