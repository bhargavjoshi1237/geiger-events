"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CircleCheck,
  CircleX,
  Inbox,
  Mail,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LoadingArea } from "@geiger/ui";
import {
  listSponsorEnquiries,
  removeSponsorEnquiry,
  updateSponsorEnquiry,
} from "@/lib/supabase/sponsor_enquiries";
import { placeFill } from "@/lib/events/sponsorship";
import { OptionSelect } from "../theme_controls";
import { ENQUIRY_STATUS_MAP, ENQUIRY_STATUSES } from "./constants";
import { useSponsorship } from "./use_sponsorship";
import { SponsorshipLoadError } from "./load_error";
import { FillDialog } from "./fill_dialog";

const FILTERS = [
  { key: "open", label: "Open (new + contacted)" },
  { key: "all", label: "All enquiries" },
  ...ENQUIRY_STATUSES.map((s) => ({ key: s, label: ENQUIRY_STATUS_MAP[s].label })),
];

const matches = (filter) => (row) =>
  filter === "all" ? true : filter === "open" ? row.status === "new" || row.status === "contacted" : row.status === filter;

const answerText = (value) => (typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? ""));

function EnquiryCard({ row, onStatus, onFill, onRemove }) {
  const answers = row.answers.filter((a) => answerText(a.value).trim());
  const converted = row.status === "converted";
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{row.company || "Unnamed company"}</p>
            <StatusPill status={row.status} map={ENQUIRY_STATUS_MAP} />
          </div>
          <p className="text-xs text-text-secondary">
            {[row.contactName, row.email].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-text-tertiary">
            {[
              row.spotName ? `Asked about ${row.spotName}` : "Any spot",
              row.createdAt ? new Date(row.createdAt).toLocaleDateString() : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {row.email ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <a href={`mailto:${row.email}`} onClick={() => row.status === "new" && onStatus("contacted")}>
                <Mail className="h-4 w-4" /> Reply
              </a>
            </Button>
          ) : null}
          {!converted ? (
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onFill}>
              <UserPlus className="h-4 w-4" /> Fill spot
            </Button>
          ) : null}
          <ActionMenu
            label={`Actions for ${row.company || "enquiry"}`}
            items={[
              row.status !== "contacted" && !converted
                ? { icon: CircleCheck, label: "Mark contacted", onSelect: () => onStatus("contacted") }
                : null,
              row.status !== "declined" && !converted
                ? { icon: CircleX, label: "Decline", onSelect: () => onStatus("declined") }
                : null,
              row.status !== "new" && !converted
                ? { icon: RotateCcw, label: "Reopen as new", onSelect: () => onStatus("new") }
                : null,
              { separator: true },
              { icon: Trash2, label: "Delete", variant: "destructive", onSelect: onRemove },
            ].filter(Boolean)}
          />
        </div>
      </div>

      {answers.length ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-border pt-3 sm:grid-cols-2">
          {answers.map((a) => (
            <div key={a.id} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-text-tertiary">{a.label}</dt>
              <dd className="whitespace-pre-line break-words text-sm text-text-secondary">{answerText(a.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function EventSponsorEnquiriesSection({ event, headerItem, onPatch, onNavigate }) {
  const { spots, saveSpots, records, addRecord, projectId, loadError, reload } = useSponsorship(event, onPatch);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("open");
  const [converting, setConverting] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!event?.id) return undefined;
    listSponsorEnquiries(event.id).then((res) => {
      if (alive) setRows(res || []);
    });
    return () => {
      alive = false;
    };
  }, [event?.id]);

  const replaceRow = (next) => setRows((list) => list.map((r) => (r.id === next.id ? next : r)));

  const setStatus = async (row, status) => {
    const next = await updateSponsorEnquiry(row.id, { status });
    if (!next) {
      toast.error("Couldn't update that enquiry.");
      return;
    }
    replaceRow(next);
  };

  const remove = async (row) => {
    if (!(await removeSponsorEnquiry(row.id))) {
      toast.error("Couldn't delete that enquiry.");
      return;
    }
    setRows((list) => list.filter((r) => r.id !== row.id));
  };

  const convert = async ({ spotId, fill }) => {
    const ok = await saveSpots(placeFill(spots, spotId, fill), "Spot filled.");
    if (!ok) return false;
    const next = await updateSponsorEnquiry(converting.id, { status: "converted", sponsorId: fill.sponsorId });
    if (next) replaceRow(next);
    else toast.error("Spot filled, but the enquiry couldn't be marked converted.");
    return true;
  };

  const visible = (rows || []).filter(matches(filter));
  const openCount = (rows || []).filter(matches("open")).length;

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Sponsor Enquiries"}
        description={
          headerItem?.desc ||
          "Interest from your sponsorship page. Talk it through off-platform, then fill the spot here."
        }
        action={
          rows?.length ? (
            <div className="w-56">
              <OptionSelect value={filter} onChange={setFilter} options={FILTERS} />
            </div>
          ) : null
        }
      />

      {loadError ? <SponsorshipLoadError onRetry={reload} /> : rows === null || records === null ? (
        <LoadingArea panel label="Loading enquiries" />
      ) : !rows.length ? (
        <EmptyState
          icon={Inbox}
          title="No enquiries yet"
          description="When someone fills in the interest form on your sponsorship page, it lands here."
          action={
            onNavigate ? (
              <Button
                variant="outline"
                onClick={() => onNavigate("sponsorpage")}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                Set up the sponsorship page
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {openCount} open · {rows.length} total
          </p>
          {visible.length ? (
            <div className="space-y-3">
              {visible.map((row) => (
                <EnquiryCard
                  key={row.id}
                  row={row}
                  onStatus={(status) => setStatus(row, status)}
                  onFill={() => setConverting(row)}
                  onRemove={() => remove(row)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-text-secondary">
              Nothing matches this filter.
            </p>
          )}
        </>
      )}

      <FillDialog
        open={!!converting}
        onOpenChange={(o) => !o && setConverting(null)}
        spots={spots}
        spotId={spots.some((s) => s.id === converting?.spotId) ? converting.spotId : ""}
        prefill={
          converting
            ? {
                company: converting.company,
                contactName: converting.contactName,
                email: converting.email,
                enquiryId: converting.id,
              }
            : null
        }
        records={records}
        projectId={projectId}
        onRecordCreated={addRecord}
        onSave={convert}
      />
    </div>
  );
}

export default EventSponsorEnquiriesSection;
