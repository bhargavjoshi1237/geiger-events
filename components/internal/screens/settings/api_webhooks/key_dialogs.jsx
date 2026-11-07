"use client";

import { useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { API_KEY_EXPIRY_OPTIONS, API_SCOPES } from "@/lib/api_webhooks/catalog";
import { CopyField } from "./code_block";

// Create a key; on success the same dialog shows the full key once.
export function CreateKeyDialog({ open, onOpenChange, onCreate }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["read:events"]);
  const [expiry, setExpiry] = useState("never");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const toggle = (key, on) => setScopes((current) => (on ? [...current, key] : current.filter((s) => s !== key)));
  const canSubmit = name.trim() && scopes.length && !saving;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const result = await onCreate({ name: name.trim(), scopes, expiry });
    setSaving(false);
    if (result?.secret) setCreated(result);
  }

  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it somewhere safe, like your server&apos;s secrets
              manager. If you lose it, revoke it and create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <CopyField value={created.secret} copyMessage="API key copied" />
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-text-secondary">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              Anyone with this key can use its permissions for this project. Keep it out of browsers, apps and code
              repositories.
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>Give the key only the permissions the integration needs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Name" hint="Where it's used, e.g. “CRM sync” or “Door scanners”.">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </Field>
            <Field label="Permissions">
              <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
                {API_SCOPES.map((scope) => (
                  <label key={scope.key} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-surface-hover">
                    <Checkbox
                      className="mt-0.5"
                      checked={scopes.includes(scope.key)}
                      onCheckedChange={(v) => toggle(scope.key, !!v)}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 text-sm text-foreground">
                        {scope.label}
                        <code className="font-mono text-[11px] text-text-tertiary">{scope.key}</code>
                      </span>
                      <span className="block text-xs text-text-secondary">{scope.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Expires">
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_KEY_EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={!canSubmit}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Create key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeKeyDialog({ apiKey, onOpenChange, onRevoke }) {
  const [saving, setSaving] = useState(false);

  async function revoke() {
    setSaving(true);
    const ok = await onRevoke(apiKey);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={!!apiKey} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke this key?</DialogTitle>
          <DialogDescription>
            {apiKey
              ? `Anything using “${apiKey.name}” (${apiKey.prefix}…) stops working immediately. This can't be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={revoke} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Revoke key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
