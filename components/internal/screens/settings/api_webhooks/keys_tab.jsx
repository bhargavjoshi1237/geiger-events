"use client";

import { Ban, Copy, KeyRound, Plus } from "lucide-react";

import { DataTable, EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { KEY_STATUS_MAP, copyText, formatDate, formatRelativeTime } from "./constants";

const STATUS_ORDER = { active: 0, expired: 1, revoked: 2 };

function ScopeBadges({ scopes }) {
  const shown = scopes.slice(0, 3);
  const rest = scopes.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((scope) => (
        <Badge key={scope} variant="outline" className="font-mono">
          {scope}
        </Badge>
      ))}
      {rest > 0 ? <Badge variant="outline">+{rest}</Badge> : null}
    </div>
  );
}

export default function KeysTab({ keys, canManage, onCreate, onRevoke }) {
  const rows = [...keys].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.createdAt) - new Date(a.createdAt),
  );

  const columns = [
    {
      key: "name",
      header: "Key",
      render: (k) => (
        <div className={cn("flex items-center gap-3", k.status !== "active" && "opacity-60")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-foreground">{k.name}</span>
            <span className="font-mono text-xs text-text-secondary">{k.prefix}…</span>
          </div>
        </div>
      ),
    },
    { key: "scopes", header: "Permissions", render: (k) => <ScopeBadges scopes={k.scopes} /> },
    {
      key: "used",
      header: "Last used",
      render: (k) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-secondary">{k.lastUsedAt ? formatRelativeTime(k.lastUsedAt) : "Never"}</span>
          {k.lastUsedIp ? <span className="font-mono text-[11px] text-text-tertiary">{k.lastUsedIp}</span> : null}
        </div>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (k) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-secondary">{formatDate(k.createdAt)}</span>
          <span className="text-[11px] text-text-tertiary">
            {k.revokedAt
              ? `Revoked ${formatDate(k.revokedAt)}`
              : k.expiresAt
                ? `${k.status === "expired" ? "Expired" : "Expires"} ${formatDate(k.expiresAt)}`
                : "No expiry"}
          </span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (k) => <StatusPill status={k.status} map={KEY_STATUS_MAP} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (k) => (
        <ActionMenu
          label={`Actions for ${k.name}`}
          items={[
            { icon: Copy, label: "Copy prefix", onSelect: () => copyText(k.prefix, "Prefix copied") },
            k.status === "active" && canManage
              ? { icon: Ban, label: "Revoke key", destructive: true, onSelect: () => onRevoke(k) }
              : null,
          ]}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(k) => k.id}
      empty={
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create a key to read events, orders and attendees from your own systems, or to check guests in."
            action={
              canManage ? (
                <Button variant="outline" size="sm" onClick={onCreate}>
                  <Plus className="size-3.5" />
                  Create key
                </Button>
              ) : null
            }
          />
        </div>
      }
    />
  );
}
