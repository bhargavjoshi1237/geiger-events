"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Radio,
  Download,
  Upload,
  CheckCircle2,
  Smartphone,
  Info,
  Plus,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  KeyRound,
  Zap,
  Link2,
  Unlink,
  Receipt,
  Loader2,
} from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
  DataTable,
  EmptyState,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import {
  listRegistrations,
  listRegistrationsByEvent,
} from "@/lib/supabase/registrations";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import {
  listEntryPointsByEvent,
  createEntryPoint,
  updateEntryPoint,
  softDeleteEntryPoint,
  listCredentialsByEvent,
  bindCredential,
  setCredentialActive,
  unbindCredential,
  listTapsByEvent,
  settleTap,
  voidTap,
  reopenTap,
  summarizeBills,
  simulateTap,
  normalizeNfcUid,
} from "@/lib/supabase/nfc";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import {
  RFID_MEDIUM_OPTIONS,
  RFID_RANGE_OPTIONS,
  RFID_RANGE_SPECS,
  NFC_BILLING_MODES,
  NFC_BILLING_MODE_HINTS,
  NFC_CURRENCY_OPTIONS,
  NFC_TAP_STATUS_MAP,
  formatMoney,
  formatTime,
  genDeviceKey,
} from "./constants";

const ticketCode = (id) => String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();

function checksum(values) {
  let sum = 0;
  for (const v of values) {
    for (let i = 0; i < v.length; i++) sum = (sum + v.charCodeAt(i) * (i + 1)) % 0xffffffff;
  }
  return sum.toString(16).toUpperCase().padStart(6, "0").slice(-6);
}

// Explains the physical tech behind a read range so a project can quote a
// vendor and order matching stock, without the app locking them into one.
function RangeSpecDoc({ range }) {
  const spec = RFID_RANGE_SPECS[range] || RFID_RANGE_SPECS.short;
  return (
    <SectionCard title="What to order" description={spec.summary}>
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
        <p>
          <span className="font-medium text-foreground">Minimum spec: </span>
          {spec.spec} Give this to your badge/tag vendor and reader vendor — as long as both sides
          match, any manufacturer&apos;s stock will work with any compatible reader.
        </p>
      </div>
    </SectionCard>
  );
}

// Generates a sequential badge-ID range up front, before physical stock is
// ordered or handed out. "Order sheet" is blank IDs only (safe to send to a
// manufacturer with no attendee PII); "reader cross-check" pairs the same IDs
// against the registrant list in order, for import into the reader/access
// control system once badges are handed out in that sequence.
function RangeIdGenerator({ regs, loading }) {
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [padding, setPadding] = useState(4);
  // Null = untouched: fall back to the registrant count (or 100 while empty),
  // so no reset effect is needed once the list loads.
  const [count, setCount] = useState(null);

  const effectiveCount = count ?? regs.length ?? 100;

  const idAt = (i) => `${prefix}${String(Number(start) + i).padStart(Number(padding) || 0, "0")}`;

  const downloadOrderSheet = () => {
    const n = Number(effectiveCount) || 0;
    if (!n) {
      toast.error("Set how many badges to generate.");
      return;
    }
    downloadCsv(
      [{ header: "badge_id", value: (r) => r.id }],
      Array.from({ length: n }, (_, i) => ({ id: idAt(i) })),
      "badge-id-order-sheet.csv",
    );
    toast.success(`Order sheet exported (${n} IDs).`);
  };

  const downloadCrossCheck = () => {
    const n = Number(effectiveCount) || 0;
    if (!n) {
      toast.error("Set how many badges to generate.");
      return;
    }
    if (regs.length > n) {
      toast.error(`Only ${n} badge IDs for ${regs.length} attendees — raise the count first.`);
      return;
    }
    downloadCsv(
      [
        { header: "badge_id", value: (r) => r.badgeId },
        { header: "name", value: (r) => r.name || "" },
        { header: "email", value: (r) => r.email || "" },
        { header: "ticket_code", value: (r) => r.code || "" },
      ],
      Array.from({ length: n }, (_, i) => {
        const reg = regs[i];
        return { badgeId: idAt(i), name: reg?.name, email: reg?.email, code: reg ? ticketCode(reg.id) : "" };
      }),
      "badge-id-cross-check.csv",
    );
    toast.success(`Cross-check CSV exported (${n} rows, ${regs.length} matched).`);
  };

  return (
    <SectionCard
      title="Badge ID range"
      description="Pre-generate a numbered range so you can order stock before badges are assigned to attendees."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Prefix" hint="Optional.">
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="EVT-" />
        </Field>
        <Field label="Start at">
          <Input type="number" value={start} onChange={(e) => setStart(e.target.value)} min={0} />
        </Field>
        <Field label="Digits" hint="Zero-padding.">
          <Input type="number" value={padding} onChange={(e) => setPadding(e.target.value)} min={0} max={10} />
        </Field>
        <Field label="Count" hint={`${regs.length} registered`}>
          <Input type="number" value={effectiveCount} onChange={(e) => setCount(e.target.value)} min={0} />
        </Field>
      </div>
      <p className="mt-3 font-mono text-xs text-text-tertiary">
        e.g. {idAt(0)}, {idAt(1)}, {idAt(2)} …
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={downloadOrderSheet}
        >
          <Download className="h-4 w-4" /> Download order sheet
        </Button>
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          disabled={loading}
          onClick={downloadCrossCheck}
        >
          <Download className="h-4 w-4" /> Download reader cross-check
        </Button>
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        Order sheet has no attendee data — safe to send straight to a manufacturer. Cross-check pairs
        each ID to a registrant in list order, for whatever import format your reader/access-control
        system takes (most accept a plain CSV or badge-ID lookup table; check your vendor&apos;s docs for
        the exact column names it expects).
      </p>
    </SectionCard>
  );
}

