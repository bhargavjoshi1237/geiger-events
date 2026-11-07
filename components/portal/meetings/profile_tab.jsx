"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { allSlots } from "@/lib/meetings/slots";
import { tzAbbrev } from "@/lib/meetings/time";
import { Card, SectionTitle } from "../portal_kit";
import { SlotChips, TagInput, postJson } from "./meetings_kit";

const draftFrom = (profile, member) => ({
  optedIn: profile.hasProfile ? profile.optedIn : true,
  name: profile.name || member?.name || "",
  title: profile.title || "",
  company: profile.company || "",
  bio: profile.bio || "",
  avatarUrl: profile.avatarUrl || "",
  interests: profile.interests || [],
  lookingFor: profile.lookingFor || [],
  blocked: (profile.blockedSlots || []).map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() })),
});

export function ProfileTab({ eventId, state, member, tz, onSaved }) {
  const { profile, settings } = state;
  const [draft, setDraft] = useState(() => draftFrom(profile, member));
  const [prev, setPrev] = useState(profile);
  const [saving, setSaving] = useState(false);
  if (profile !== prev) {
    setPrev(profile);
    setDraft(draftFrom(profile, member));
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const slots = useMemo(() => allSlots(settings, tz), [settings, tz]);
  const blockedSet = useMemo(() => new Set(draft.blocked.map((s) => s.start)), [draft.blocked]);
  const scopeAll = settings.requestScope === "all";

  const toggleBlocked = (slot) =>
    set({
      blocked: blockedSet.has(slot.start)
        ? draft.blocked.filter((s) => s.start !== slot.start)
        : [...draft.blocked, { start: slot.start, end: slot.end }],
    });

  const save = async (next = draft) => {
    setSaving(true);
    const { ok, data } = await postJson(`/api/portal/meetings/${eventId}/profile`, {
      optedIn: next.optedIn,
      name: next.name,
      title: next.title,
      company: next.company,
      bio: next.bio,
      avatarUrl: next.avatarUrl.trim(),
      interests: next.interests,
      lookingFor: next.lookingFor,
      blockedSlots: next.blocked,
    });
    setSaving(false);
    if (!ok) {
      toast.error(data.error || "Couldn't save your profile.");
      return;
    }
    toast.success(next.optedIn ? "Profile saved — you're open to meetings." : "Profile saved.");
    onSaved();
  };

  return (
    <div className="space-y-6">
      {profile.hidden ? (
        <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-muted-foreground">
            The organiser has paused your networking profile, so you&apos;re hidden from the directory and can&apos;t
            send requests. Meetings already booked stay booked.
          </p>
        </Card>
      ) : null}

      <Card>
        <SettingsList>
          <SettingRow
            title="Open to meetings"
            description={
              scopeAll
                ? "Every attendee is listed by default. Turn this off to hide from the directory."
                : "Show your profile to other attendees so they can request a meeting with you."
            }
            checked={draft.optedIn}
            onCheckedChange={(v) => set({ optedIn: v })}
          />
        </SettingsList>
      </Card>

      <section>
        <SectionTitle>About you</SectionTitle>
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Photo link" hint="An https:// image URL (optional).">
              <Input value={draft.avatarUrl} onChange={(e) => set({ avatarUrl: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Job title">
              <Input value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Head of Partnerships" />
            </Field>
            <Field label="Company">
              <Input value={draft.company} maxLength={120} onChange={(e) => set({ company: e.target.value })} placeholder="e.g. Acme" />
            </Field>
          </div>
          <Field label="Bio" hint={`${draft.bio.length}/1000`}>
            <Textarea rows={3} value={draft.bio} maxLength={1000} onChange={(e) => set({ bio: e.target.value })} placeholder="What you do and why people should meet you…" />
          </Field>
          <Field label="Interests" hint="Press Enter after each one.">
            <TagInput value={draft.interests} onChange={(v) => set({ interests: v })} placeholder="e.g. Fintech, AI, Hiring" />
          </Field>
          <Field label="Looking for">
            <TagInput value={draft.lookingFor} onChange={(v) => set({ lookingFor: v })} placeholder="e.g. Investors, Partners" />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Times you can&apos;t meet</SectionTitle>
        <Card className="space-y-3">
          <p className="text-xs text-text-secondary">
            Tap any time you&apos;re busy — nobody can book you then. Times in {tzAbbrev(tz)}.
            {settings.days.length ? "" : " The organiser hasn't set meeting days yet."}
          </p>
          <div className="max-h-[40vh] overflow-y-auto pr-1">
            <SlotChips
              slots={slots}
              tz={tz}
              selected={blockedSet}
              onToggle={toggleBlocked}
              tone="danger"
              emptyText="No meeting times are set for this event yet."
            />
          </div>
        </Card>
      </section>

      <div className="flex justify-end">
        <Button
          disabled={saving}
          onClick={() => save()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : profile.hasProfile ? "Save profile" : "Join networking"}
        </Button>
      </div>
    </div>
  );
}

export default ProfileTab;
