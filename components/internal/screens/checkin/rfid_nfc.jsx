"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Radio, Download, Upload, CheckCircle2 } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import { listRegistrations } from "@/lib/supabase/registrations";
import { downloadCsv } from "@/components/internal/screens/registrations/csv";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { RFID_MEDIUM_OPTIONS } from "./constants";

// Short, human-readable ticket code derived from the registration id.
const ticketCode = (id) => String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();

// Deterministic sum-check over a column of values (the "checksum" an organizer
// re-computes on the reading device to validate an uploaded encoding file).
function checksum(values) {
  let sum = 0;
  for (const v of values) {
    for (let i = 0; i < v.length; i++) sum = (sum + v.charCodeAt(i) * (i + 1)) % 0xffffffff;
  }
  return sum.toString(16).toUpperCase().padStart(6, "0").slice(-6);
}

// Global data operations: export the attendee→ID map and verify an uploaded
// encoding file's checksum. Fetches its own registrations.
function RfidDataSync() {
  const { projectId } = useProject();
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState(null);
  const fileRef = useRef(null);

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
      const rows = lines.slice(1); // drop header
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
      {({ slice, set, enabled }) => (
        <div className={enabled ? "space-y-6" : "hidden"}>
          <SectionCard title="Medium" description="What attendees carry.">
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
                title="Checksum verification"
                description="Validate the encoded file against a computed sum before the event."
                checked={slice.checksum}
                onCheckedChange={(v) => set({ checksum: v })}
              />
            </SettingsList>
          </SectionCard>
          <RfidDataSync />
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default RfidNfcScreen;
