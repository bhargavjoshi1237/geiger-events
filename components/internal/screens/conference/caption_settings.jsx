"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Settings2,
  AudioLines,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Textarea,
  cn,
} from "@geiger/ui";
import { Field, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { getUser } from "@/lib/supabase/user";

// Whisper transcription settings — a project-level singleton (module
// "caption_settings", one record per project) that configures the ASR provider
// powering every caption job: the connection, the transcription defaults, and
// the automation behaviour. Persisted through the shared conferenceApi like the
// Mobile App singleton; opened from a gear button beside "Add caption job".

export const CAPTION_SETTINGS_MODULE = "caption_settings";
const MODULE = CAPTION_SETTINGS_MODULE;

export const DEFAULT_SETTINGS = {
  enabled: true,
  provider: "openai",
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  sourceLanguage: "auto",
  responseFormat: "verbose_json",
  timestampGranularity: "segment",
  temperature: 0,
  prompt: "",
  autoTranscribe: true,
  translateToEnglish: false,
  profanityFilter: false,
};

// Base URL + model presets per provider — switching provider seeds sensible
// defaults so the connection block is never left half-configured.
export const PROVIDERS = {
  openai: { label: "OpenAI Whisper", baseUrl: "https://api.openai.com/v1", models: ["whisper-1"] },
  azure: { label: "Azure OpenAI", baseUrl: "https://<resource>.openai.azure.com", models: ["whisper"] },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", models: ["whisper-large-v3", "whisper-large-v3-turbo"] },
  "self-hosted": {
    label: "Self-hosted (faster-whisper)",
    baseUrl: "http://localhost:9000/v1",
    models: ["large-v3", "large-v3-turbo", "medium", "small", "base"],
  },
};

export const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

const RESPONSE_FORMATS = [
  { value: "verbose_json", label: "Verbose JSON (timestamps)" },
  { value: "json", label: "JSON" },
  { value: "srt", label: "SubRip (.srt)" },
  { value: "vtt", label: "WebVTT (.vtt)" },
  { value: "text", label: "Plain text" },
];

const GRANULARITIES = [
  { value: "segment", label: "Segment" },
  { value: "word", label: "Word" },
];

export function normalize(config) {
  return { ...DEFAULT_SETTINGS, ...(config || {}) };
}

// Resolve the models a job can pick and the default language from the saved
// settings singleton (falls back to OpenAI defaults when unconfigured).
export function resolveJobOptions(settings) {
  const s = normalize(settings);
  const provider = PROVIDERS[s.provider] || PROVIDERS.openai;
  return {
    enabled: s.enabled,
    providerLabel: provider.label,
    models: provider.models,
    defaultModel: provider.models.includes(s.model) ? s.model : provider.models[0],
    defaultLanguage: s.sourceLanguage || "auto",
  };
}

// A titled block inside the dialog — a header over its controls.
function SettingsSection({ title, description, children }) {
  return (
    <section className="space-y-4 px-5 py-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function CaptionSettings({ api, projectId }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState(DEFAULT_SETTINGS);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [userId, setUserId] = useState(null);

  // Load the singleton once; a null list means the DB isn't configured — the
  // dialog still opens with defaults so the UI is always demoable.
  useEffect(() => {
    let alive = true;
    Promise.all([api.list(projectId, MODULE), getUser()]).then(([rows, user]) => {
      if (!alive) return;
      setUserId(user?.id || null);
      if (rows && rows.length) {
        setRecordId(rows[0].id);
        const cfg = normalize(rows[0].config);
        setSaved(cfg);
        setDraft(cfg);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [api, projectId]);

  const providerInfo = PROVIDERS[draft.provider] || PROVIDERS.openai;
  const modelOptions = providerInfo.models;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // Switching provider seeds its base URL + a valid default model.
  const setProvider = (provider) => {
    const info = PROVIDERS[provider] || PROVIDERS.openai;
    set({
      provider,
      apiBaseUrl: info.baseUrl,
      model: info.models.includes(draft.model) ? draft.model : info.models[0],
    });
  };

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  const configured = Boolean(saved.enabled && saved.apiKey);

  const onOpenChange = (o) => {
    if (o) setDraft(saved); // re-seed from the last saved state on open
    setOpen(o);
  };

  const handleSave = async () => {
    setSaving(true);
    let ok = false;
    if (recordId) {
      ok = Boolean(await api.update(recordId, { config: draft }));
    } else {
      const id = crypto.randomUUID();
      const created = await api.create({
        id,
        module: MODULE,
        name: "Transcription settings",
        status: draft.enabled ? "Active" : "Disabled",
        coverUrl: "",
        config: draft,
        createdBy: userId,
        projectId,
      });
      if (created) {
        ok = true;
        setRecordId(created.id);
      }
    }
    setSaving(false);
    if (ok) {
      setSaved(draft);
      setOpen(false);
      toast.success("Transcription settings saved.");
    } else {
      toast.error("Couldn't save transcription settings.");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="h-4 w-4" /> Settings
        {configured ? (
          <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden bg-background p-0">
          <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
              <AudioLines className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <DialogTitle className="text-base">Transcription settings</DialogTitle>
              <DialogDescription className="text-xs">
                Connect the Whisper speech-to-text provider that powers every caption job.
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 gap-1.5 border-border",
                configured
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-surface-subtle text-text-secondary",
              )}
            >
              {configured ? <CheckCircle2 className="h-3 w-3" /> : null}
              {configured ? "Connected" : "Not configured"}
            </Badge>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
            </div>
          ) : (
            <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {/* Master toggle */}
              <div className="flex items-center justify-between gap-4 bg-surface-subtle/40 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Enable transcription</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Turn Whisper captioning on for this workspace.
                  </p>
                </div>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => set({ enabled: v })}
                />
              </div>

              <div
                className={cn(
                  "transition-opacity",
                  draft.enabled ? "opacity-100" : "pointer-events-none opacity-50",
                )}
              >
                <div className="divide-y divide-border">
                  {/* Connection */}
                  <SettingsSection
                    title="Connection"
                    description="The provider, endpoint, and API key used to reach Whisper."
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Field label="Provider" className="min-w-0 flex-1">
                        <Select value={draft.provider} onValueChange={setProvider}>
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PROVIDERS).map(([value, info]) => (
                              <SelectItem key={value} value={value}>
                                {info.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Model" className="min-w-0 flex-1">
                        <Select value={draft.model} onValueChange={(v) => set({ model: v })}>
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {modelOptions.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="API base URL">
                      <Input
                        value={draft.apiBaseUrl}
                        onChange={(e) => set({ apiBaseUrl: e.target.value })}
                        placeholder="https://api.openai.com/v1"
                      />
                    </Field>
                    <Field label="API key" hint="Stored with your workspace settings.">
                      <div className="relative">
                        <Input
                          type={showKey ? "text" : "password"}
                          value={draft.apiKey}
                          onChange={(e) => set({ apiKey: e.target.value })}
                          placeholder="sk-…"
                          className="pr-10 font-mono"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((s) => !s)}
                          aria-label={showKey ? "Hide API key" : "Show API key"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-foreground"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </SettingsSection>

                  {/* Transcription defaults */}
                  <SettingsSection
                    title="Transcription defaults"
                    description="How audio is transcribed unless a job overrides it."
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Source language" className="min-w-0">
                        <Select
                          value={draft.sourceLanguage}
                          onValueChange={(v) => set({ sourceLanguage: v })}
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Output format" className="min-w-0">
                        <Select
                          value={draft.responseFormat}
                          onValueChange={(v) => set({ responseFormat: v })}
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESPONSE_FORMATS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Timestamps" className="min-w-0">
                        <Select
                          value={draft.timestampGranularity}
                          onValueChange={(v) => set({ timestampGranularity: v })}
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRANULARITIES.map((g) => (
                              <SelectItem key={g.value} value={g.value}>
                                {g.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field hint="Lower is more literal; higher is more creative.">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Temperature</span>
                        <span className="rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-text-secondary">
                          {Number(draft.temperature).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex h-9 items-center">
                        <Slider
                          value={[draft.temperature]}
                          onValueChange={([v]) => set({ temperature: v })}
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>
                    </Field>
                    <Field
                      label="Vocabulary hint"
                      hint="Names, acronyms, or product terms to spell correctly."
                    >
                      <Textarea
                        rows={2}
                        value={draft.prompt}
                        onChange={(e) => set({ prompt: e.target.value })}
                        placeholder="e.g. Geiger, DevCon, Kubernetes, Anaïs Dubois…"
                      />
                    </Field>
                  </SettingsSection>

                  {/* Automation */}
                  <SettingsSection
                    title="Automation"
                    description="What happens automatically for new caption jobs."
                  >
                    <SettingsList>
                      <SettingRow
                        title="Auto-transcribe new jobs"
                        description="Start transcription as soon as a caption job is added."
                        checked={draft.autoTranscribe}
                        onCheckedChange={(v) => set({ autoTranscribe: v })}
                      />
                      <SettingRow
                        title="Translate to English"
                        description="Also produce an English transcript for non-English audio."
                        checked={draft.translateToEnglish}
                        onCheckedChange={(v) => set({ translateToEnglish: v })}
                      />
                      <SettingRow
                        title="Profanity filter"
                        description="Mask strong language in the generated captions."
                        checked={draft.profanityFilter}
                        onCheckedChange={(v) => set({ profanityFilter: v })}
                      />
                    </SettingsList>
                  </SettingsSection>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSave}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CaptionSettings;
