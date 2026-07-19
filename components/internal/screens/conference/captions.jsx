"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioLines, FileText, Loader2, Plus, Video, X } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { conferenceApi } from "@/lib/supabase/conference";
import { CAPTION_STATUS_MAP } from "./constants";
import {
  CaptionSettings,
  CAPTION_SETTINGS_MODULE,
  LANGUAGES,
  resolveJobOptions,
} from "./caption_settings";

// Captions & Transcription — run Whisper transcription over the recordings in the
// library. The create dialog picks a recording + model and starts a conversion
// job; the list shows each job, pending ones spinning until the (simulated)
// transcription completes, and every job can be cleared individually. The
// provider/model catalogue comes from the shared Transcription settings.

const JOB_MODULE = "caption";
const RECORDING_MODULE = "recording";
// How long the simulated transcription runs before a job flips to Ready.
const PROCESS_MS = 4500;

const languageLabel = (code) =>
  LANGUAGES.find((l) => l.value === code)?.label || "Auto-detect";

// A believable word count derived from the recording's duration ("42:15") so the
// finished job reads like a real transcript rather than a random number.
function estimateWords(duration) {
  const parts = String(duration || "").split(":").map(Number);
  const minutes = parts.length === 2 && !parts.some(Number.isNaN)
    ? parts[0] + parts[1] / 60
    : 20;
  return Math.round(minutes * 135);
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.keys(CAPTION_STATUS_MAP).map((k) => ({ value: k, label: k })),
];

// --- Create dialog -----------------------------------------------------------

