"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Keyboard, Loader2, SmartphoneNfc } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { READER_FORMATS, readerValueToUid, webNfcSerialToUid } from "@/lib/smart_badges/uid";

const noopSubscribe = () => () => {};
const useWebNfcSupport = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "NDEFReader" in window,
    () => false,
  );

// One box for every way a chip UID arrives: a USB keyboard-wedge reader (types the UID, then Enter),
// typing it by hand, or tapping the badge on an Android phone via Web NFC.
export function UidCapture({
  onCapture,
  disabled = false,
  busy = false,
  actionLabel = "Bind",
  placeholder = "Tap the badge on the reader, or type its UID",
  focusKey,
}) {
  const [value, setValue] = useState("");
  const [format, setFormat] = useState("hex");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const captureRef = useRef(onCapture);
  const nfcSupported = useWebNfcSupport();

  useEffect(() => {
    captureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (!disabled && !busy) inputRef.current?.focus();
  }, [focusKey, disabled, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = () => {
    const uid = readerValueToUid(value, format);
    if (!uid) {
      toast.error("Tap a badge or type its UID first.");
      return;
    }
    setValue("");
    captureRef.current?.(uid);
  };

  const toggleNfc = async () => {
    if (scanning) {
      abortRef.current?.abort();
      abortRef.current = null;
      setScanning(false);
      return;
    }
    try {
      const reader = new window.NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      reader.onreading = (event) => {
        const uid = webNfcSerialToUid(event.serialNumber);
        if (uid) captureRef.current?.(uid);
        else toast.error("That tag didn't report a UID.");
      };
      reader.onreadingerror = () => toast.error("Couldn't read that chip — hold it still and try again.");
      await reader.scan({ signal: ctrl.signal });
      setScanning(true);
    } catch (e) {
      abortRef.current = null;
      setScanning(false);
      toast.error(
        e?.name === "NotAllowedError"
          ? "NFC permission was denied for this site."
          : "Couldn't start NFC on this device — check NFC is switched on.",
      );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy) submit();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-surface-card font-mono uppercase tracking-wider"
        />
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={disabled || busy}
          onClick={submit}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {actionLabel}
        </Button>
        {nfcSupported ? (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={toggleNfc}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <SmartphoneNfc className="h-4 w-4" />
            {scanning ? "Stop NFC" : "Tap on phone"}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5" />
          {scanning
            ? "Listening — hold a badge to the back of this phone."
            : "USB readers type into this box and press Enter."}
        </span>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="h-7 w-auto gap-1 border-border bg-surface-card px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {READER_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default UidCapture;
