"use client";

import { FieldValue, Muted, OptionChip } from "@/components/internal/screens/workspace/ws_ui";
import { allowedMoves } from "@/lib/workspace/process/stages.js";
import { useFileViewer, useOpenRecord, usePortalView } from "./portal_context";

export function StatusChip({ list, status }) {
  const item = list?.statuses?.find((entry) => entry.key === status);
  if (!item) return null;
  return <OptionChip option={{ label: item.label, color: item.color }} />;
}

// Statuses a record may move to under the list's stage rules, always including where it is now.
export function statusChoices(list, current) {
  const allowed = allowedMoves(list?.process, list, current ?? null);
  return (list?.statuses ?? []).filter((item) => !allowed || item.key === current || allowed.includes(item.key));
}

// One field of one record as this viewer may see it; fields hidden on this row show a dash.
export function CellValue({ list, fieldId, record, compact = true }) {
  const { eventId, timeZone } = usePortalView();
  const openRecord = useOpenRecord();
  const viewer = useFileViewer();
  if (fieldId === "status") return <StatusChip list={list} status={record.status} />;
  const field = list?.fields.find((item) => item.id === fieldId);
  if (!field) return null;
  const level = record.access?.fields?.[fieldId];
  if (!level || level === "hidden") return <Muted>—</Muted>;
  return (
    <FieldValue field={field} record={record} eventId={eventId} timeZone={timeZone} compact={compact}
      onOpenLink={(link) => openRecord({ id: link.id, list: link.list, number: link.number, objectId: field.config?.targetObjectId })}
      onOpenFile={viewer ? (file) => viewer.open(file, { recordId: record.id, fieldId }) : undefined} />
  );
}

export const fieldName = (list, fieldId) => (fieldId === "status" ? "Status" : list?.fields.find((field) => field.id === fieldId)?.name ?? "");
export const isVisibleOn = (record, fieldId) => fieldId === "status" || (record.access?.fields?.[fieldId] && record.access.fields[fieldId] !== "hidden");