function NewJobDialog({ open, onOpenChange, recordings, jobOptions, onStart }) {
  const [recordingId, setRecordingId] = useState("");
  const [model, setModel] = useState(jobOptions.defaultModel);
  const [language, setLanguage] = useState(jobOptions.defaultLanguage);

  // Re-seed defaults from settings whenever the dialog opens.
  const reset = () => {
    setRecordingId("");
    setModel(jobOptions.defaultModel);
    setLanguage(jobOptions.defaultLanguage);
  };

  const close = (o) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = () => {
    if (!recordingId) {
      toast.error("Pick a recording to transcribe first.");
      return;
    }
    onStart({ recordingId, model, language });
    reset();
    onOpenChange(false);
  };

  const hasRecordings = recordings.length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">Transcribe a recording</DialogTitle>
            <DialogDescription className="text-xs">
              Choose a recording and a model, then start the conversion job.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid gap-4 p-5">
          <Field label="Recording" hint="Captions are generated from a recording in your library.">
            {hasRecordings ? (
              <Select value={recordingId} onValueChange={setRecordingId}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Select a recording…" />
                </SelectTrigger>
                <SelectContent>
                  {recordings.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name || "Untitled recording"}
                      {r.config?.duration ? ` · ${r.config.duration}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface-subtle/40 px-3 py-4 text-center text-xs text-text-secondary">
                No recordings yet — add one in Recordings &amp; Replay first.
              </div>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Model">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jobOptions.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Language">
              <Select value={language} onValueChange={setLanguage}>
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
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!hasRecordings}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            <AudioLines className="h-4 w-4" /> Start conversion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Screen ------------------------------------------------------------------

export function CaptionsTranscriptionScreen() {
  const { projectId } = useProject();
  const [jobs, setJobs] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [jobOptions, setJobOptions] = useState(() => resolveJobOptions(null));
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const userIdRef = useRef(null);
  const timersRef = useRef({});

  // Persist a status/output change for a job and reflect it locally.
  const patchJob = (id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch, config: { ...j.config, ...(patch.config || {}) } } : j)));
    conferenceApi.update(id, patch).then((ok) => {
      if (!ok) toast.error("Couldn't update the job on the server.");
    });
  };

  // Simulated transcription: after PROCESS_MS a pending job completes with a
  // transcript. Kept in a ref so clearing a job can cancel its timer.
  const runJob = (job) => {
    if (timersRef.current[job.id]) return;
    timersRef.current[job.id] = setTimeout(() => {
      delete timersRef.current[job.id];
      patchJob(job.id, {
        status: "Ready",
        config: {
          accuracy: 97,
          wordCount: estimateWords(job.config?.duration),
          transcriptUrl: `https://transcripts.geiger.app/${job.id}.vtt`,
        },
      });
    }, PROCESS_MS);
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      conferenceApi.list(projectId, JOB_MODULE),
      conferenceApi.list(projectId, RECORDING_MODULE),
      conferenceApi.list(projectId, CAPTION_SETTINGS_MODULE),
      getUser(),
    ]).then(([jobRows, recRows, settingsRows, user]) => {
      if (!alive) return;
      userIdRef.current = user?.id || null;
      const loaded = jobRows ?? [];
      setJobs(loaded);
      setRecordings(recRows ?? []);
      setJobOptions(resolveJobOptions(settingsRows?.[0]?.config));
      setLoading(false);
      // Resume any jobs left mid-conversion so their loading state resolves.
      loaded.filter((j) => j.status === "Processing").forEach(runJob);
    });
    return () => {
      alive = false;
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleStart = ({ recordingId, model, language }) => {
    const rec = recordings.find((r) => r.id === recordingId);
    const id = crypto.randomUUID();
    const job = {
      id,
      module: JOB_MODULE,
      name: rec?.name || "Transcription job",
      status: "Processing",
      coverUrl: "",
      config: {
        recordingId,
        session: rec?.config?.session || "",
        duration: rec?.config?.duration || "",
        model,
        mode: "AI auto",
        provider: jobOptions.providerLabel,
        language,
        languages: [languageLabel(language)],
        sourceLanguage: languageLabel(language),
        accuracy: "",
        wordCount: 0,
        transcriptUrl: "",
      },
      createdBy: userIdRef.current,
      projectId,
    };
    setJobs((prev) => [job, ...prev]);
    toast.success(`Transcribing "${job.name}"…`);
    conferenceApi.create(job).then((saved) => {
      if (!saved) {
        toast.error("Couldn't start the job on the server.");
        setJobs((prev) => prev.filter((j) => j.id !== id));
        return;
      }
      runJob(job);
    });
  };

  const handleClear = (job) => {
    if (timersRef.current[job.id]) {
      clearTimeout(timersRef.current[job.id]);
      delete timersRef.current[job.id];
    }
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    toast.success(`Cleared "${job.name}".`);
    conferenceApi.remove(job.id).then((ok) => {
      if (!ok) toast.error("Couldn't clear the job on the server.");
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (
        q &&
        !`${j.name} ${j.config?.session || ""} ${j.config?.model || ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const stats = useMemo(
    () => [
      { label: "Jobs", value: String(jobs.length), footer: "All conversions" },
      { label: "Processing", value: String(jobs.filter((j) => j.status === "Processing").length), footer: "In progress" },
      { label: "Ready", value: String(jobs.filter((j) => j.status === "Ready").length), footer: "Transcripts done" },
      { label: "Recordings", value: String(recordings.length), footer: "Available to transcribe" },
    ],
    [jobs, recordings],
  );

  const columns = [
    {
      key: "recording",
      header: "Recording",
      render: (j) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{j.name}</p>
          {j.config?.session ? (
            <p className="truncate text-xs text-text-secondary">{j.config.session}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "model",
      header: "Model",
      render: (j) => (
        <span className="font-mono text-xs text-text-secondary">{j.config?.model || "—"}</span>
      ),
    },
    {
      key: "language",
      header: "Language",
      render: (j) => (
        <span className="text-sm text-text-secondary">{j.config?.sourceLanguage || languageLabel(j.config?.language)}</span>
      ),
    },
    {
      key: "words",
      header: "Words",
      align: "right",
      className: "text-right",
      render: (j) =>
        j.config?.wordCount ? (
          <span className="tabular-nums text-sm text-text-secondary">{Number(j.config.wordCount).toLocaleString()}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (j) =>
        j.status === "Processing" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
          </span>
        ) : (
          <StatusPill status={j.status} map={CAPTION_STATUS_MAP} />
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (j) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {j.status === "Ready" && j.config?.transcriptUrl ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <a href={j.config.transcriptUrl} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" /> Transcript
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear job"
            className="text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
            onClick={() => handleClear(j)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const hasFilters = search || statusFilter !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Captions & Transcription"
        description="Run Whisper transcription over your recordings — pick a recording and model, start the job, and download the finished transcript."
        actions={
          <div className="flex items-center gap-2">
            <CaptionSettings api={conferenceApi} projectId={projectId} />
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add caption job
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
          height="h-9"
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search recordings, sessions, models…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(j) => j.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={jobs.length ? AudioLines : Video}
                title={jobs.length ? "No jobs match your filters" : "No caption jobs yet"}
                description={
                  jobs.length
                    ? "Try clearing the search or status filter."
                    : "Start your first transcription from a recording in your library."
                }
                action={
                  hasFilters && jobs.length ? (
                    <Button
                      variant="outline"
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> Add caption job
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}

      <NewJobDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        recordings={recordings}
        jobOptions={jobOptions}
        onStart={handleStart}
      />
    </MainScreenWrapper>
  );
}

export default CaptionsTranscriptionScreen;
