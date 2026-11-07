"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Loader2,
  Lock,
  LockOpen,
  Scale,
  Send,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { RfpBrief } from "@/components/rfp/rfp_brief";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LoadingArea } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useProject } from "@/context/project-context";
import { conferenceApi } from "@/lib/supabase/conference";
import { listVenues } from "@/lib/supabase/venues";
import {
  addRecipients,
  awardBid,
  getRfp,
  listBids,
  listProjectRecipients,
  listRecipients,
  removeRecipient,
  sendAwardNotices,
  sendRfpLinks,
  setBidStatus,
  softDeleteRfp,
  updateRecipient,
  updateRfp,
} from "@/lib/supabase/rfps";
import { formatDay, isEmail, validateRfpForSend } from "@/lib/sourcing/rfp_model";
import { buildCandidates, recipientHistory, venueDraftFromRecipient } from "@/lib/sourcing/suggest";

import { AwardDialog, AwardSection } from "./award_section";
import { BriefSection } from "./brief_section";
import { ComparisonSection } from "./comparison_section";
import { DeadlineChip } from "./deadline_chip";
import { LinksDialog } from "./links_dialog";
import { RecipientsSection } from "./recipients_section";
import { RequirementsSection } from "./requirements_section";
import { RFP_STATUS_MAP, isBriefLocked, isFinal, useNow } from "./constants";

const EDIT_KEYS = [
  "title", "eventId", "summary", "startDate", "endDate", "datesFlexible", "alternateDates", "attendees", "location",
  "roomRequirements", "sleepingRooms", "fnbRequirements", "fnbMinimum", "avNeeds", "budgetMin", "budgetMax",
  "currency", "shareBudget", "responseDeadline", "decisionDate", "contactName", "contactEmail", "notes", "scoringWeights",
];
const LOCKED_KEYS = ["responseDeadline", "decisionDate", "contactName", "contactEmail", "notes", "scoringWeights"];
const FINAL_KEYS = ["notes", "scoringWeights"];
const STATUS_KEYS = ["status", "sentAt", "awardedBidId", "awardedVenueId", "awardedAt", "updatedAt"];

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k]]));
const editableKeys = (rfp) => (isFinal(rfp) ? FINAL_KEYS : isBriefLocked(rfp) ? LOCKED_KEYS : EDIT_KEYS);

const NAV = [
  { key: "brief", label: "Brief", icon: FileText, desc: "Dates, size, budget and the deadline — what every venue prices against." },
  { key: "requirements", label: "Requirements", icon: ClipboardList, desc: "Meeting space, the sleeping-room block, F&B and AV." },
  { key: "recipients", label: "Recipients", icon: Users, desc: "Who's invited, who has opened it, and who has bid." },
  { key: "bids", label: "Bid comparison", icon: Scale, desc: "Every current bid side by side, scored on your weights." },
  { key: "award", label: "Award", icon: Trophy, desc: "Pick the winner, notify everyone and book the venue." },
];

