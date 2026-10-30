"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bot, Code2, Copy, ExternalLink, Loader2, MessageSquare, Plus, Sparkles, SquareTerminal, Trash2, Wrench } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, SectionCard, EmptyState, Field } from "@/components/internal/shared/screen_kit";
import { LogoLoading } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { buildAppCatalog, validateCallbackUrl } from "@/lib/mcp/app_catalog";
import { MCP_PUBLIC_ORIGIN, MCP_RESOURCE_URL } from "@/lib/mcp/config";
import { createMcpClient, listMcpClients, softDeleteMcpClient } from "@/lib/supabase/mcp_clients";
import { getUser } from "@/lib/supabase/user";

const APP_ICONS = {
  claude: Sparkles,
  chatgpt: MessageSquare,
  cursor: Code2,
  vscode: Code2,
  "claude-code": SquareTerminal,
  codex: SquareTerminal,
};

const EMPTY_DRAFT = { name: "", redirectUri: "" };

async function copyText(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy that. Select the text and copy it yourself.");
  }
}

function AppIcon({ icon: Icon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
      <Icon className="size-4" />
    </span>
  );
}

function AppRow({ icon, name, description, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <AppIcon icon={icon} />
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function AppAction({ app, serverUrl }) {
  if (app.kind === "command") {
    return (
      <Button variant="outline" size="sm" onClick={() => copyText(app.command, app.toast)}>
        <Copy className="size-3.5" />
        {app.actionLabel}
      </Button>
    );
  }
  if (app.kind === "install") {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={app.href}>
          <ExternalLink className="size-3.5" />
          {app.actionLabel}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        // Opened first, while the click still counts as a user gesture.
        window.open(app.href, "_blank", "noopener,noreferrer");
        copyText(serverUrl, app.toast);
      }}
    >
      <ExternalLink className="size-3.5" />
      {app.actionLabel}
    </Button>
  );
}

function AddAppDialog({ open, onOpenChange, onAdd }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const callback = validateCallbackUrl(draft.redirectUri);
  const name = draft.name.trim();

  async function submit(event) {
    event.preventDefault();
    if (!name || !callback.ok) return;
    setSaving(true);
    const added = await onAdd({ name: name.slice(0, 80), redirectUri: callback.value });
    setSaving(false);
    if (added) {
      setDraft(EMPTY_DRAFT);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a custom app</DialogTitle>
            <DialogDescription>
              Use this for any app that supports remote MCP servers with OAuth sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="App name">
              <Input value={draft.name} onChange={set("name")} placeholder="Acme Agent" maxLength={80} autoFocus />
            </Field>
            <Field
              label="Callback URL"
              hint={
                callback.ok
                  ? "The address the app's OAuth settings list. Leave this blank for apps that run on your computer."
                  : undefined
              }
            >
              <Input
                value={draft.redirectUri}
                onChange={set("redirectUri")}
                placeholder="https://agent.acme.com/oauth/callback"
                autoComplete="off"
                spellCheck={false}
              />
              {callback.ok ? null : <p className="text-xs text-red-600 dark:text-red-400">{callback.error}</p>}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={saving || !name || !callback.ok}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Add app
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AiAppsScreen() {
  const [userId, setUserId] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const apps = useMemo(() => buildAppCatalog(MCP_RESOURCE_URL), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getUser();
      const rows = await listMcpClients(user?.id);
      if (!alive) return;
      setUserId(user?.id ?? null);
      setClients(rows ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleAdd({ name, redirectUri }) {
    if (!userId) {
      toast.error("Sign in to add a custom app.");
      return false;
    }
    const id = crypto.randomUUID();
    const optimistic = { id, name, redirectUri: redirectUri || "" };
    setClients((current) => [optimistic, ...current]);
    const created = await createMcpClient({ id, userId, name, redirectUri });
    if (!created) {
      setClients((current) => current.filter((client) => client.id !== id));
      toast.error("Couldn't add that app. Please try again.");
      return false;
    }
    setClients((current) => current.map((client) => (client.id === id ? created : client)));
    toast.success(`${name} added. Paste the server address into it to connect.`);
    return true;
  }

  async function handleRemove(client) {
    setClients((current) => current.filter((item) => item.id !== client.id));
    const removed = await softDeleteMcpClient(client.id);
    if (!removed) {
      setClients((current) => [client, ...current]);
      toast.error("Couldn't remove that app. Please try again.");
      return;
    }
    toast.success(`${client.name} removed`);
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="AI Apps"
        description="Connect an AI app to work with your events. You choose which projects it can reach and whether it can make changes when you sign in."
      />

      <SectionCard title="Server address" description="The address every app connects to.">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 basis-64 truncate rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm text-foreground">
            {MCP_RESOURCE_URL}
          </code>
          <Button variant="outline" size="sm" onClick={() => copyText(MCP_RESOURCE_URL, "Address copied")}>
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Apps">
        <div className="divide-y divide-border">
          {apps.map((app) => (
            <AppRow key={app.id} icon={APP_ICONS[app.id] || Bot} name={app.name} description={app.description}>
              <AppAction app={app} serverUrl={MCP_RESOURCE_URL} />
            </AppRow>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Custom apps"
        description="Allow any other app that supports remote MCP servers."
        action={
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add app
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <LogoLoading size={40} label="Loading custom apps" />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No custom apps yet"
            description="Add one to allow its sign-in, then paste the server address into the app."
          />
        ) : (
          <div className="divide-y divide-border">
            {clients.map((client) => (
              <AppRow
                key={client.id}
                icon={Wrench}
                name={client.name}
                description={client.redirectUri || "Runs on your computer"}
              >
                <Button variant="outline" size="sm" onClick={() => copyText(MCP_RESOURCE_URL, "Address copied")}>
                  <Copy className="size-3.5" />
                  Copy address
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${client.name}`}
                  onClick={() => handleRemove(client)}
                  className="size-8 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </AppRow>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="text-xs text-text-secondary">
        To see what&apos;s connected or disconnect an app, go to{" "}
        <a href={`${MCP_PUBLIC_ORIGIN}/profile`} className="text-foreground underline underline-offset-2">
          your profile
        </a>
        , then Security.
      </p>

      <AddAppDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAdd} />
    </MainScreenWrapper>
  );
}

export default AiAppsScreen;
