"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Mail, RotateCcw, Send, X } from "lucide-react";
import {
  Badge, Button, Checkbox, Input, Label, LogoLoading, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { SearchInput, SectionCard, Toolbar } from "@/components/internal/shared/screen_kit";
import { BUILTIN_ROLES } from "@/lib/workspace/portal/contracts.js";
import { timeAgo } from "../state/format";
import { liveFieldsOf } from "../state/use_workspace";

const NONE = "__none__";
const INVITE_STATE = {
  sent: { label: "Invited", variant: "neutral" }, accepted: { label: "Joined", variant: "success" },
  expired: { label: "Invite expired", variant: "warning" }, revoked: { label: "Invite revoked", variant: "neutral" },
};

export const portalUrl = (eventId) => {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/e/${eventId}/workspace`;
};

export function CopyLink({ eventId }) {
  const [copied, setCopied] = useState(false);
  const url = portalUrl(eventId);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input readOnly value={url} className="min-w-0 font-mono text-xs" onFocus={(event) => event.target.select()} />
      <Button variant="outline" size="icon" className="shrink-0" aria-label="Copy portal link"
        onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Which list holds the people, how they sign in, and whether the portal is open.
function Settings({ eventId, ws, portal }) {
  const settings = portal.portal ?? {};
  const peopleId = settings.peopleObjectId ?? null;
  const fields = peopleId ? liveFieldsOf(ws.data, peopleId) : [];
  const emailFields = fields.filter((field) => ["email", "short_text"].includes(field.type));
  const emailField = fields.find((field) => field.id === settings.emailFieldId);
  const [welcome, setWelcome] = useState(settings.settings?.welcome ?? "");
  const [contact, setContact] = useState(settings.settings?.contact ?? "");
  const update = (patch, success) => portal.run("portal.update", { patch }, { success });
  const dirtyText = welcome !== (settings.settings?.welcome ?? "") || contact !== (settings.settings?.contact ?? "");

  return (
    <SectionCard title="Sign-in" description="People sign in with a code sent to the email on their record in the people list.">
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>People list</Label>
            <Select value={peopleId ?? NONE} onValueChange={(next) => update({ peopleObjectId: next === NONE ? null : next }, "People list saved")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a list" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {ws.objects.map((object) => <SelectItem key={object.id} value={object.id}>{object.plural}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-tertiary">Reviewers, authors, volunteers — whoever signs in.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Email field</Label>
            <Select value={settings.emailFieldId ?? NONE} disabled={!peopleId} onValueChange={(next) => update({ emailFieldId: next === NONE ? null : next }, "Email field saved")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a field" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {emailFields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {emailField && !emailField.isUnique ? <p className="text-xs text-amber-700 dark:text-amber-400">Make this field unique (in the list&apos;s field settings) before turning the portal on.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Name field</Label>
            <Select value={settings.nameFieldId ?? NONE} disabled={!peopleId} onValueChange={(next) => update({ nameFieldId: next === NONE ? null : next }, "Name field saved")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="The record's title" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>The record&apos;s title</SelectItem>
                {fields.filter((field) => field.type === "short_text").map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 border-t border-border pt-4">
          <label className="flex items-center justify-between gap-3">
            <span className="grid gap-0.5"><span className="text-sm font-medium text-foreground">Portal is on</span>
              <span className="text-xs text-text-secondary">People can open the published version and sign in.</span></span>
            <Switch checked={Boolean(settings.enabled)} onCheckedChange={(enabled) => update({ enabled }, enabled ? "Portal turned on" : "Portal turned off")} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="grid gap-0.5"><span className="text-sm font-medium text-foreground">Self sign-up</span>
              <span className="text-xs text-text-secondary">Public forms with sign-up can add new people to the people list.</span></span>
            <Switch checked={Boolean(settings.signupEnabled)} onCheckedChange={(signupEnabled) => update({ signupEnabled }, "Sign-up saved")} />
          </label>
        </div>
        <div className="grid gap-4 border-t border-border pt-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wp-welcome">Welcome text</Label>
            <Textarea id="wp-welcome" rows={3} maxLength={2000} value={welcome} onChange={(e) => setWelcome(e.target.value)}
              placeholder="Shown on the sign-in screen and in invite emails." />
          </div>
          <div className="grid gap-1.5 sm:max-w-sm">
            <Label htmlFor="wp-contact">Contact email</Label>
            <Input id="wp-contact" type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="programme@example.org" />
          </div>
          {dirtyText ? (
            <Button className="justify-self-start" onClick={() => update({ settings: { welcome, contact } }, "Saved")}>Save text</Button>
          ) : null}
        </div>
        <div className="grid gap-1.5 border-t border-border pt-4">
          <Label>Portal link</Label>
          <CopyLink eventId={eventId} />
        </div>
      </div>
    </SectionCard>
  );
}

function People({ portal }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [roleId, setRoleId] = useState(NONE);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await portal.api.people();
    if (error) toast.error(error.message);
    setRows(data?.people ?? []);
  }, [portal.api]);

  useEffect(() => {
    let alive = true;
    portal.api.people().then(({ data }) => { if (alive) setRows(data?.people ?? []); });
    return () => { alive = false; };
  }, [portal.api, portal.portal?.peopleObjectId]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((row) => !term || `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(term));
  }, [rows, q]);

  const invite = async (body, label) => {
    setBusy(label);
    const { data, error } = await portal.api.invite(body);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const failed = Array.isArray(data?.failed) ? data.failed.length : Number(data?.failed ?? 0);
    const sent = Array.isArray(data?.sent) ? data.sent.length : Number(data?.sent ?? 0);
    toast.success(`${sent.toLocaleString()} invite${sent === 1 ? "" : "s"} sent${failed ? ` · ${failed} couldn't be sent` : ""}`);
    setSelected(new Set());
    load();
  };

  const revoke = async (inviteId) => {
    const { error } = await portal.api.revokeInvite(inviteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite revoked");
    load();
  };

  const roles = portal.roles.filter((role) => role.key !== BUILTIN_ROLES.public);
  const withEmail = shown.filter((row) => row.email);

  return (
    <SectionCard title="People" description="Invite links are personal, work once and last 7 days. People can always sign in with a code instead.">
      {!portal.portal?.peopleObjectId ? <p className="text-sm text-text-secondary">Choose the people list above first.</p> : rows === null ? (
        <div className="flex justify-center py-8"><LogoLoading size={36} aria-label="Loading people" /></div>
      ) : (
        <div className="grid gap-3">
          <Toolbar>
            <div className="flex items-center gap-2">
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Invite everyone with a role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Invite everyone with a role…</SelectItem>
                  {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={roleId === NONE || Boolean(busy)} onClick={() => invite({ roleId }, "role")}>
                {busy === "role" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send
              </Button>
              {selected.size ? (
                <Button disabled={Boolean(busy)} onClick={() => invite({ recordIds: [...selected] }, "selected")}>
                  {busy === "selected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Invite {selected.size}
                </Button>
              ) : null}
            </div>
            <SearchInput value={q} onChange={setQ} placeholder="Search people…" />
          </Toolbar>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-secondary">
                  <th className="w-10 px-3 py-2">
                    <Checkbox aria-label="Select everyone shown" checked={withEmail.length > 0 && withEmail.every((row) => selected.has(row.id))}
                      onCheckedChange={(checked) => setSelected(checked ? new Set(withEmail.map((row) => row.id)) : new Set())} />
                  </th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Invite</th>
                  <th className="px-3 py-2 font-medium">Last signed in</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const state = row.invite ? INVITE_STATE[row.invite.state] : null;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Checkbox aria-label={`Select ${row.name}`} disabled={!row.email} checked={selected.has(row.id)}
                          onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(row.id); else next.delete(row.id); return next; })} />
                      </td>
                      <td className="max-w-64 truncate px-3 py-2 font-medium text-foreground">{row.name || "Unnamed"}</td>
                      <td className="max-w-72 truncate px-3 py-2 text-text-secondary">{row.email || <span className="text-text-tertiary">No email</span>}</td>
                      <td className="px-3 py-2">
                        {state ? <span className="inline-flex items-center gap-2"><Badge variant={state.variant}>{state.label}</Badge>
                          <span className="text-xs text-text-tertiary">{timeAgo(row.invite.sentAt)}</span></span> : <span className="text-xs text-text-tertiary">Not invited</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{row.lastSignIn ? timeAgo(row.lastSignIn) : "Never"}</td>
                      <td className="px-3 py-2 text-right">
                        {row.invite?.state === "sent" ? (
                          <Button size="sm" variant="ghost" onClick={() => revoke(row.invite.id)}><X className="h-4 w-4" />Revoke</Button>
                        ) : row.email ? (
                          <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => invite({ recordIds: [row.id] }, row.id)}>
                            {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : row.invite ? <RotateCcw className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                            {row.invite ? "Resend" : "Invite"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!shown.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-text-secondary">{q ? "Nobody matches." : "Nobody in the people list yet."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function PeopleTab({ eventId, ws, portal }) {
  return (
    <div className="space-y-5">
      <Settings key={portal.portal?.revision ?? 0} eventId={eventId} ws={ws} portal={portal} />
      <People portal={portal} />
    </div>
  );
}
