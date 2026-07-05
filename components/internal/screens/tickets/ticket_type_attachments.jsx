"use client";

import React, { useEffect, useState } from "react";
import { CircleDot, ListChecks, Loader2, Plus, Ticket } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listRecords } from "@/lib/supabase/ticketing";
import { getDietaryConfig } from "@/lib/supabase/dietary";
import { currency } from "./constants";

// Opt this event's ticket form into the project's Dietary & Accessibility
// inquiry. Stores just a boolean; the questions live on the project config.
function AttachInquiryCard({ event }) {
  const { projectId } = useProject();
  const [cfg, , saveCfg] = useEventConfig(event, "dietaryInquiry", { attach: false });
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    let alive = true;
    getDietaryConfig(projectId).then((c) => {
      if (alive) setQuestions(c?.questions ?? []);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <SectionCard
      title="Dietary & Accessibility inquiry"
      description="Include the workspace inquiry questions in this event's ticket form. Build the question set in Registrations → Dietary & Accessibility."
    >
      <SettingsList>
        <SettingRow
          title="Attach Dietary & Accessibility inquiry"
          description="Ask these questions when someone fills in the ticket form."
          checked={!!cfg.attach}
          onCheckedChange={(v) =>
            saveCfg(
              { attach: v },
              { successMsg: v ? "Inquiry attached." : "Inquiry detached." },
            )
          }
        />
      </SettingsList>

      {cfg.attach ? (
        <div className="mt-4">
          {questions.length ? (
            <div className="space-y-2">
              {questions.map((q) => {
                const TypeIcon = q.type === "multiselect" ? ListChecks : CircleDot;
                return (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5"
                  >
                    <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{q.label}</span>
                        <Badge variant="neutral">
                          {q.type === "multiselect" ? "Multiple" : "Single"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No inquiry questions yet. Add them in Registrations → Dietary & Accessibility.
            </p>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

// Event-editor section: attach reusable ticket_type records to this event.
// Attachment ids live under metadata.attached.ticket_type, so one ticket applies
// to many events without duplication.
export function TicketTypeAttachmentsSection({ event, headerItem }) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [attached, , save] = useEventConfig(event, "attached", {});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRecords(projectId, "ticket_type").then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const selected = Array.isArray(attached.ticket_type) ? attached.ticket_type : [];

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    save({ ...attached, ticket_type: next });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Ticket Types"}
        description={
          headerItem?.desc ||
          "Attach reusable tickets to this event. Manage the tickets themselves under Tickets → Ticket Types."
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tickets…
        </div>
      ) : records.length ? (
        <div className="grid gap-3">
          {records.map((r) => {
            const on = selected.includes(r.id);
            const price = Number(r.config?.price) || 0;
            const qty = Number(r.config?.qty) || 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  on
                    ? "border-border-strong bg-surface-hover"
                    : "border-border bg-surface-subtle hover:border-border-strong hover:bg-surface-hover",
                  !r.active ? "opacity-60" : "",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    on
                      ? "border-white bg-white text-[#161616]"
                      : "border-border bg-surface-card text-muted-foreground",
                  )}
                >
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{r.name}</span>
                    {!r.active ? <Badge variant="neutral">Inactive</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {price === 0 ? "Free" : currency(price)} ·{" "}
                    {qty > 0 ? `${qty.toLocaleString()} cap` : "Unlimited"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    on
                      ? "border-border-strong bg-surface-active text-foreground"
                      : "border-border text-text-tertiary",
                  )}
                >
                  {on ? "Attached" : "Attach"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <SectionCard
          title="No tickets yet"
          description="Create a reusable ticket under Tickets → Ticket Types, then attach it here."
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab("Ticket Types")}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create a ticket
          </Button>
        </SectionCard>
      )}

      <AttachInquiryCard event={event} />
    </div>
  );
}

export default TicketTypeAttachmentsSection;
