"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Linkedin,
  Link2,
  Loader2,
  Mail,
  Mic,
  Phone,
  PlayCircle,
  Search,
  Star,
  Twitter,
  Contact,
  FileText,
  Image as ImageIcon,
  Presentation,
  ClipboardCheck,
  CalendarCheck,
  Users,
  Clock,
  ListChecks,
  Target,
} from "lucide-react";

import {
  Button,
  Input,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@geiger/ui";
import { SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { listEvents } from "@/lib/supabase/events";
import { conferenceApi } from "@/lib/supabase/conference";
import { describeSpec, resolveAudienceEmails } from "@/lib/audience/resolve";
import { formatDate, initials } from "@/components/internal/screens/events/sample_data";
import { toEmbed } from "@/lib/video-embed";
import { SPEAKER_STATUS_MAP, PORTAL_STATUS_MAP, AGENDA_ASSIGN_STATUS_MAP } from "./constants";

// Custom detail-editor sections shared by the Conference modules that outgrow the
// declarative field kit — attaching a record to real events, previewing an
// external video link, and publishing a shareable public page. Each is a small
// component that reads a record's config and persists through `commit` (patch +
// immediate save), matching how CoverImageCard commits media.

// --- Event fetch hook --------------------------------------------------------

function useProjectEvents() {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    listEvents(projectId).then((rows) => {
      if (!alive) return;
      setEvents(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);
  return { events, loading };
}

function EventMeta({ event }) {
  return (
    <span className="truncate text-xs text-text-secondary">
      {[event.date ? formatDate(event.date) : null, event.venue, event.city]
        .filter(Boolean)
        .join(" · ") || "No date set"}
    </span>
  );
}

function NoEvents() {
  const { setTab } = useWorkspaceUrl();
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface-card px-5 py-8">
      <p className="text-sm text-text-secondary">No events in this project yet.</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setTab("All Events")}
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
      >
        <CalendarDays className="h-4 w-4" /> Go to Events
      </Button>
    </div>
  );
}

// --- Single-event link (backstage / room) ------------------------------------

// EventLinkField — attach a record to ONE event (stored at config[configKey]).
export function EventLinkField({ record, commit, configKey = "eventId", title = "Linked event", description }) {
  const { events, loading } = useProjectEvents();
  const current = record.config?.[configKey] || "";

  const set = (id) =>
    commit({ config: { ...(record.config || {}), [configKey]: id === "__none" ? "" : id } });

  return (
    <SectionCard title={title} description={description}>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      ) : events.length === 0 ? (
        <NoEvents />
      ) : (
        <Select value={current || "__none"} onValueChange={set}>
          <SelectTrigger>
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Not linked to an event</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
                {e.date ? ` · ${formatDate(e.date)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </SectionCard>
  );
}

// --- Multi-event link (recordings) -------------------------------------------

// EventMultiField — attach a record to MANY events (stored at config[configKey]
// as an array of event ids). Searchable checkbox list.
export function EventMultiField({ record, commit, configKey = "eventIds", title = "Attached events", description }) {
  const { events, loading } = useProjectEvents();
  const [q, setQ] = useState("");
  const selected = Array.isArray(record.config?.[configKey])
    ? record.config[configKey]
    : [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) =>
      `${e.name} ${e.venue} ${e.city}`.toLowerCase().includes(term),
    );
  }, [events, q]);

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    commit({ config: { ...(record.config || {}), [configKey]: next } });
  };

  return (
    <SectionCard title={title} description={description}>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
        </div>
      ) : events.length === 0 ? (
        <NoEvents />
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events…"
              className="pl-8"
            />
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {filtered.map((e) => {
              const on = selected.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    on
                      ? "border-border-strong bg-surface-hover"
                      : "border-border bg-surface-card hover:bg-surface-hover",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong bg-transparent",
                    )}
                  >
                    {on ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {e.name}
                    </span>
                    <EventMeta event={e} />
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-1 py-3 text-sm text-text-tertiary">
                No events match “{q}”.
              </p>
            ) : null}
          </div>
          {selected.length ? (
            <p className="text-xs text-text-secondary">
              Attached to {selected.length} event{selected.length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

// --- Video preview -----------------------------------------------------------

export function VideoPreview({ url, className }) {
  const embed = toEmbed(url);
  if (embed.type === "none") {
    return (
      <div
        className={cn(
          "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary",
          className,
        )}
      >
        <PlayCircle className="h-6 w-6" />
        <p className="text-sm">Paste a video link to preview it here.</p>
      </div>
    );
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-black", className)}>
      {embed.type === "iframe" ? (
        <iframe
          src={embed.src}
          title="Recording preview"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={embed.src} controls className="aspect-video w-full bg-black" />
      )}
    </div>
  );
}

// RecordingVideoField — the external video URL + a live preview. The link is
// stored at config.videoUrl; Geiger never hosts the media (see lib/video-embed).
export function RecordingVideoField({ record, commit }) {
  const [url, setUrl] = useState(record.config?.videoUrl || "");
  // Reseed the input when switching to a different record (render-phase, not an
  // effect — mirrors RecordDetail's seedId pattern).
  const [seedId, setSeedId] = useState(record.id);
  if (record.id !== seedId) {
    setSeedId(record.id);
    setUrl(record.config?.videoUrl || "");
  }

  const persist = () => {
    const clean = url.trim();
    if (clean === (record.config?.videoUrl || "")) return;
    commit({ config: { ...(record.config || {}), videoUrl: clean } });
  };

  return (
    <SectionCard
      title="Video link"
      description="An external URL (YouTube, Vimeo, or a direct file). Geiger fetches and plays it client-side — it never hosts the video."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-text-secondary" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={persist}
            onKeyDown={(e) => e.key === "Enter" && persist()}
            placeholder="https://youtube.com/watch?v=…"
          />
        </div>
        <VideoPreview url={record.config?.videoUrl} />
      </div>
    </SectionCard>
  );
}

// --- Public sharing ----------------------------------------------------------

function publicUrl(path) {
  const base =
    (typeof window !== "undefined" ? window.location.origin : "") +
    (process.env.NEXT_PUBLIC_BASE_PATH || "");
  return `${base}${path}`;
}

// RecordingShareField — publish a read-only public page for the recording. When
// config.public is on, /r/<id> renders the external video to anyone with the link
// (a scoped anon RLS read backs it, see zzz_conference_recordings_public.sql).
export function RecordingShareField({ record, commit }) {
  const [copied, setCopied] = useState(false);
  const isPublic = Boolean(record.config?.public);
  const link = publicUrl(`/r/${record.id}`);

  const setPublic = (on) =>
    commit({ config: { ...(record.config || {}), public: on } });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <SectionCard
      title="Shareable link"
      description="Turn on a public replay page anyone can open — no account needed. Turn it off to revoke access instantly."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Public replay page</p>
            <p className="text-xs text-text-secondary">
              {isPublic ? "Live — anyone with the link can watch." : "Private — only your team can see this recording."}
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setPublic} aria-label="Public replay page" />
        </div>

        {isPublic ? (
          <div className="flex items-center gap-2">
            <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border bg-surface-subtle px-3">
              <span className="truncate text-sm text-muted-foreground">{link}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copy}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

// --- Speaker hero ------------------------------------------------------------

function normalizeHref(kind, value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (kind === "email") return `mailto:${v}`;
  if (kind === "phone") return `tel:${v.replace(/[^\d+]/g, "")}`;
  if (kind === "twitter") {
    const handle = v.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "");
    return `https://x.com/${handle}`;
  }
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function SocialLink({ href, icon: Icon, label }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

// A rich profile header for the Speaker editor — headshot, name, role, status,
// topics, and quick contact/social links — so the detail reads like a real
// speaker card instead of a bare form. Display-only; edits happen in the
// sections below (it reflects the live form via `record`).
export function SpeakerHero({ record }) {
  const cfg = record.config || {};
  const roleLine = [cfg.title, cfg.company].filter(Boolean).join(" · ");
  const topics = Array.isArray(cfg.topics) ? cfg.topics.filter(Boolean) : [];
  const sessionCount = Array.isArray(cfg.sessions) ? cfg.sessions.filter(Boolean).length : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      {/* Ambient brand wash so the card lifts off the canvas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl"
      />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6">
        {/* Headshot */}
        {record.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={record.coverUrl}
            alt={record.name}
            className="h-24 w-24 shrink-0 rounded-2xl border border-border object-cover shadow-lg ring-1 ring-white/5 sm:h-28 sm:w-28"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-card text-2xl font-semibold text-muted-foreground shadow-lg ring-1 ring-white/5 sm:h-28 sm:w-28">
            {record.name ? initials(record.name) : <Mic className="h-8 w-8" />}
          </div>
        )}

        {/* Identity */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {record.name || "Untitled speaker"}
            </h2>
            <StatusPill status={record.status} map={SPEAKER_STATUS_MAP} />
            {cfg.featured ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                <Star className="h-3 w-3 fill-amber-300" /> Featured
              </span>
            ) : null}
          </div>

          {roleLine ? (
            <p className="text-sm font-medium text-text-secondary">{roleLine}</p>
          ) : (
            <p className="text-sm text-text-tertiary">Add a title and company below.</p>
          )}

          {topics.length ? (
            <div className="flex flex-wrap gap-1.5">
              {topics.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-secondary"
                >
                  {t}
                </span>
              ))}
              {topics.length > 6 ? (
                <span className="rounded-md px-2 py-1 text-xs text-text-tertiary">
                  +{topics.length - 6} more
                </span>
              ) : null}
            </div>
          ) : null}

          {sessionCount ? (
            <p className="text-xs text-text-tertiary">
              Presenting {sessionCount} session{sessionCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        {/* Contact + socials */}
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <div className="flex gap-2">
            <SocialLink href={normalizeHref("email", cfg.email)} icon={Mail} label="Email" />
            <SocialLink href={normalizeHref("phone", cfg.phone)} icon={Phone} label="Call" />
            <SocialLink href={normalizeHref("website", cfg.website)} icon={Globe} label="Website" />
            <SocialLink href={normalizeHref("twitter", cfg.twitter)} icon={Twitter} label="X / Twitter" />
            <SocialLink href={normalizeHref("url", cfg.linkedin)} icon={Linkedin} label="LinkedIn" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Speaker Portal progress hero --------------------------------------------

// The five self-service tasks a speaker completes in their portal. Each maps to a
// boolean in the record's config; the hero renders them as a checklist + ring.
export const PORTAL_TASKS = [
  { key: "bioSubmitted", label: "Bio", icon: FileText },
  { key: "headshotSubmitted", label: "Headshot", icon: ImageIcon },
  { key: "slidesSubmitted", label: "Slides", icon: Presentation },
  { key: "avFormSubmitted", label: "A/V form", icon: ClipboardCheck },
  { key: "availabilityConfirmed", label: "Availability", icon: CalendarCheck },
];

// A completion ring (SVG) that fills to `value` percent.
function ProgressRing({ value, size = 88 }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-surface-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ strokeDasharray: circ, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

// A rich header for the Speaker Portal editor — the invitee, their session, a
// completion ring, and the task checklist at a glance. Display-only; the toggles
// live in the "Checklist" section below (it reflects the live form via `record`).
export function PortalProgressHero({ record }) {
  const cfg = record.config || {};
  const done = PORTAL_TASKS.filter((t) => cfg[t.key]).length;
  const pctDone = (done / PORTAL_TASKS.length) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl"
      />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
        <ProgressRing value={pctDone} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {record.name || "Untitled invite"}
            </h2>
            <StatusPill status={record.status} map={PORTAL_STATUS_MAP} />
          </div>
          <p className="text-sm font-medium text-text-secondary">
            {cfg.sessionTitle ? cfg.sessionTitle : "No session assigned yet"}
            {cfg.deadline ? ` · due ${cfg.deadline}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PORTAL_TASKS.map((t) => {
              const on = Boolean(cfg[t.key]);
              const Icon = t.icon;
              return (
                <span
                  key={t.key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                    on
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-border bg-surface-card text-text-tertiary",
                  )}
                >
                  {on ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {t.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <SocialLink href={normalizeHref("email", cfg.email)} icon={Mail} label="Email" />
          {cfg.portalUrl ? (
            <SocialLink href={normalizeHref("url", cfg.portalUrl)} icon={Contact} label="Open portal" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- Session multi-picker (Assign Agenda) ------------------------------------

// "HH:mm" -> minutes; total duration of a set of sessions (for the footer).
function sessionMinutes(session) {
  const parse = (t) => {
    if (!t || typeof t !== "string") return null;
    const [h, m] = t.split(":").map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const s = parse(session.config?.startTime);
  const e = parse(session.config?.endTime);
  return s != null && e != null && e > s ? e - s : 0;
}

// SessionMultiField — pick MANY sessions (module "session") into an agenda, stored
// at config.sessionIds. Searchable checkbox list with event/day/time meta, mirrors
// EventMultiField. Persists immediately via `commit`.
export function SessionMultiField({ record, commit, configKey = "sessionIds" }) {
  const { projectId } = useProject();
  const [sessions, setSessions] = useState(null);
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([conferenceApi.list(projectId, "session"), listEvents(projectId)]).then(
      ([sess, evs]) => {
        if (!alive) return;
        setSessions(sess ?? []);
        setEvents(evs ?? []);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventName = useMemo(() => {
    const map = new Map(events.map((e) => [e.id, e.name]));
    return (id) => (id ? map.get(id) || "" : "");
  }, [events]);

  const selected = Array.isArray(record.config?.[configKey]) ? record.config[configKey] : [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = sessions || [];
    if (!term) return list;
    return list.filter((s) =>
      `${s.name} ${s.config?.track || ""} ${s.config?.speaker || ""} ${s.config?.day || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [sessions, q]);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    commit({ config: { ...(record.config || {}), [configKey]: next } });
  };

  const clear = () => commit({ config: { ...(record.config || {}), [configKey]: [] } });

  const totalMins = (sessions || [])
    .filter((s) => selected.includes(s.id))
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  const hours = totalMins ? `${Math.floor(totalMins / 60)}h${totalMins % 60 ? ` ${totalMins % 60}m` : ""}` : null;

  return (
    <SectionCard
      title="Sessions in this agenda"
      description="Pick the sessions this agenda includes — attendees see them as their curated running order."
      action={
        selected.length ? (
          <Button
            variant="outline"
            size="sm"
            onClick={clear}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Clear
          </Button>
        ) : null
      }
    >
      {sessions === null ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface-card px-5 py-8">
          <p className="text-sm text-text-secondary">No sessions built yet.</p>
          <p className="text-xs text-text-tertiary">Create sessions in Agenda Builder, then curate them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sessions, tracks, speakers…"
              className="pl-8"
            />
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {filtered.map((s) => {
              const on = selected.includes(s.id);
              const cfg = s.config || {};
              const time = [cfg.startTime, cfg.endTime].filter(Boolean).join("–");
              const meta = [eventName(cfg.eventId), cfg.day, time, cfg.track]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    on
                      ? "border-border-strong bg-surface-hover"
                      : "border-border bg-surface-card hover:bg-surface-hover",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong bg-transparent",
                    )}
                  >
                    {on ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {s.name || "Untitled session"}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {meta || "No schedule set"}
                    </span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-1 py-3 text-sm text-text-tertiary">No sessions match “{q}”.</p>
            ) : null}
          </div>
          {selected.length ? (
            <p className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Clock className="h-3 w-3" />
              {selected.length} session{selected.length === 1 ? "" : "s"} selected
              {hours ? ` · ${hours}` : ""}
            </p>
          ) : (
            <p className="text-xs text-text-tertiary">No sessions yet — pick some above.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// --- Assign Agenda hero ------------------------------------------------------

// A rich header for the Assign Agenda editor — the agenda name/status, how many
// sessions it carries, the audience summary, and the LIVE resolved reach (how
// many guests currently match the audience spec). Reach re-resolves as the spec
// changes. Display-only; edits happen in the sections below.
export function AgendaAssignHero({ record }) {
  const cfg = record.config || {};
  const sessionCount = Array.isArray(cfg.sessionIds) ? cfg.sessionIds.length : 0;
  const audienceSummary = describeSpec(cfg.audience);
  const [reach, setReach] = useState({ loading: true, count: 0 });

  const specKey = JSON.stringify(cfg.audience || {});
  useEffect(() => {
    let alive = true;
    // Keep the prior count visible while re-resolving (no synchronous setState).
    resolveAudienceEmails(record.projectId, cfg.audience).then(({ count }) => {
      if (alive) setReach({ loading: false, count });
    });
    return () => {
      alive = false;
    };
    // Re-resolve whenever the audience spec or project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.projectId, specKey]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-subtle">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl"
      />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-card text-primary shadow-lg ring-1 ring-white/5">
          <CalendarCheck className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {record.name || "Untitled agenda"}
            </h2>
            <StatusPill status={record.status} map={AGENDA_ASSIGN_STATUS_MAP} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs font-medium text-text-secondary">
              <ListChecks className="h-3.5 w-3.5" />
              {sessionCount} session{sessionCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs font-medium text-text-secondary">
              <Target className="h-3.5 w-3.5" />
              {audienceSummary}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            <Users className="h-3.5 w-3.5" /> Reach
          </span>
          <span className="text-2xl font-bold leading-none text-white tabular-nums">
            {reach.loading ? "…" : reach.count.toLocaleString()}
          </span>
          <span className="text-[11px] text-text-tertiary">guests match</span>
        </div>
      </div>
    </div>
  );
}
