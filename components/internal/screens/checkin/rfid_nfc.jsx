"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Radio, Download, Upload, CheckCircle2, Smartphone, Info } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { useProject } from "@/context/project-context";
import { listRegistrations } from "@/lib/supabase/registrations";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { RFID_MEDIUM_OPTIONS, RFID_RANGE_OPTIONS, RFID_RANGE_SPECS } from "./constants";

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
          match, any manufacturer's stock will work with any compatible reader.
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
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!loading) setCount((c) => c || regs.length || 100);
  }, [loading, regs.length]);

  const idAt = (i) => `${prefix}${String(Number(start) + i).padStart(Number(padding) || 0, "0")}`;

  const downloadOrderSheet = () => {
    const n = Number(count) || 0;
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
    const n = Number(count) || 0;
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
          <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} min={0} />
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
        system takes (most accept a plain CSV or badge-ID lookup table; check your vendor's docs for
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
                  can't be sent as a downloadable file or email attachment, and isn't supported on iOS.
                  Keep a QR or physical fallback for iPhone attendees.
                </span>
              </div>
            ) : null}
            <RfidTools range={slice.range} />
          </div>
        )
      }
    </CheckinSettingsScreen>
  );
}

export default RfidNfcScreen;
