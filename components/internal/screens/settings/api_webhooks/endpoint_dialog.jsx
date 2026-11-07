"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { WEBHOOK_EVENT_GROUPS } from "@/lib/api_webhooks/catalog";
import { checkWebhookUrl } from "@/lib/api_webhooks/url";

// Add or edit an endpoint. `endpoint` null = add. Mount with a key so each open starts from the endpoint's values.
export default function EndpointDialog({ open, endpoint, onOpenChange, onSave }) {
  const [url, setUrl] = useState(endpoint?.url || "");
  const [description, setDescription] = useState(endpoint?.description || "");
  const [types, setTypes] = useState(endpoint?.eventTypes || []);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const all = types.includes("*");
  const urlCheck = checkWebhookUrl(url);
  const canSubmit = urlCheck.ok && types.length > 0 && !saving;

  const toggle = (type, on) => setTypes((current) => (on ? [...current, type] : current.filter((t) => t !== type)));
  const toggleGroup = (group, on) =>
    setTypes((current) => {
      const keys = group.types.map((t) => t.type);
      const rest = current.filter((t) => !keys.includes(t));
      return on ? [...rest, ...keys] : rest;
    });

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setSaving(true);
    const ok = await onSave({ url: urlCheck.value, description: description.trim(), eventTypes: types });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{endpoint ? "Edit endpoint" : "Add endpoint"}</DialogTitle>
            <DialogDescription>
              Geiger POSTs signed JSON to this URL whenever a chosen event happens, and retries for about a day if
              it doesn&apos;t answer with a 2xx.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Endpoint URL">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="https://hooks.example.com/geiger"
                autoComplete="off"
                spellCheck={false}
                autoFocus={!endpoint}
              />
              {touched && !urlCheck.ok ? (
                <p className="text-xs text-red-600 dark:text-red-400">{urlCheck.error}</p>
              ) : null}
            </Field>
            <Field label="Description (optional)">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Sync orders to our CRM"
                maxLength={200}
              />
            </Field>
            <Field label="Events to send">
              <div className="rounded-lg border border-border bg-surface-card">
                <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">All events</span>
                    <span className="block text-xs text-text-secondary">Includes event types added later.</span>
                  </span>
                  <Checkbox checked={all} onCheckedChange={(v) => setTypes(v ? ["*"] : [])} />
                </label>
                {all ? null : (
                  <div className="max-h-72 overflow-y-auto border-t border-border">
                    {WEBHOOK_EVENT_GROUPS.map((group) => {
                      const picked = group.types.filter((t) => types.includes(t.type)).length;
                      return (
                        <div key={group.group} className="border-b border-border last:border-b-0">
                          <label className="flex cursor-pointer items-center justify-between gap-3 bg-surface-subtle px-3 py-2">
                            <span className="text-xs font-medium text-text-secondary">{group.group}</span>
                            <Checkbox
                              checked={picked === group.types.length ? true : picked ? "indeterminate" : false}
                              onCheckedChange={(v) => toggleGroup(group, !!v)}
                              aria-label={`All ${group.group} events`}
                            />
                          </label>
                          {group.types.map((t) => (
                            <label
                              key={t.type}
                              className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-surface-hover"
                            >
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-x-2 text-sm text-foreground">
                                  {t.label}
                                  <code className="font-mono text-[11px] text-text-tertiary">{t.type}</code>
                                </span>
                                <span className="block text-xs text-text-secondary">{t.description}</span>
                              </span>
                              <Checkbox checked={types.includes(t.type)} onCheckedChange={(v) => toggle(t.type, !!v)} />
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {touched && !types.length ? (
                <p className="text-xs text-red-600 dark:text-red-400">Choose at least one event.</p>
              ) : null}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {endpoint ? "Save changes" : "Add endpoint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
