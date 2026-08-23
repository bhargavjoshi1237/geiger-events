"use client";

import React from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  CTA_STYLES,
  EMPTY_CTAS,
  ctaHref,
  newCta,
  normalizeCtas,
} from "@/lib/events/ctas";

// Buttons on the event's tickets card. The built-in one is shown here as a
// fixed, undeletable first row so the stack reads the way it will on the page —
// only its label is editable.

export function EventCtasSection({ event, headerItem }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(event, "ctas", EMPTY_CTAS);
  const data = normalizeCtas(cfg);

  const setItems = (items) => setCfg({ ...data, items });
  const patch = (id, key, value) =>
    setItems(data.items.map((i) => (i.id === id ? { ...i, [key]: value } : i)));

  const move = (index, delta) => {
    const next = [...data.items];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
  };

  const save = () => saveCfg(undefined, { successMsg: "Buttons saved." });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Call to action"}
        description={
          headerItem?.desc ||
          "The buttons on your tickets card. Get Tickets is always first; anything you add stacks beneath it."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save buttons"}
          </Button>
        }
      />

      <SectionCard
        title="Get Tickets button"
        description="Always shown and can't be removed — selling the ticket is what the card is for. Leave the label blank to keep the automatic wording, which switches to “Register” on free events and “Sold out” when there's nothing left."
      >
        <Field label="Label" htmlFor="cta-primary-label">
          <Input
            id="cta-primary-label"
            value={data.primaryLabel}
            onChange={(e) => setCfg({ ...data, primaryLabel: e.target.value })}
            placeholder="Get Tickets"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Additional buttons"
        description="Each one links wherever you point it — a waitlist form, a hospitality enquiry, a sponsor pack. These stay clickable when the event sells out."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems([...data.items, newCta()])}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add button
          </Button>
        }
      >
        {data.items.length ? (
          <div className="space-y-3">
            {data.items.map((item, index) => {
              const href = ctaHref(item.url);
              const broken = item.url.trim() && !href;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex shrink-0 flex-col pt-1.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="text-text-tertiary transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Label" htmlFor={`cta-label-${item.id}`}>
                        <Input
                          id={`cta-label-${item.id}`}
                          value={item.label}
                          onChange={(e) => patch(item.id, "label", e.target.value)}
                          placeholder="Join the waitlist"
                        />
                      </Field>
                      <Field
                        label="Links to"
                        htmlFor={`cta-url-${item.id}`}
                        hint={
                          broken
                            ? "That link can't be used."
                            : "A web address, #section, mailto: or tel:"
                        }
                      >
                        <Input
                          id={`cta-url-${item.id}`}
                          value={item.url}
                          onChange={(e) => patch(item.id, "url", e.target.value)}
                          placeholder="example.com/waitlist"
                          className={broken ? "border-red-500/60" : undefined}
                        />
                      </Field>
                    </div>

                    <button
                      type="button"
                      aria-label="Remove button"
                      onClick={() =>
                        setItems(data.items.filter((i) => i.id !== item.id))
                      }
                      className="mt-1.5 shrink-0 text-text-tertiary transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 pl-6">
                    {CTA_STYLES.map((style) => {
                      const on = item.style === style.key;
                      return (
                        <button
                          key={style.key}
                          type="button"
                          aria-pressed={on}
                          title={style.hint}
                          onClick={() => patch(item.id, "style", style.key)}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                            on
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-surface-card text-muted-foreground hover:border-border-strong hover:bg-surface-active hover:text-foreground",
                          )}
                        >
                          {style.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No extra buttons"
            description="Your card shows Get Tickets on its own. Add a button to offer a second route — a waitlist, an enquiry, a sponsor pack."
          />
        )}

        {data.items.length >= 3 ? (
          <p className="mt-3 text-[11px] text-amber-400">
            With this many buttons the card stops having one obvious action. Keep
            Get Tickets as the only primary and the rest quieter.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

export default EventCtasSection;
