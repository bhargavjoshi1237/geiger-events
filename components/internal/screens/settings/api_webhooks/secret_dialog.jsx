"use client";

import { useState } from "react";
import { Eye, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { CopyField } from "./code_block";
import { formatDate } from "./constants";

// Reveal or rotate an endpoint's signing secret. The secret is fetched on demand and kept only while open.
export default function SecretDialog({ endpoint, canManage, onOpenChange, onReveal, onRotate }) {
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  async function reveal() {
    setBusy("reveal");
    const value = await onReveal(endpoint);
    setBusy(null);
    if (value) setSecret(value);
  }

  async function rotate() {
    setBusy("rotate");
    const value = await onRotate(endpoint);
    setBusy(null);
    if (value) {
      setSecret(value);
      setConfirmRotate(false);
    }
  }

  return (
    <Dialog open={!!endpoint} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>
            Use this secret to check the Geiger-Signature header on every request, so your server only trusts
            webhooks that really came from Geiger.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {secret ? (
            <CopyField value={secret} copyMessage="Signing secret copied" />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 basis-64 rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-sm text-text-tertiary">
                whsec_••••••••••••••••••••••••
              </code>
              <Button variant="outline" size="sm" onClick={reveal} disabled={!canManage || !!busy}>
                {busy === "reveal" ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                Reveal
              </Button>
            </div>
          )}
          <p className="text-xs text-text-secondary">
            {endpoint?.secretRotatedAt
              ? `Last rotated ${formatDate(endpoint.secretRotatedAt)}.`
              : `In use since ${formatDate(endpoint?.createdAt)}.`}
            {canManage ? "" : " Only people who can manage settings can see it."}
          </p>

          {confirmRotate ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-text-secondary">
              <p className="text-sm font-medium text-foreground">Rotate the secret?</p>
              <p className="mt-0.5">
                The old secret stops working immediately: the next delivery is signed with the new one. Update your
                server first, or expect failed deliveries until you do (they&apos;ll be retried).
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmRotate(false)} disabled={!!busy}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground" onClick={rotate} disabled={!!busy}>
                  {busy === "rotate" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Rotate secret
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {canManage && !confirmRotate ? (
            <Button variant="outline" onClick={() => setConfirmRotate(true)} disabled={!!busy} className="sm:mr-auto">
              <RefreshCw className="size-3.5" />
              Rotate
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