function RfidDataSync({ regs, loading }) {
  const [verify, setVerify] = useState(null);
  const fileRef = useRef(null);

  const download = () => {
    if (!regs.length) {
      toast.error("No attendees to export yet.");
      return;
    }
    downloadCsv(
      [
        { header: "ticket_code", value: (r) => ticketCode(r.id) },
        { header: "name", value: (r) => r.name },
        { header: "email", value: (r) => r.email },
        { header: "rfid_id", value: () => "" },
        { header: "checksum", value: (r) => checksum([ticketCode(r.id)]) },
      ],
      regs,
      "rfid-attendee-map.csv",
    );
    toast.success("Attendee map exported.");
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.slice(1);
      const codes = rows
        .map((l) => l.split(",")[0]?.trim())
        .filter(Boolean);
      setVerify({ rows: codes.length, sum: checksum(codes) });
      toast.success(`Verified ${codes.length} rows.`);
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <SectionCard
      title="Encoding data"
      description="Download the attendee→ID map to program devices, then upload the encoded file to verify its checksum before the event."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          disabled={loading}
          onClick={download}
        >
          <Download className="h-4 w-4" /> Download attendee map
          <span className="ml-1 text-xs text-text-tertiary">({regs.length})</span>
        </Button>
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Upload encoded file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onUpload}
        />
      </div>
      {verify ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {verify.rows} rows · checksum{" "}
          <span className="font-mono font-medium">{verify.sum}</span>
        </div>
      ) : null}
    </SectionCard>
  );
}

// Fetches the registrant list once and feeds it to both export tools below.
function RfidTools({ range }) {
  const { projectId } = useProject();
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listRegistrations(projectId).then((rows) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <>
      <RangeSpecDoc range={range} />
      <RangeIdGenerator regs={regs} loading={loading} />
      <RfidDataSync regs={regs} loading={loading} />
    </>
  );
}

// --- NFC paid entry ----------------------------------------------------------
// Entry points are per-event scanning devices with their own price. A tap
// (hardware -> POST /api/nfc/tap -> nfc_tap RPC) resolves the UID to an
// attendee and files a ledger row snapshotting the point's amount — the
// attendee lands on a pending bill for X without any till interaction.

const TAP_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All taps" },
  { value: "pending", label: "Pending" },
  { value: "settled", label: "Settled" },
  { value: "void", label: "Void" },
  { value: "free", label: "Free" },
];

