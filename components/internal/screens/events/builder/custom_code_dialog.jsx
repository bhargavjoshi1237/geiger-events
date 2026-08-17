"use client";

// Page-level custom CSS, JS and external resources.
//
// This ships verbatim to the published page — no sanitising, because stripping
// scripts is exactly what would break the pasted widgets and author-defined
// functions it exists for. The gate is consent, not filtering: the organizer
// acknowledges once that this runs on their public page, and the whole surface
// is behind the events.page.customcode permission.

import { useState } from "react";
import { AlertTriangle, Plus, Trash2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkJs, normalizeCustomCode } from "@/lib/events/custom_code";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "css", label: "CSS" },
  { key: "js", label: "JavaScript" },
  { key: "resources", label: "Resources" },
];

function nid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

function Consent({ onAccept, onCancel }) {
  return (
    <>
      <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <AlertTriangle className="h-4 w-4" /> This code runs on your public page
        </p>
        <ul className="space-y-1.5 text-xs leading-relaxed text-text-secondary">
          <li>
            CSS and JavaScript you add here are delivered to every visitor exactly
            as written. Nothing is filtered or rewritten.
          </li>
          <li>
            A script can read and change anything on the page, including what
            attendees type into the registration form.
          </li>
          <li>
            Only paste code you wrote or that comes from a source you trust.
          </li>
        </ul>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          Cancel
        </Button>
        <Button
          onClick={onAccept}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <ShieldCheck className="h-4 w-4" /> I understand
        </Button>
      </DialogFooter>
    </>
  );
}

export function CustomCodeDialog({ open, onOpenChange, value, onChange }) {
  const code = normalizeCustomCode(value);
  const [tab, setTab] = useState("css");
  const patch = (next) => onChange({ ...code, ...next });

  const jsCheck = checkJs(code.js);
  const resources = code.resources;

  const setResource = (id, next) =>
    patch({ resources: resources.map((r) => (r.id === id ? { ...r, ...next } : r)) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom code</DialogTitle>
          <DialogDescription>
            Styles, scripts and external files loaded on your published event page.
          </DialogDescription>
        </DialogHeader>

        {!code.acknowledged ? (
          <Consent
            onAccept={() => patch({ acknowledged: true, enabled: true })}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-card px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Run custom code on this page
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Turn off to disable everything below without deleting it.
                </p>
              </div>
              <Switch
                checked={code.enabled}
                onCheckedChange={(enabled) => patch({ enabled })}
              />
            </div>

            <div className="flex border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "border-primary text-foreground"
                      : "border-transparent text-text-secondary hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "css" ? (
              <div className="space-y-2">
                <Textarea
                  rows={14}
                  spellCheck={false}
                  value={code.css}
                  onChange={(e) => patch({ css: e.target.value })}
                  placeholder={".my-class { letter-spacing: -0.02em; }"}
                  className="bg-surface-card font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-text-tertiary">
                  Applies on the published page and inside this editor, so your
                  own classes render as you design.
                </p>
              </div>
            ) : null}

            {tab === "js" ? (
              <div className="space-y-2">
                <Textarea
                  rows={14}
                  spellCheck={false}
                  value={code.js}
                  onChange={(e) => patch({ js: e.target.value })}
                  placeholder={"document.querySelectorAll('.my-class').forEach(…)"}
                  className={cn(
                    "bg-surface-card font-mono text-xs leading-relaxed",
                    !jsCheck.ok && "border-red-500/50",
                  )}
                />
                {jsCheck.ok ? (
                  <p className="text-xs text-text-tertiary">
                    Runs once the page has loaded. It never runs inside this
                    editor, so a mistake here can&apos;t lock you out.
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {jsCheck.message}
                  </p>
                )}
              </div>
            ) : null}

            {tab === "resources" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-tertiary">
                    Stylesheets and scripts loaded from a URL, in order, before
                    your inline code.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({
                        resources: [...resources, { id: nid(), kind: "js", url: "", defer: false }],
                      })
                    }
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                {resources.length ? (
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface-card p-2"
                      >
                        <select
                          value={resource.kind || "js"}
                          onChange={(e) => setResource(resource.id, { kind: e.target.value })}
                          aria-label="Resource type"
                          className="h-8 shrink-0 rounded-md border border-border bg-surface-subtle px-2 text-xs text-foreground"
                        >
                          <option value="js">Script</option>
                          <option value="css">Stylesheet</option>
                        </select>
                        <Input
                          value={resource.url || ""}
                          placeholder="https://…"
                          onChange={(e) => setResource(resource.id, { url: e.target.value })}
                          className="h-8 bg-surface-subtle font-mono text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove resource"
                          onClick={() =>
                            patch({ resources: resources.filter((r) => r.id !== resource.id) })
                          }
                          className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-tertiary">
                    No external files yet.
                  </p>
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CustomCodeDialog;
