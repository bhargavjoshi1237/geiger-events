"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  Code,
  Share2,
  Languages,
  Video,
  Copy,
  Download,
  Plus,
  Check,
  Calendar,
  Apple,
  Mail,
  Twitter,
  Facebook,
  Linkedin,
  Link2,
  MapPin,
  Monitor,
} from "lucide-react";

import {
  DataTable,
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventSlug, formatDate } from "./sample_data";
import { useEventConfig } from "@/lib/events/use-event-config";

function CodeBlock({ code }) {
  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => toast.success("Copied to clipboard."),
        () => toast.error("Couldn't copy."),
      );
    }
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 pr-12 text-xs leading-relaxed text-muted-foreground">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        className="absolute right-2 top-2 text-text-secondary hover:bg-surface-active hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// --- Add to Calendar ---------------------------------------------------------

const CAL_PROVIDERS = [
  { key: "google", title: "Google Calendar", icon: Calendar },
  { key: "apple", title: "Apple Calendar", icon: Apple },
  { key: "outlook", title: "Outlook", icon: Mail },
  { key: "ics", title: "Download .ics file", icon: Download },
];

export function AddToCalendarSection({ event }) {
  const [enabled, , saveEnabled] = useEventConfig(event, "calendar", {
    google: true,
    apple: true,
    outlook: true,
    ics: true,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Providers">
          <SettingsList>
            {CAL_PROVIDERS.map((p) => (
              <SettingRow
                key={p.key}
                icon={p.icon}
                title={p.title}
                checked={enabled[p.key]}
                onCheckedChange={(v) => saveEnabled({ ...enabled, [p.key]: v })}
              />
            ))}
          </SettingsList>
        </SectionCard>

        <SectionCard title="Button preview">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-8">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <CalendarCheck className="h-4 w-4" /> Add to calendar
            </Button>
            <div className="flex flex-wrap justify-center gap-2">
              {CAL_PROVIDERS.filter((p) => enabled[p.key]).map((p) => (
                <Badge key={p.key} variant="neutral">
                  {p.title}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => toast.success("Downloading event.ics…")}
          >
            <Download className="h-4 w-4" /> Download .ics
          </Button>
        </SectionCard>
      </div>

      <SectionCard
        title="Subscribe link"
        description="Add an organizer-wide calendar feed so followers get every new event."
      >
        <CodeBlock code={`https://geiger.events/e/${event?.id || ""}.ics`} />
      </SectionCard>
    </div>
  );
}

// --- Embeddable Widget -------------------------------------------------------

export function EmbeddableWidgetSection({ event }) {
  const [cfg, , saveCfg] = useEventConfig(event, "embed", {
    type: "button",
    theme: "dark",
    width: "100%",
  });
  const type = cfg.type;
  const theme = cfg.theme;
  const setType = (v) => saveCfg({ ...cfg, type: v });
  const setTheme = (v) => saveCfg({ ...cfg, theme: v });
  const slug = eventSlug(event);

  const code = `<script src="https://geiger.events/embed.js"
  data-event="${slug}"
  data-type="${type}"
  data-theme="${theme}">
</script>`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Configure">
          <div className="grid gap-4">
            <Field label="Widget type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="button">Register button</SelectItem>
                  <SelectItem value="card">Event card</SelectItem>
                  <SelectItem value="inline">Inline checkout</SelectItem>
                  <SelectItem value="calendar">Calendar list</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Theme">
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="auto">Match site</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Width">
              <Input
                value={cfg.width || ""}
                onChange={(e) => saveCfg({ ...cfg, width: e.target.value })}
              />
            </Field>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Preview">
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-background p-10">
              {type === "button" ? (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Get tickets
                </Button>
              ) : (
                <div className="w-64 rounded-xl border border-border bg-surface-subtle p-4">
                  <div className="mb-3 aspect-video rounded-lg bg-surface-card" />
                  <p className="text-sm font-semibold text-foreground">
                    {event?.name || "Your event"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {event ? `${formatDate(event.date)} · ${event.city}` : ""}
                  </p>
                  <Button className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Register
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Embed code">
            <CodeBlock code={code} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// --- SEO & Sharing -----------------------------------------------------------

const SHARE_NETWORKS = [
  { key: "x", title: "X / Twitter", icon: Twitter },
  { key: "facebook", title: "Facebook", icon: Facebook },
  { key: "linkedin", title: "LinkedIn", icon: Linkedin },
  { key: "copy", title: "Copy link", icon: Link2 },
];

export function SeoSharingSection({ event }) {
  const slug = eventSlug(event);
  const [seo, setSeo, saveSeo, saving] = useEventConfig(event, "seo", {
    title: `${event?.name || "Event"} — Geiger Events`,
    description:
      event?.summary ||
      `Join us for ${event?.name || "this event"} at ${event?.venue || "the venue"}${
        event?.city && event.city !== "Remote" ? `, ${event.city}` : ""
      }.`,
  });
  const title = seo.title || "";
  const description = seo.description || "";
  const setTitle = (v) => setSeo({ ...seo, title: v });
  const setDescription = (v) => setSeo({ ...seo, description: v });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Search & social metadata">
          <div className="grid gap-4">
            <Field
              label="Meta title"
              hint={`${title.length}/60 characters`}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={70}
              />
            </Field>
            <Field
              label="Meta description"
              hint={`${description.length}/160 characters`}
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[200px]"
                maxLength={200}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => saveSeo(seo, { successMsg: "SEO settings saved." })}
              >
                Save
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Social preview">
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex aspect-[1.91/1] items-center justify-center bg-surface-card text-text-tertiary">
              <MapPin className="h-7 w-7" />
            </div>
            <div className="space-y-1 p-4">
              <p className="text-[11px] uppercase tracking-wide text-text-tertiary">
                geiger.events/{slug}
              </p>
              <p className="line-clamp-1 text-sm font-semibold text-foreground">
                {title}
              </p>
              <p className="line-clamp-2 text-xs text-text-secondary">
                {description}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Sharing</h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            Quick-share buttons shown on the event page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SHARE_NETWORKS.map((n) => {
            const Icon = n.icon;
            return (
              <Button
                key={n.key}
                variant="outline"
                size="sm"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => toast.success(`Shared via ${n.title}.`)}
              >
                <Icon className="h-4 w-4" /> {n.title}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Localization ------------------------------------------------------------

const LANGUAGES = [
  { id: "en", name: "English", locale: "en-GB", progress: 100, isDefault: true },
  { id: "fr", name: "French", locale: "fr-FR", progress: 86, isDefault: false },
  { id: "de", name: "German", locale: "de-DE", progress: 72, isDefault: false },
  { id: "es", name: "Spanish", locale: "es-ES", progress: 40, isDefault: false },
];

export function LocalizationSection({ event, headerItem }) {
  const [langs, , saveLangs] = useEventConfig(event, "languages", LANGUAGES);
  const [open, setOpen] = useState(false);

  const columns = [
    {
      key: "name",
      header: "Language",
      render: (l) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{l.name}</span>
          {l.isDefault ? <Badge variant="info">Default</Badge> : null}
        </div>
      ),
    },
    {
      key: "locale",
      header: "Locale",
      render: (l) => (
        <code className="rounded bg-surface-card px-1.5 py-0.5 text-xs text-muted-foreground">
          {l.locale}
        </code>
      ),
    },
    {
      key: "progress",
      header: "Translated",
      render: (l) => (
        <div className="w-[140px] space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-[#ededed]"
              style={{ width: `${l.progress}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary">{l.progress}%</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: () => (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Localization"}
        description={headerItem?.desc}
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add language
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={langs}
        getRowKey={(l) => l.id}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add language</DialogTitle>
            <DialogDescription>
              Create a new translation for this event.
            </DialogDescription>
          </DialogHeader>
          <Field label="Language">
            <Select defaultValue="it-IT">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it-IT">Italian (it-IT)</SelectItem>
                <SelectItem value="pt-BR">Portuguese (pt-BR)</SelectItem>
                <SelectItem value="nl-NL">Dutch (nl-NL)</SelectItem>
                <SelectItem value="ja-JP">Japanese (ja-JP)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                saveLangs(
                  [
                    ...langs,
                    {
                      id: `l${Date.now()}`,
                      name: "Italian",
                      locale: "it-IT",
                      progress: 0,
                      isDefault: false,
                    },
                  ],
                  { successMsg: "Language added." },
                );
                setOpen(false);
              }}
            >
              Add language
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Hybrid Mode -------------------------------------------------------------

const FORMATS = [
  { value: "in-person", label: "In-person", icon: MapPin, description: "A physical venue only." },
  { value: "online", label: "Online", icon: Monitor, description: "Stream only, no venue." },
  { value: "hybrid", label: "Hybrid", icon: Video, description: "Both a venue and a livestream." },
];

const TYPE_TO_FORMAT = {
  "In-person": "in-person",
  Online: "online",
  Hybrid: "hybrid",
};

export function HybridModeSection({ event, headerItem, onPatch, onCommit }) {
  const [format, setFormat] = useState(
    TYPE_TO_FORMAT[event?.type] || "hybrid",
  );
  const slug = eventSlug(event);
  const [hybrid, setHybrid, saveHybrid, saving] = useEventConfig(
    event,
    "hybrid",
    {
      provider: "geiger",
      joinLink: `https://geiger.events/live/${slug}`,
      inPerson: 400,
      online: 2000,
    },
  );
  const setHybridField = (key) => (value) => setHybrid({ ...hybrid, [key]: value });

  // Keep the event's headline format (a column) in sync with the choice here.
  const choose = (value) => {
    setFormat(value);
    const type = Object.keys(TYPE_TO_FORMAT).find(
      (k) => TYPE_TO_FORMAT[k] === value,
    );
    if (type) (onCommit || onPatch)?.({ type });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Hybrid Mode"}
        description={headerItem?.desc}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          const active = format === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => choose(f.value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-border-strong bg-surface-card"
                  : "border-border bg-transparent hover:bg-surface-card",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                {active ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white">
                    <Check className="h-3 w-3 text-[#161616]" />
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground">{f.label}</p>
              <p className="text-xs text-text-secondary">{f.description}</p>
            </button>
          );
        })}
      </div>

      {format !== "in-person" ? (
        <SectionCard title="Streaming">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stream provider">
              <Select
                value={hybrid.provider}
                onValueChange={setHybridField("provider")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geiger">Geiger Live</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="youtube">YouTube Live</SelectItem>
                  <SelectItem value="custom">Custom RTMP</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Join link" hint="Shared with online attendees only.">
              <Input
                value={hybrid.joinLink || ""}
                onChange={(e) => setHybridField("joinLink")(e.target.value)}
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}

      {format === "hybrid" ? (
        <SectionCard
          title="Capacity split"
          description="Cap each audience independently."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="In-person capacity">
              <Input
                type="number"
                value={hybrid.inPerson ?? 0}
                onChange={(e) =>
                  setHybridField("inPerson")(Number(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="Online capacity">
              <Input
                type="number"
                value={hybrid.online ?? 0}
                onChange={(e) =>
                  setHybridField("online")(Number(e.target.value) || 0)
                }
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => saveHybrid(hybrid, { successMsg: "Format settings saved." })}
        >
          Save settings
        </Button>
      </div>
    </div>
  );
}