export function RfpDetail({ rfp: initialRfp, events, presets, onBack, onChange, onDeleted, onDuplicate, onSavePreset }) {
  const { projectId } = useProject();
  const router = useRouter();
  const now = useNow();

  const [saved, setSaved] = useState(initialRfp);
  const [form, setForm] = useState(initialRfp);
  const [saving, setSaving] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState(null);
  const [busy, setBusy] = useState(false);
  const [linksResult, setLinksResult] = useState(null);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [issues, setIssues] = useState(null);
  const [awardTarget, setAwardTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [preview, setPreview] = useState(false);
  const [sendingNotices, setSendingNotices] = useState(false);

  const rfpId = initialRfp.id;

  useEffect(() => {
    let alive = true;
    Promise.all([listRecipients(rfpId), listBids(rfpId)]).then(([r, b]) => {
      if (!alive) return;
      setRecipients(r ?? []);
      setBids(b ?? []);
      setLoading(false);
    });
    Promise.all([
      listVenues(projectId),
      conferenceApi.list(projectId, "venue_lead"),
      conferenceApi.list(projectId, "housing"),
      listProjectRecipients(projectId),
    ]).then(([venues, venueLeads, stays, history]) => {
      if (!alive) return;
      setSources({ venues: venues ?? [], venueLeads: venueLeads ?? [], stays: stays ?? [], history: history ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [rfpId, projectId]);

  const keys = editableKeys(saved);
  const dirty = useMemo(() => JSON.stringify(pick(form, keys)) !== JSON.stringify(pick(saved, keys)), [form, saved, keys]);
  const locked = isBriefLocked(saved);
  const final = isFinal(saved);
  const event = events.find((e) => e.id === form.eventId) || null;

  const candidates = useMemo(() => (sources ? buildCandidates(sources) : null), [sources]);
  const history = useMemo(() => (sources ? recipientHistory(sources.history, rfpId) : null), [sources, rfpId]);
  const venuesById = useMemo(() => Object.fromEntries((sources?.venues || []).map((v) => [v.id, v])), [sources]);
  const currentBids = useMemo(
    () => Object.fromEntries(bids.filter((b) => b.isCurrent).map((b) => [b.recipientId, b])),
    [bids],
  );

  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const applyRow = (row, { keepEdits = true } = {}) => {
    if (!row) return;
    setSaved(row);
    setForm((f) => (keepEdits ? { ...f, ...pick(row, STATUS_KEYS) } : row));
    onChange?.(row);
  };

  const refresh = async () => {
    const [row, r, b] = await Promise.all([getRfp(rfpId), listRecipients(rfpId), listBids(rfpId)]);
    if (row) applyRow(row);
    if (r) setRecipients(r);
    if (b) setBids(b);
  };

  const save = async () => {
    if (!dirty) return saved;
    if (form.contactEmail && !isEmail(form.contactEmail)) {
      toast.error("Enter a valid contact email.");
      return null;
    }
    setSaving(true);
    const row = await updateRfp(rfpId, pick(form, keys));
    setSaving(false);
    if (!row) {
      toast.error("Couldn't save the RFP.");
      return null;
    }
    setSaved(row);
    setForm(row);
    onChange?.(row);
    return row;
  };

  const runSend = async ({ recipientIds, mode = "invite" }) => {
    if (dirty && !(await save())) return;
    setBusy(true);
    const res = await sendRfpLinks(rfpId, { recipientIds, mode });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Couldn't send.");
      if (res.issues?.length) setIssues(res.issues);
      return;
    }
    setLinksResult(res);
    await refresh();
  };

  const startSend = async () => {
    const problems = validateRfpForSend(form, Date.now());
    if (problems.length) {
      setIssues(problems);
      return;
    }
    const ready = recipients.filter((r) => !r.invitedAt && isEmail(r.email));
    if (!ready.length) {
      toast.error("Add at least one venue with an email address in Recipients.");
      return;
    }
    setSendConfirm(true);
  };

  const setStatus = async (status, message) => {
    if (dirty && !(await save())) return;
    const row = await updateRfp(rfpId, { status });
    if (!row) {
      toast.error("Couldn't update the RFP.");
      return;
    }
    applyRow(row);
    toast.success(message);
  };

  const onAdd = async (list) => {
    const rows = await addRecipients(rfpId, projectId, list, saved.createdBy);
    if (!rows) {
      toast.error("Couldn't add — that email may already be on this RFP.");
      return false;
    }
    setRecipients((prev) => [...prev, ...rows]);
    return true;
  };

  const onUpdateRecipient = async (r, p) => {
    const row = await updateRecipient(r.id, p);
    if (!row) {
      toast.error("Couldn't save — that email may already be on this RFP.");
      return false;
    }
    setRecipients((prev) => prev.map((x) => (x.id === row.id ? row : x)));
    return true;
  };

  const onRemove = async (r) => {
    const ok = await removeRecipient(r.id);
    if (!ok) {
      toast.error("Couldn't remove the venue.");
      return;
    }
    setRecipients((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(`Removed ${r.name}.`);
  };

  const onBidStatus = async (bid, status) => {
    const row = await setBidStatus(bid.id, status);
    if (!row) {
      toast.error("Couldn't update the bid.");
      return;
    }
    setBids((prev) => prev.map((b) => (b.id === row.id ? row : b)));
    const name = recipients.find((r) => r.id === bid.recipientId)?.name || "Bid";
    toast.success(status === "shortlisted" ? `${name} shortlisted.` : status === "rejected" ? `${name} rejected.` : `${name} restored.`);
  };

  const openAward = (bid) => {
    const recipient = recipients.find((r) => r.id === bid.recipientId);
    if (recipient) setAwardTarget({ bid, recipient });
  };

  const notify = async () => {
    setSendingNotices(true);
    const res = await sendAwardNotices(rfpId);
    setSendingNotices(false);
    if (!res.ok) {
      toast.error(res.error || "Couldn't send the notices.");
      return;
    }
    const total = res.results?.length || 0;
    const sent = (res.results || []).filter((r) => r.emailed).length;
    if (total && sent < total) toast.error(`${sent} of ${total} notices sent — check the Award section.`);
    else if (total) toast.success(`Award and regret notices sent to ${total} venue${total === 1 ? "" : "s"}.`);
    const r = await listRecipients(rfpId);
    if (r) setRecipients(r);
  };

  const confirmAward = async ({ bid, recipient, notify: shouldNotify, linkEvent }) => {
    if (dirty && !(await save())) return false;
    const res = await awardBid(bid.id, { venue: venueDraftFromRecipient(recipient, bid), linkEvent });
    if (!res.ok) {
      toast.error(res.error || "Couldn't award the bid.");
      return false;
    }
    toast.success(
      res.venueCreated ? `Awarded — ${res.venueName} added to your Venues book.` : `Awarded to ${res.venueName}.`,
    );
    if (res.eventLinked && event) toast.message(`${res.venueName} is now ${event.name}'s venue.`);
    await refresh();
    if (shouldNotify) await notify();
    return true;
  };

  const remove = async () => {
    const ok = await softDeleteRfp(rfpId);
    if (!ok) {
      toast.error("Couldn't delete the RFP.");
      return;
    }
    toast.success(`Deleted "${saved.title}".`);
    onDeleted?.(rfpId);
  };

  const invited = recipients.filter((r) => r.invitedAt).length;
  const responded = recipients.filter((r) => r.invitedAt && currentBids[r.id] && r.status !== "declined").length;
  const sendable = recipients.filter((r) => !r.invitedAt && isEmail(r.email));
  const losers = recipients.filter((r) => r.invitedAt && r.id !== awardTarget?.recipient?.id && ["invited", "viewed", "responded"].includes(r.status)).length;
  const canAward = ["sent", "closed"].includes(saved.status);

  const nav = NAV.map((item) =>
    item.key === "recipients" && recipients.length
      ? { ...item, label: `Recipients · ${recipients.length}` }
      : item.key === "bids" && Object.keys(currentBids).length
        ? { ...item, label: `Bid comparison · ${Object.keys(currentBids).length}` }
        : item,
  );

  const menu = [
    saved.status === "sent" && { icon: Lock, label: "Close bidding", onSelect: () => setStatus("closed", "Bidding closed — venues can no longer submit.") },
    saved.status === "closed" && { icon: LockOpen, label: "Reopen bidding", onSelect: () => setStatus("sent", "Bidding reopened.") },
    { icon: Copy, label: "Duplicate", onSelect: () => onDuplicate?.(form) },
    !final && { separator: true },
    !final && { icon: Ban, label: "Cancel RFP", destructive: true, onSelect: () => setConfirm("cancel") },
    { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setConfirm("delete") },
  ];

  const sectionBody = (key) => {
    if (key === "brief") return <BriefSection form={form} patch={patch} locked={locked} final={final} events={events} />;
    if (key === "requirements") {
      return <RequirementsSection form={form} patch={patch} locked={locked} presets={presets} onSavePreset={onSavePreset} />;
    }
    if (loading) return <LoadingArea size={48} panel label="Loading" />;
    if (key === "recipients") {
      return (
        <RecipientsSection
          rfp={form}
          recipients={recipients}
          currentBids={currentBids}
          candidates={candidates}
          history={history}
          suggestionsLoading={!sources}
          now={now}
          busy={busy}
          onAdd={onAdd}
          onUpdate={onUpdateRecipient}
          onRemove={onRemove}
          onSend={runSend}
        />
      );
    }
    if (key === "bids") {
      return (
        <ComparisonSection
          form={form}
          recipients={recipients}
          bids={bids}
          weightsLocked={false}
          canAct={!final}
          canAward={canAward}
          onWeights={(scoringWeights) => patch({ scoringWeights })}
          onBidStatus={onBidStatus}
          onAward={openAward}
        />
      );
    }
    return (
      <AwardSection
        form={saved}
        recipients={recipients}
        bids={bids}
        venuesById={venuesById}
        now={now}
        canAward={canAward}
        sendingNotices={sendingNotices}
        onAward={openAward}
        onResendNotices={notify}
        onOpenVenue={(id) => router.push(`/project/${projectId}/venues?venue=${id}`)}
      />
    );
  };

  return (
    <>
      <EditorShell
        back={{ label: "Smart Custom Proposals", onClick: onBack }}
        title={form.title || "Untitled RFP"}
        status={saved.status}
        statusMap={RFP_STATUS_MAP}
        badges={
          <>
            <DeadlineChip rfp={saved} now={now} />
            {event ? <Badge variant="neutral">{event.name}</Badge> : null}
            {invited ? (
              <Badge variant="neutral">
                {responded}/{invited} responded
              </Badge>
            ) : null}
          </>
        }
        meta={`${form.attendees ? `${form.attendees.toLocaleString("en-US")} attendees · ` : ""}${form.location ? `${form.location} · ` : ""}Created ${formatDay(saved.createdAt)}`}
        actions={
          <>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setPreview(true)}
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
            {dirty ? (
              <Button
                variant={saved.status === "draft" ? "outline" : "default"}
                className={saved.status === "draft" ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                disabled={saving}
                onClick={save}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            ) : null}
            {saved.status === "draft" ? (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy || saving} onClick={startSend}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send RFP
              </Button>
            ) : null}
            <ActionMenu label="More RFP actions" items={menu} />
          </>
        }
        nav={nav}
        defaultSection="brief"
      >
        {({ activeItem }) => sectionBody(activeItem.key)}
      </EditorShell>

      <LinksDialog result={linksResult} onOpenChange={(o) => !o && setLinksResult(null)} />

      <Dialog open={Boolean(issues)} onOpenChange={(o) => !o && setIssues(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Not ready to send
            </DialogTitle>
            <DialogDescription>Fix these so every venue gets a complete brief.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {(issues || []).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setIssues(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendConfirm} onOpenChange={(o) => !busy && setSendConfirm(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Send to {sendable.length} venue{sendable.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Each gets an email with a private link to the brief. The brief locks once it&apos;s out, so every bid prices
              the same thing.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-text-secondary">
            {sendable.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate text-foreground">{r.name}</span>
                <span className="truncate">{r.email}</span>
              </li>
            ))}
          </ul>
          {recipients.some((r) => !r.invitedAt && !isEmail(r.email)) ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">Venues without an email are skipped until you add one.</p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendConfirm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy}
              onClick={async () => {
                await runSend({ mode: "invite" });
                setSendConfirm(false);
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send RFP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "delete" ? "Delete this RFP?" : "Cancel this RFP?"}</DialogTitle>
            <DialogDescription>
              {confirm === "delete"
                ? "It disappears from your list and every venue link stops working. Bids already received go with it."
                : "Venues can no longer bid, and their links show the RFP as cancelled. Nothing is awarded."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                if (action === "delete") remove();
                else setStatus("cancelled", "RFP cancelled.");
              }}
            >
              {confirm === "delete" ? <Trash2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {confirm === "delete" ? "Delete" : "Cancel RFP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.title || "Untitled RFP"}</DialogTitle>
            <DialogDescription>
              What venues see on their response page{form.shareBudget ? "" : " (your budget stays hidden)"}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <RfpBrief rfp={form.shareBudget ? form : { ...form, budgetMin: null, budgetMax: null }} />
          </div>
        </DialogContent>
      </Dialog>

      {awardTarget ? (
        <AwardDialog
          key={awardTarget.bid.id}
          target={awardTarget}
          rfp={saved}
          eventName={event?.name}
          venueName={awardTarget.recipient.venueId ? venuesById[awardTarget.recipient.venueId]?.name : null}
          losers={losers}
          onOpenChange={(o) => !o && setAwardTarget(null)}
          onConfirm={confirmAward}
        />
      ) : null}
    </>
  );
}

export default RfpDetail;
