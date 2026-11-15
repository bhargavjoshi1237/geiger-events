"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@geiger/ui";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import { API_BASE_URL } from "@/lib/api_webhooks/catalog";
import { useProject } from "@/context/project-context";

// How other systems reach this workspace: the public API with a workspace-scoped key, and workspace webhook events.
export function ApiSection({ eventId, ws }) {
  const { project } = useProject();
  const list = [...ws.objects].sort((a, b) => a.position - b.position)[0];
  const base = `${API_BASE_URL}/workspace/${eventId}`;
  const key = "gev_live_…";
  const firstText = list ? liveText(ws, list.id) : null;
  const examples = [
    ["Lists and fields", `curl -H "Authorization: Bearer ${key}" \\\n  ${base}/lists`],
    ...(list ? [
      [`${list.plural}, newest first`, `curl -H "Authorization: Bearer ${key}" \\\n  "${base}/lists/${list.key}/records?sort=-number&limit=10"`],
      [`Add a ${list.name.toLowerCase()}`, `curl -X POST -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" \\\n  -d '{"values": {"${firstText ?? "field_key"}": "…"}}' \\\n  ${base}/lists/${list.key}/records`],
    ] : []),
  ];
  return (
    <SectionCard title="API and webhooks"
      description="Other systems can read and change this workspace with an API key that has the read:workspace or write:workspace scope. API writes follow the stage rules and show in the history as the key.">
      <div className="space-y-3">
        {examples.map(([label, code]) => (
          <div key={label} className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">{label}</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-surface-subtle p-3 font-mono text-xs text-foreground">{code}</pre>
          </div>
        ))}
        <p className="text-xs text-text-tertiary">
          Filters use the workspace filter format with field keys, for example {"filter={\"op\":\"and\",\"items\":[{\"field\":\"status\",\"operator\":\"eq\",\"value\":\"accepted\"}]}"}.
          Send an Idempotency-Key header to make a write safe to retry. Webhook endpoints can subscribe to workspace.record.created, .updated, .deleted and workspace.status.changed.
        </p>
        {project?.id ? (
          <Button asChild variant="outline" size="sm"><Link href={`/project/${project.id}/apiwebhooks`}><ExternalLink className="h-4 w-4" />Keys and webhook endpoints</Link></Button>
        ) : null}
      </div>
    </SectionCard>
  );
}

// The first plain text field's key, for the example request body.
function liveText(ws, objectId) {
  return (ws.data?.fields ?? []).filter((field) => field.objectId === objectId && !field.deletedAt && field.type === "short_text")
    .sort((a, b) => a.position - b.position)[0]?.key ?? null;
}
