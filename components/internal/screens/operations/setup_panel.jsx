"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Layers3, Plus } from "lucide-react";
import { Button, LogoLoading } from "@geiger/ui";
import { operationsClient } from "@/lib/operations/client";

export function SetupPanel({ eventId, onSetup }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    operationsClient.packs(eventId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setPacks(result.data ?? []);
      setError(result.error);
      setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) {
      setError({ message: "Couldn't load workspace starters." }); setLoading(false);
    } });
    return () => controller.abort();
  }, [eventId]);

  const choose = async (key, modules) => {
    setBusy(key);
    const result = await onSetup(modules);
    if (result?.error) setError(result.error);
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface-card p-6 md:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Layers3 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Event operations</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Build your organiser workspace</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Set up private modules to track the people, items and work behind this event. Start with a reference pack or a blank workspace, then change every label and field before publishing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => choose("blank", [])} disabled={Boolean(busy)} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Start empty
          </Button>
        </div>
      </div>
      {loading ? <div className="flex items-center gap-3 text-sm text-muted-foreground"><LogoLoading size={32} />Loading starters…</div> : null}
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p> : null}
      {packs.length ? <div className="grid gap-3 md:grid-cols-3">
        {packs.map((pack) => <button key={pack.key} type="button" disabled={Boolean(busy)}
          onClick={() => choose(pack.key, pack.modules)}
          className="group rounded-xl border border-border bg-surface-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-surface-active disabled:opacity-50">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Reference pack</span>
          <span className="mt-3 flex items-center justify-between text-lg font-semibold capitalize text-foreground">
            {pack.key}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
          <span className="mt-2 block text-sm leading-5 text-muted-foreground">
            {pack.modules.map((item) => item.label).join(" · ")}
          </span>
        </button>)}
      </div> : null}
      <p className="text-xs text-muted-foreground">Setup creates a draft. Your operational records remain private and no public event content changes until you publish this workspace.</p>
    </div>
  );
}
