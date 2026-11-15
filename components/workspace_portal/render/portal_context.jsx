"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// What every block needs: the adapter (portal, preview or team), the lists on the page, the record a record page shows,
// who is looking, and a version number that bumps after a write so blocks reload.
//
// Adapter: { blockData(body, signal), command(body), lookup(params, signal), signUpload(body), signFile(params),
//   saveDraft(body), clearDraft(params), openRecord({ objectId, id, list, number }), navigate(slug), signIn?: { request, verify },
//   onSignedIn?(), readOnly?: string (why writes are off) }
const PortalViewContext = createContext(null);

// `revision` lets the builder force a reload after it saves the draft.
export function PortalViewProvider({ api, mode, eventId, timeZone, page, lists, record = null, comments = [], activity = [], session = null, revision = 0, children }) {
  const [bump, setBump] = useState(0);
  const refresh = useCallback(() => setBump((n) => n + 1), []);
  const version = `${revision}:${bump}`;
  const value = useMemo(() => ({
    api, mode, eventId, timeZone: timeZone || "UTC", page, lists: lists ?? {}, record, comments, activity, session, version, refresh,
  }), [api, mode, eventId, timeZone, page, lists, record, comments, activity, session, version, refresh]);
  return <PortalViewContext.Provider value={value}>{children}</PortalViewContext.Provider>;
}

export function usePortalView() {
  const value = useContext(PortalViewContext);
  if (!value) throw new Error("usePortalView needs a PortalViewProvider.");
  return value;
}

// Field definitions of a list by id, plus the list itself.
export function useList(objectId) {
  const { lists } = usePortalView();
  return useMemo(() => {
    const list = lists[objectId] ?? null;
    return { list, fields: list?.fields ?? [], byId: new Map((list?.fields ?? []).map((field) => [field.id, field])) };
  }, [lists, objectId]);
}

// Opens a record from a row or a link chip, filling in the list key when only the list id is known.
export function useOpenRecord() {
  const { api, lists } = usePortalView();
  return useCallback((record) => {
    if (!record || !api.openRecord) return;
    const list = record.list ?? lists[record.objectId]?.key;
    api.openRecord({ objectId: record.objectId, id: record.id, list, number: record.number });
  }, [api, lists]);
}

// Opens a file in the viewer (PDFs and images) or downloads it; the file must be on a record the viewer can see.
const FileContext = createContext(null);
export const FileViewerProvider = FileContext.Provider;
export const useFileViewer = () => useContext(FileContext);

// Fills {{event.name}} and {{person.name}} in builder text, escaping the values.
export function fillVariables(html, { event, person }) {
  const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return String(html ?? "")
    .replace(/\{\{\s*event\.name\s*\}\}/g, escape(event?.name ?? ""))
    .replace(/\{\{\s*person\.name\s*\}\}/g, escape(person?.name ?? ""));
}

export const STATUS_FIELD = { id: "status", name: "Status", type: "status" };
export const SORTABLE_SYSTEM = new Set(["number", "title", "status", "created_at", "updated_at"]);