function PointFormInner({ initial, defaultCurrency, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [gate, setGate] = useState(initial?.gate || "");
  const [zone, setZone] = useState(initial?.zone || "");
  const [mode, setMode] = useState(initial?.billingMode || "paid_every_tap");
  const [amount, setAmount] = useState(
    initial ? ((Number(initial.amountCents) || 0) / 100).toFixed(2) : "5.00",
  );
  const [currency, setCurrency] = useState(
    initial?.currency || defaultCurrency || "usd",
  );
  const [active, setActive] = useState(initial ? initial.active !== false : true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the entry point a name.");
      return;
    }
    const cents = Math.max(0, Math.round((Number(amount) || 0) * 100));
    if (mode !== "free" && cents <= 0) {
      toast.error("Set an amount above zero — or switch to free entry.");
      return;
    }
    setSaving(true);
    await onSave({
      name: name.trim(),
      location: location.trim(),
      gate: gate.trim(),
      zone: zone.trim(),
      billingMode: mode,
      amountCents: mode === "free" ? 0 : cents,
      currency,
      active,
    });
    setSaving(false);
  };

  return (
    <>
      <div className="grid gap-4">
        <Field label="Name" htmlFor="nfc-point-name">
          <Input
            id="nfc-point-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dodgems gate"
            autoFocus
          />
        </Field>
        <Field label="Location" htmlFor="nfc-point-loc">
          <Input
            id="nfc-point-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. North field, booth 3"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gate (optional)">
            <Input value={gate} onChange={(e) => setGate(e.target.value)} placeholder="North entrance" />
          </Field>
          <Field label="Zone (optional)">
            <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="VIP" />
          </Field>
        </div>
        <Field label="Billing">
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-9 w-full bg-surface-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NFC_BILLING_MODES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-text-tertiary">{NFC_BILLING_MODE_HINTS[mode]}</p>
        </Field>
        {mode !== "free" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 w-full bg-surface-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NFC_CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
          <span className="text-sm text-foreground">Active</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : initial ? "Save" : "Create point"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Shell owns the Dialog open state; the inner form mounts fresh on every open
// (keyed by the edited point) so field state initializes from props with no
// reset effect.
function PointFormDialog({ open, onClose, initial, defaultCurrency, onSave }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit entry point" : "New entry point"}</DialogTitle>
          <DialogDescription>
            A physical spot with a reader — a ride gate, VIP zone, bar
            counter. Taps here bill the attendee&apos;s pending bill.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PointFormInner
            key={initial?.id || "new"}
            initial={initial}
            defaultCurrency={defaultCurrency}
            onSave={onSave}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EntryPointRow({ point, onEdit, onDelete, onChanged }) {
  const [reveal, setReveal] = useState(false);
  const [uid, setUid] = useState("");
  const [testing, setTesting] = useState(false);
  const [last, setLast] = useState(null);

  const modeLabel =
    NFC_BILLING_MODES.find((m) => m.value === point.billingMode)?.label ||
    point.billingMode;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(point.deviceKey);
      toast.success("Device key copied — paste it onto the reader.");
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  const rotateKey = async () => {
    const next = genDeviceKey();
    const saved = await updateEntryPoint(point.id, { deviceKey: next });
    if (!saved) {
      toast.error("Couldn't rotate the key.");
      return;
    }
    toast.success("Key rotated — update the reader, the old key is dead.");
    setReveal(true);
    onChanged();
  };

  const testTap = async () => {
    const clean = normalizeNfcUid(uid);
    if (!clean) {
      toast.error("Enter a UID to simulate a tap.");
      return;
    }
    setTesting(true);
    const res = await simulateTap({ deviceKey: point.deviceKey, nfcUid: clean });
    setTesting(false);
    setLast(res);
    if (res?.ok) {
      toast.success(
        res.status === "pending"
          ? `Billed ${formatMoney(res.amount_cents, res.currency)} to ${res.attendee?.name || "attendee"}`
          : `Tap logged (${res.status})`,
      );
      onChanged();
    } else {
      toast.error(
        res?.reason === "UNKNOWN_UID"
          ? "Unknown wristband — bind this UID below first."
          : res?.reason === "POINT_INACTIVE"
            ? "This point is inactive."
            : "Tap failed — check the reader key.",
      );
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{point.name}</p>
            {!point.active ? <Badge variant="neutral">Inactive</Badge> : null}
            <Badge variant="neutral">{modeLabel}</Badge>
            {point.billingMode !== "free" ? (
              <Badge variant="neutral" className="tabular-nums">
                {formatMoney(point.amountCents, point.currency)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-text-secondary">
            {[point.location, point.gate && `Gate: ${point.gate}`, point.zone && `Zone: ${point.zone}`]
              .filter(Boolean)
              .join(" · ") || "No location set"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => onEdit(point)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(point)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
        <KeyRound className="h-4 w-4 shrink-0 text-text-tertiary" />
        <span className="font-mono text-sm tracking-wider text-foreground">
          {reveal ? point.deviceKey || "—" : "••••••••••••••••"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setReveal((v) => !v)}>
            {reveal ? "Hide" : "Reveal"}
          </Button>
          <Button variant="ghost" size="sm" onClick={copyKey} disabled={!point.deviceKey}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={rotateKey}>
            <RefreshCw className="h-3.5 w-3.5" /> Rotate
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={uid}
          onChange={(e) => setUid(e.target.value.toUpperCase())}
          placeholder="Test UID, e.g. A1B2C3"
          className="h-9 max-w-52 font-mono uppercase"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={testing}
          onClick={testTap}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Test tap
        </Button>
        {last ? (
          <span className={`text-xs ${last.ok ? "text-emerald-300" : "text-red-400"}`}>
            {last.ok
              ? `${last.attendee?.name || "?"} · ${last.status}${last.status === "pending" ? ` · ${formatMoney(last.amount_cents, last.currency)}` : ""}${last.deduped ? " · replay" : ""}`
              : `Failed: ${last.reason || "error"}`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Paid tap points + UID bindings + the pending-bill ledger for one event.
function PaidEntryManager({ defaultCurrency }) {
  const { projectId } = useProject();
  const [events, setEvents] = useState(null); // null = loading
  const [eventId, setEventId] = useState("");
  const [points, setPoints] = useState([]);
  const [creds, setCreds] = useState([]);
  const [taps, setTaps] = useState([]);
  const [regs, setRegs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bindUid, setBindUid] = useState("");
  const [bindQuery, setBindQuery] = useState("");
  const [bindId, setBindId] = useState("");
  const [credSearch, setCredSearch] = useState("");
  const [tapSearch, setTapSearch] = useState("");
  const [tapStatus, setTapStatus] = useState("all");
  const importRef = useRef(null);
  // Mirrors of the selection for use inside async continuations (effects only
  // setState from promise callbacks, never synchronously).
  const eventIdRef = useRef("");
  const loadedRef = useRef("");
  const requestRef = useRef(0);

  const loadEventData = useCallback(async (id) => {
    const n = requestRef.current + 1;
    requestRef.current = n;
    loadedRef.current = id;
    if (!id) {
      setPoints([]);
      setCreds([]);
      setTaps([]);
      setRegs([]);
      return;
    }
    setRefreshing(true);
    const [p, c, t, r] = await Promise.all([
      listEntryPointsByEvent(id),
      listCredentialsByEvent(id),
      listTapsByEvent(id),
      listRegistrationsByEvent(id),
    ]);
    if (loadedRef.current !== id || requestRef.current !== n) return;
    setPoints(p ?? []);
    setCreds(c ?? []);
    setTaps(t ?? []);
    setRegs(r ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      const list = rows ?? [];
      setEvents(list);
      const next = list.some((e) => e.id === eventIdRef.current)
        ? eventIdRef.current
        : list[0]?.id || "";
      eventIdRef.current = next;
      setEventId(next);
      if (loadedRef.current !== next) loadEventData(next);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId, loadEventData]);

  const loading = events === null;
  const eventList = events ?? [];

  const pickEvent = (id) => {
    eventIdRef.current = id;
    setEventId(id);
    loadEventData(id);
  };

  const refresh = () => loadEventData(eventIdRef.current);

  const event = eventList.find((e) => e.id === eventId) || null;
  const rfidOff =
    event && event.checkinDoorKiosk && event.checkinDoorKiosk.rfid === false;

  const savePoint = async (patch) => {
    if (editing) {
      const saved = await updateEntryPoint(editing.id, patch);
      if (!saved) {
        toast.error("Couldn't save your changes.");
        return;
      }
      toast.success("Entry point saved.");
    } else {
      const saved = await createEntryPoint({
        id: crypto.randomUUID(),
        projectId,
        eventId,
        deviceKey: genDeviceKey(),
        createdBy: userId,
        ...patch,
      });
      if (!saved) {
        toast.error("Couldn't create the entry point.");
        return;
      }
      toast.success("Entry point created — copy its device key onto the reader.");
    }
    setDialogOpen(false);
    setEditing(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    setPoints((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success(`Deleted "${deleteTarget.name}".`);
    const ok = await softDeleteEntryPoint(deleteTarget.id);
    if (ok === false) toast.error("Couldn't delete on the server.");
  };

  const bindUidNow = async (explicitId) => {
    const uid = normalizeNfcUid(bindUid);
    if (!uid) {
      toast.error("Enter the UID printed on the wristband or card.");
      return;
    }
    const targetId = explicitId || bindId;
    if (!targetId) {
      toast.error("Pick the attendee this wristband belongs to.");
      return;
    }
    const reg = regs.find((r) => r.id === targetId);
    const saved = await bindCredential({
      eventId,
      projectId,
      registrationId: reg?.id || null,
      nfcUid: uid,
      label: reg?.name || "",
    });
    if (!saved) {
      toast.error("Couldn't bind that wristband.");
      return;
    }
    toast.success(`Bound ${uid} to ${reg?.name || "attendee"}.`);
    setBindUid("");
    setBindQuery("");
    setBindId("");
    refresh();
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result || "").split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        toast.error("That CSV has no data rows.");
        return;
      }
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const uidIdx = header.findIndex((h) => ["nfc_uid", "rfid_id", "badge_id", "uid"].includes(h));
      const codeIdx = header.findIndex((h) => ["ticket_code", "ticketcode", "code"].includes(h));
      const emailIdx = header.indexOf("email");
      const nameIdx = header.indexOf("name");
      if (uidIdx < 0) {
        toast.error("Need an nfc_uid column (or rfid_id / badge_id).");
        return;
      }
      const byCode = new Map(regs.map((r) => [ticketCode(r.id), r]));
      const byEmail = new Map(regs.map((r) => [String(r.email || "").toLowerCase(), r]));
      let bound = 0;
      let skipped = 0;
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map((c) => c.trim());
        const uid = normalizeNfcUid(cols[uidIdx]);
        if (!uid) {
          skipped += 1;
          continue;
        }
        let reg = null;
        if (codeIdx >= 0 && cols[codeIdx]) reg = byCode.get(cols[codeIdx].toUpperCase()) || null;
        if (!reg && emailIdx >= 0 && cols[emailIdx]) reg = byEmail.get(cols[emailIdx].toLowerCase()) || null;
        if (!reg && nameIdx >= 0 && cols[nameIdx]) {
          const q = cols[nameIdx].toLowerCase();
          reg = regs.find((r) => String(r.name || "").toLowerCase() === q) || null;
        }
        if (!reg) {
          skipped += 1;
          continue;
        }
        const saved = await bindCredential({
          eventId,
          projectId,
          registrationId: reg.id,
          nfcUid: uid,
          label: reg.name || "",
        });
        if (saved) bound += 1;
        else skipped += 1;
      }
      toast.success(`Bound ${bound} wristband${bound === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.`);
      refresh();
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
    e.target.value = "";
  };

  const tapAction = async (tap, fn, label) => {
    setTaps((prev) => prev.map((t) => (t.id === tap.id ? { ...t, status: label } : t)));
    const saved = await fn(tap.id);
    if (!saved) {
      toast.error("Couldn't update that charge.");
      refresh();
      return;
    }
    toast.success(`Charge ${label}.`);
    refresh();
  };

  const bindMatches = useMemo(() => {
    const q = bindQuery.trim().toLowerCase();
    if (!q) return regs.slice(0, 8);
    return regs
      .filter(
        (r) =>
          String(r.name || "").toLowerCase().includes(q) ||
          String(r.email || "").toLowerCase().includes(q) ||
          ticketCode(r.id).toLowerCase().includes(q.replace(/\s+/g, "")),
      )
      .slice(0, 8);
  }, [regs, bindQuery]);

  const filteredCreds = useMemo(() => {
    const q = credSearch.trim().toLowerCase();
    const regName = new Map(regs.map((r) => [r.id, r.name]));
    return creds.filter((c) => {
      if (!q) return true;
      return (
        c.nfcUid.toLowerCase().includes(q) ||
        String(c.label || "").toLowerCase().includes(q) ||
        String(regName.get(c.registrationId) || "").toLowerCase().includes(q)
      );
    });
  }, [creds, credSearch, regs]);

  const pointName = useMemo(
    () => new Map(points.map((p) => [p.id, p.name])),
    [points],
  );

  const filteredTaps = useMemo(() => {
    const q = tapSearch.trim().toLowerCase();
    return taps.filter(
      (t) =>
        (tapStatus === "all" ? true : t.status === tapStatus) &&
        (q
          ? String(t.attendeeName || "").toLowerCase().includes(q) ||
            t.nfcUid.toLowerCase().includes(q)
          : true),
    );
  }, [taps, tapSearch, tapStatus]);

  const bills = useMemo(() => summarizeBills(taps), [taps]);
  const pendingCents = bills.reduce((s, b) => s + b.pendingCents, 0);
  const settledCents = bills.reduce((s, b) => s + b.settledCents, 0);
  const openBills = bills.filter((b) => b.pendingCents > 0).length;
  const billCurrency = taps.find((t) => t.status === "pending")?.currency
    || points[0]?.currency
    || defaultCurrency
    || "usd";

  const credColumns = [
    {
      key: "uid",
      header: "UID",
      className: "whitespace-nowrap font-mono",
      headClassName: "whitespace-nowrap",
      render: (c) => c.nfcUid,
    },
    {
      key: "who",
      header: "Attendee",
      className: "w-full",
      headClassName: "w-full",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {regs.find((r) => r.id === c.registrationId)?.name || c.label || "—"}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {regs.find((r) => r.id === c.registrationId)?.email || ""}
          </p>
        </div>
      ),
    },
    {
      key: "state",
      header: "State",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (c) => (
        <Badge variant="neutral">{c.active ? "Active" : "Disabled"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "whitespace-nowrap text-right",
      headClassName: "whitespace-nowrap",
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const saved = await setCredentialActive(c.id, !c.active);
              if (!saved) toast.error("Couldn't update that binding.");
              else refresh();
            }}
          >
            {c.active ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setCreds((prev) => prev.filter((x) => x.id !== c.id));
              const ok = await unbindCredential(c.id);
              if (ok === false) {
                toast.error("Couldn't unbind on the server.");
                refresh();
              } else toast.success("Wristband unbound.");
            }}
          >
            <Unlink className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const tapColumns = [
    {
      key: "when",
      header: "Time",
      className: "whitespace-nowrap text-xs text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (t) => formatTime(t.tappedAt) || "—",
    },
    {
      key: "who",
      header: "Attendee",
      className: "w-full",
      headClassName: "w-full",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{t.attendeeName || "—"}</p>
          <p className="truncate font-mono text-[11px] text-text-tertiary">{t.nfcUid}</p>
        </div>
      ),
    },
    {
      key: "point",
      header: "Point",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (t) => pointName.get(t.entryPointId) || "Deleted point",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (t) => formatMoney(t.amountCents, t.currency),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (t) => <StatusPill status={t.status} map={NFC_TAP_STATUS_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "whitespace-nowrap text-right",
      headClassName: "whitespace-nowrap",
      render: (t) =>
        t.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => tapAction(t, settleTap, "settled")}>
              Settle
            </Button>
            <Button variant="ghost" size="sm" onClick={() => tapAction(t, voidTap, "void")}>
              Void
            </Button>
          </div>
        ) : t.status === "void" || t.status === "settled" ? (
          <Button variant="ghost" size="sm" onClick={() => tapAction(t, reopenTap, "pending")}>
            Reopen
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Paid entry points"
        description="Each point is a reader with its own price. Taps bill the attendee's pending bill — settled later at the till or desk."
        action={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!eventId}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New point
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="max-w-xs">
            <Select value={eventId} onValueChange={pickEvent}>
              <SelectTrigger className="h-9 w-full bg-surface-card">
                <SelectValue placeholder={loading ? "Loading events…" : "Pick an event"} />
              </SelectTrigger>
              <SelectContent>
                {eventList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!eventList.length && !loading ? (
            <p className="text-sm text-text-secondary">
              Create an event first — entry points live on events.
            </p>
          ) : null}
          {rfidOff ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                RFID / NFC entry is switched off for this event (event editor →
                Door Sales &amp; Kiosk). Readers will still bill, but the toggle
                signals staff that tap entry isn&apos;t expected here.
              </span>
            </div>
          ) : null}
          {refreshing ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading points…
            </div>
          ) : points.length ? (
            <div className="grid gap-3">
              {points.map((p) => (
                <EntryPointRow
                  key={p.id}
                  point={p}
                  onEdit={(pt) => {
                    setEditing(pt);
                    setDialogOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                  onChanged={refresh}
                />
              ))}
            </div>
          ) : eventId ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-6 py-10">
              <p className="text-center text-sm text-text-secondary">
                No entry points yet — add the ride gate, VIP zone, or bar
                counter and set its price.
              </p>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Wristband bindings"
        description="Link each NFC UID to an attendee. Unknown wristbands are rejected at the reader until bound here."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={!eventId}
            onClick={() => importRef.current?.click()}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
        }
      >
        <input
          ref={importRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={importCsv}
        />
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={bindQuery}
              onChange={(e) => {
                setBindQuery(e.target.value);
                setBindId("");
              }}
              placeholder="Search attendee…"
              className="h-10 bg-surface-card"
              list="nfc-bind-attendees"
              disabled={!eventId}
            />
            <datalist id="nfc-bind-attendees">
              {bindMatches.map((r) => (
                <option key={r.id} value={`${r.name} · ${r.email} · ${ticketCode(r.id)}`} />
              ))}
            </datalist>
            <Input
              value={bindUid}
              onChange={(e) => setBindUid(e.target.value.toUpperCase())}
              placeholder="NFC UID"
              className="h-10 bg-surface-card font-mono uppercase"
              disabled={!eventId}
            />
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 sm:col-span-1"
              disabled={!eventId}
              onClick={() => {
                // Resolve the datalist pick ("Name · email · CODE") to a reg.
                const q = bindQuery.trim().toLowerCase();
                const hit =
                  regs.find((r) => r.id === bindId) ||
                  regs.find((r) => `${r.name} · ${r.email} · ${ticketCode(r.id)}`.toLowerCase() === q) ||
                  (bindMatches.length === 1 ? bindMatches[0] : null);
                if (!hit) {
                  toast.error("Pick an attendee from the suggestions first.");
                  return;
                }
                setBindId(hit.id);
                bindUidNow(hit.id);
              }}
            >
              <Link2 className="h-4 w-4" /> Bind
            </Button>
          </div>
          <p className="text-xs text-text-tertiary">
            CSV columns: <span className="font-mono">nfc_uid</span> plus one of{" "}
            <span className="font-mono">ticket_code</span>, <span className="font-mono">email</span>, or{" "}
            <span className="font-mono">name</span>. Re-binding a recycled wristband moves it.
          </p>
          <Toolbar>
            <SearchInput value={credSearch} onChange={setCredSearch} placeholder="Search bindings…" />
          </Toolbar>
          {filteredCreds.length ? (
            <DataTable columns={credColumns} data={filteredCreds} getRowKey={(c) => c.id} />
          ) : (
            <EmptyState
              icon={Smartphone}
              title={creds.length ? "No matches" : "No wristbands bound"}
              description={
                creds.length
                  ? "Try a different search."
                  : "Bind each wristband's UID to its attendee so taps resolve at the reader."
              }
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Pending bills"
        description="Every paid tap lands here as pending. Settle at the till or desk; void mistakes."
      >
        <div className="space-y-4">
          <StatsBar
            stats={[
              { label: "Pending now", value: formatMoney(pendingCents, billCurrency), footer: `${openBills} open bill${openBills === 1 ? "" : "s"}` },
              { label: "Settled", value: formatMoney(settledCents, billCurrency), footer: "Collected" },
              { label: "Taps", value: String(taps.length), footer: "Logged at readers" },
            ]}
            columns={3}
          />
          {bills.filter((b) => b.pendingCents > 0).length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Open bills</p>
              <DataTable
                columns={[
                  {
                    key: "who",
                    header: "Attendee",
                    className: "w-full",
                    headClassName: "w-full",
                    render: (b) => (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{b.name}</p>
                        <p className="truncate font-mono text-[11px] text-text-tertiary">{b.uid}</p>
                      </div>
                    ),
                  },
                  {
                    key: "taps",
                    header: "Taps",
                    align: "right",
                    className: "whitespace-nowrap text-right tabular-nums",
                    headClassName: "whitespace-nowrap",
                    render: (b) => b.taps,
                  },
                  {
                    key: "pending",
                    header: "Owes",
                    align: "right",
                    className: "whitespace-nowrap text-right font-semibold tabular-nums text-amber-200",
                    headClassName: "whitespace-nowrap",
                    render: (b) => formatMoney(b.pendingCents, b.currency),
                  },
                ]}
                data={bills.filter((b) => b.pendingCents > 0)}
                getRowKey={(b) => b.key}
              />
            </div>
          ) : null}
          <Toolbar>
            <FilterDropdown
              value={tapStatus}
              onValueChange={setTapStatus}
              options={TAP_STATUS_FILTER_OPTIONS}
              height="h-9"
            />
            <SearchInput value={tapSearch} onChange={setTapSearch} placeholder="Search taps…" />
          </Toolbar>
          {filteredTaps.length ? (
            <DataTable columns={tapColumns} data={filteredTaps} getRowKey={(t) => t.id} />
          ) : (
            <EmptyState
              icon={Receipt}
              title={taps.length ? "No matches" : "No taps yet"}
              description={
                taps.length
                  ? "Try a different search or status filter."
                  : "Taps from the readers appear here with their charge and status."
              }
            />
          )}
        </div>
      </SectionCard>

      <PointFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        initial={editing}
        defaultCurrency={defaultCurrency}
        onSave={savePoint}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete entry point</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              Its reader key stops working immediately. Past taps and bills are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RfidNfcScreen() {
  return (
    <CheckinSettingsScreen
      title="RFID / NFC"
      description="Use RFID wristbands, cards, or NFC badges instead of QR codes for faster check-in and tracking."
      icon={Radio}
      feature="rfid"
      enableLabel="RFID / NFC"
      enableHint="Admit attendees by tapping a wristband, card, or NFC badge."
    >
      {({ slice, set, enabled }) =>
        !enabled ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-subtle px-6 py-12">
            <p className="text-center text-sm text-text-secondary">
              Turn on RFID / NFC to configure credential types and encoding data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <SectionCard title="Medium" description="What attendees carry, and how far away it reads.">
              <SettingsList>
                <SettingRow
                  title="Credential type"
                  control={
                    <RowSelect
                      value={slice.medium}
                      onChange={(v) => set({ medium: v })}
                      options={RFID_MEDIUM_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Read range"
                  description="Short-range is a deliberate tap; long-range reads from a distance at a gate."
                  control={
                    <RowSelect
                      value={slice.range}
                      onChange={(v) => set({ range: v })}
                      options={RFID_RANGE_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Checksum verification"
                  description="Validate the encoded file against a computed sum before the event."
                  checked={slice.checksum}
                  onCheckedChange={(v) => set({ checksum: v })}
                />
              </SettingsList>
            </SectionCard>
            {slice.medium === "badge" ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Phone-as-badge tap-in is Android only, via the mobile app (Host Card Emulation) — it
                  can&apos;t be sent as a downloadable file or email attachment, and isn&apos;t supported on iOS.
                  Keep a QR or physical fallback for iPhone attendees.
                </span>
              </div>
            ) : null}
            <SectionCard
              title="Paid entry defaults"
              description="Preselected when you create an entry point. Points snapshot their own price and currency, so changing this never rewrites history."
            >
              <SettingsList>
                <SettingRow
                  title="Default currency"
                  control={
                    <RowSelect
                      value={slice.billingCurrency || "usd"}
                      onChange={(v) => set({ billingCurrency: v })}
                      options={NFC_CURRENCY_OPTIONS}
                    />
                  }
                />
              </SettingsList>
            </SectionCard>
            <PaidEntryManager defaultCurrency={slice.billingCurrency || "usd"} />
            <RfidTools range={slice.range} />
          </div>
        )
      }
    </CheckinSettingsScreen>
  );
}

export default RfidNfcScreen;
