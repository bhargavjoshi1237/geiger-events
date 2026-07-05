"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Send,
  Undo2,
  Users,
} from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AB_METRIC_OPTIONS,
  CAMPAIGN_STATUS_MAP,
  CHANNEL_MAP,
  TYPE_MAP,
  defaultAb,
  defaultContent,
  defaultMetrics,
  formatDateTime,
} from "./constants";

// Character budget hint for text channels.
const SMS_SEGMENT = 160;

export function CampaignEditor({
  campaign,
  segments,
  templates,
  estimateRecipients,
  onBack,
  onSave,
}) {
  const [name, setName] = useState(campaign.name);
  const [segmentId, setSegmentId] = useState(campaign.segmentId || "");
  const [content, setContent] = useState({
    ...defaultContent(campaign.channel),
    ...campaign.content,
  });
  const [ab, setAb] = useState({ ...defaultAb(), ...campaign.ab });
  const [scheduleMode, setScheduleMode] = useState(
    campaign.scheduledAt ? "scheduled" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(
    campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : "",
  );
  const [status, setStatus] = useState(campaign.status);
  const [saving, setSaving] = useState(false);

  const channel = campaign.channel;
  const channelMeta = CHANNEL_MAP[channel] || CHANNEL_MAP.email;
  const isEmail = channel === "email";
  const isText = channel === "sms" || channel === "whatsapp";
  const isPush = channel === "push";

  const recipients = useMemo(
    () => estimateRecipients(segmentId || null),
    [estimateRecipients, segmentId],
  );

  const setC = (patch) => setContent((c) => ({ ...c, ...patch }));
  const setVariantB = (patch) =>
    setAb((a) => ({ ...a, variantB: { ...a.variantB, ...patch } }));

  const buildPatch = (nextStatus) => {
    const patch = {
      name: name.trim() || "Untitled campaign",
      segmentId: segmentId || null,
      content,
      ab,
      scheduledAt: scheduleMode === "scheduled" ? scheduledAt || null : null,
    };
    if (nextStatus) patch.status = nextStatus;
    if (nextStatus === "sent") {
      patch.sentAt = new Date().toISOString();
      // Honest metrics: everyone we could reach is a recipient/delivered. We do
      // not fabricate opens/clicks.
      patch.metrics = { ...defaultMetrics(), ...campaign.metrics, recipients, delivered: recipients };
    }
    return patch;
  };

  const persist = async (nextStatus) => {
    if (nextStatus === "scheduled" && scheduleMode === "scheduled" && !scheduledAt) {
      toast.error("Pick a send date and time first.");
      return;
    }
    setSaving(true);
    const patch = buildPatch(nextStatus);
    await onSave(campaign.id, patch);
    if (nextStatus) setStatus(nextStatus);
    setSaving(false);
  };

  const primaryAction = () => {
    if (status === "draft") {
      return scheduleMode === "scheduled" ? (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => persist("scheduled")}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          Schedule send
        </Button>
      ) : (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => persist("sent")}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send now
        </Button>
      );
    }
    if (status === "scheduled") {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            disabled={saving}
            onClick={() => persist("draft")}
          >
            <Undo2 className="h-4 w-4" /> Unschedule
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => persist("sent")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Mark as sent
          </Button>
        </div>
      );
    }
    // sent | paused
    return (
      <Button
        variant="outline"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        disabled={saving}
        onClick={() => persist("draft")}
      >
        <Undo2 className="h-4 w-4" /> Back to draft
      </Button>
    );
  };

  const readOnly = status === "sent";
  const bodyLen = (content.body || "").length;
  const emailTemplates = templates.filter((t) => t.active);

  const applyTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const c = t.config || {};
    setC({
      templateId: id,
      subject: c.subject || content.subject,
      previewText: c.previewText || content.previewText,
      body: c.body || content.body,
    });
    toast.success(`Loaded “${t.name}”.`);
  };

  return (
    <SecondaryScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={name}
              size={Math.max(name.length, 6)}
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
              aria-label="Campaign name"
              className="min-w-0 max-w-full rounded-sm bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:text-3xl"
            />
            <StatusPill status={status} map={CAMPAIGN_STATUS_MAP} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={channelMeta.variant}>
              <channelMeta.icon className="h-3 w-3" /> {channelMeta.label}
            </Badge>
            <Badge variant={TYPE_MAP[campaign.type]?.variant || "neutral"}>
              {TYPE_MAP[campaign.type]?.label || campaign.type}
            </Badge>
            {status === "sent" && campaign.sentAt ? (
              <span className="text-xs text-text-tertiary">
                Sent {formatDateTime(campaign.sentAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{primaryAction()}</div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Audience */}
        <SectionCard
          title="Audience"
          description="Who this campaign goes to. Recipient count recomputes live from your contacts."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Segment" hint="Choose a saved segment or send to everyone.">
              <Select
                value={segmentId || "all"}
                onValueChange={(v) => setSegmentId(v === "all" ? "" : v)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contacts</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-2.5">
                <Users className="h-4 w-4 text-text-tertiary" />
                <div>
                  <p className="text-lg font-semibold text-foreground tabular-nums leading-none">
                    {recipients.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">estimated recipients</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Content */}
        <SectionCard
          title="Content"
          description="What your audience receives. Use merge tags like {{first_name}} to personalize."
          action={
            isEmail && emailTemplates.length ? (
              <Select value="" onValueChange={applyTemplate} disabled={readOnly}>
                <SelectTrigger className="h-9 w-44 bg-surface-card">
                  <SelectValue placeholder="Load template" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null
          }
        >
          <div className="space-y-4">
            {isEmail ? (
              <>
                <Field label="Subject">
                  <Input
                    value={content.subject || ""}
                    onChange={(e) => setC({ subject: e.target.value })}
                    placeholder="e.g. You're invited to {{event_name}}"
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Preview text" hint="The snippet shown after the subject in most inboxes.">
                  <Input
                    value={content.previewText || ""}
                    onChange={(e) => setC({ previewText: e.target.value })}
                    placeholder="Optional preheader"
                    disabled={readOnly}
                  />
                </Field>
              </>
            ) : null}

            {isPush ? (
              <Field label="Title">
                <Input
                  value={content.pushTitle || ""}
                  onChange={(e) => setC({ pushTitle: e.target.value })}
                  placeholder="e.g. Doors open in 30 minutes"
                  disabled={readOnly}
                />
              </Field>
            ) : null}

            <Field
              label={isEmail ? "Body" : isPush ? "Message" : "Message"}
              hint={
                isText
                  ? `${bodyLen} characters · ${Math.max(1, Math.ceil(bodyLen / SMS_SEGMENT))} segment${bodyLen > SMS_SEGMENT ? "s" : ""}`
                  : undefined
              }
            >
              <Textarea
                rows={isEmail ? 8 : 4}
                value={content.body || ""}
                onChange={(e) => setC({ body: e.target.value })}
                placeholder={
                  isEmail
                    ? "Write your email…"
                    : isPush
                      ? "Short push message…"
                      : "Your text message… keep it under 160 characters for a single segment."
                }
                disabled={readOnly}
              />
            </Field>
          </div>
        </SectionCard>

        {/* Schedule */}
        <SectionCard title="Schedule" description="Send immediately or queue it for later.">
          <Field label="Timing">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "now", label: "Send now" },
                { value: "scheduled", label: "Schedule for later" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setScheduleMode(opt.value)}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    scheduleMode === opt.value
                      ? "border-border-strong bg-surface-active text-foreground"
                      : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          {scheduleMode === "scheduled" ? (
            <div className="mt-4 max-w-xs">
              <Field label="Send at">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
            </div>
          ) : null}
        </SectionCard>

        {/* A/B testing — email & text channels only */}
        {isEmail || isText ? (
          <SectionCard
            title="A/B testing"
            description="Send two variants to a split of your audience and compare results."
          >
            <SettingsList>
              <SettingRow
                title="Run an A/B test"
                description="Variant B goes to part of your audience; the rest get variant A."
                checked={!!ab.enabled}
                onCheckedChange={(v) => !readOnly && setAb((a) => ({ ...a, enabled: v }))}
              />
            </SettingsList>
            {ab.enabled ? (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Variant A split" hint="Percent of recipients on variant A.">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={5}
                        max={95}
                        value={ab.split}
                        onChange={(e) =>
                          setAb((a) => ({ ...a, split: Number(e.target.value) || 50 }))
                        }
                        className="tabular-nums"
                        disabled={readOnly}
                      />
                      <span className="text-sm text-text-secondary">%</span>
                    </div>
                  </Field>
                  <Field label="Winning metric">
                    <Select
                      value={ab.metric}
                      onValueChange={(v) => setAb((a) => ({ ...a, metric: v }))}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AB_METRIC_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {isEmail ? (
                  <Field label="Variant B subject">
                    <Input
                      value={ab.variantB?.subject || ""}
                      onChange={(e) => setVariantB({ subject: e.target.value })}
                      placeholder="Alternate subject line"
                      disabled={readOnly}
                    />
                  </Field>
                ) : null}
                <Field label={isEmail ? "Variant B body" : "Variant B message"}>
                  <Textarea
                    rows={isEmail ? 5 : 3}
                    value={ab.variantB?.body || ""}
                    onChange={(e) => setVariantB({ body: e.target.value })}
                    placeholder="Alternate content for variant B"
                    disabled={readOnly}
                  />
                </Field>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {!readOnly ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={saving}
              onClick={() => persist(null)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
          </div>
        ) : null}
      </div>
    </SecondaryScreenWrapper>
  );
}

export default CampaignEditor;
