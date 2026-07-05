"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Accessibility,
  ArrowDown,
  ArrowUp,
  Check,
  CircleDot,
  Download,
  ListChecks,
  Loader2,
  MailQuestion,
  MessageSquare,
  Plus,
  RotateCcw,
  Trash2,
  Utensils,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  SettingsList,
  SettingRow,
  StatGrid,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@geiger/ui";
import { MoreHorizontal } from "lucide-react";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { listEvents } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import {
  getDietaryConfig,
  upsertDietaryConfig,
  listDietaryRequests,
  updateDietaryRequest,
  softDeleteDietaryRequest,
} from "@/lib/supabase/dietary";
import { useProject } from "@/context/project-context";
import {
  DIETARY_ANSWER_PREFIX,
  DIETARY_QUESTION_TYPE_OPTIONS,
  DIETARY_REQUEST_STATUS_MAP,
  DIETARY_REQUEST_STATUS_FILTER_OPTIONS,
  DIETARY_TAGS,
  formatDateTime,
} from "./constants";
import { downloadCsv } from "./csv";

const shortId = () => `dq_${Math.random().toString(36).slice(2, 8)}`;

// Tab switch — same segmented-control style as the Registrations view switch.
const TABS = [
  { key: "report", label: "Needs report", icon: Accessibility },
  { key: "requests", label: "Requests", icon: MessageSquare },
  { key: "inquiry", label: "Inquiry", icon: MailQuestion },
];

// ===========================================================================
// Needs report (existing behaviour, now a tab).
// ===========================================================================
function NeedsReportTab({ regs, events, eventNames, questions, registerExport, tabSwitch }) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events.map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const withNeeds = useMemo(
    () =>
      regs.filter(
        (r) =>
          !["Cancelled", "Declined"].includes(r.status) &&
          (r.dietary?.trim() || r.accessibility?.trim()),
      ),
    [regs],
  );

  const scoped = useMemo(
    () =>
      withNeeds.filter((r) =>
        eventFilter === "all" ? true : r.eventId === eventFilter,
      ),
    [withNeeds, eventFilter],
  );

  const filtered = useMemo(
    () =>
      scoped.filter((r) =>
        search
          ? `${r.name} ${r.dietary} ${r.accessibility}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [scoped, search],
  );

  const dietaryBreakdown = useMemo(() => {
    const diet = scoped.filter((r) => r.dietary?.trim());
    return DIETARY_TAGS.map((tag) => ({
      tag,
      count: diet.filter((r) =>
        r.dietary.toLowerCase().includes(tag.toLowerCase()),
      ).length,
    })).filter((b) => b.count > 0);
  }, [scoped]);

  // Inquiry aggregate — option counts across the scoped registrations whose
  // answers carry this question's structured response.
  const inquiryBreakdown = useMemo(() => {
    const scopedRegs =
      eventFilter === "all"
        ? regs.filter((r) => !["Cancelled", "Declined"].includes(r.status))
        : regs.filter(
            (r) =>
              r.eventId === eventFilter &&
              !["Cancelled", "Declined"].includes(r.status),
          );
    return (questions || [])
      .map((q) => {
        const key = `${DIETARY_ANSWER_PREFIX}${q.id}`;
        const counts = (q.options || []).map((opt) => {
          const count = scopedRegs.filter((r) => {
            const v = r.answers?.[key];
            if (Array.isArray(v)) return v.includes(opt.label);
            return v === opt.label;
          }).length;
          return { label: opt.label, count };
        });
        const total = counts.reduce((s, c) => s + c.count, 0);
        return { question: q, counts, total };
      })
      .filter((b) => b.total > 0);
  }, [regs, questions, eventFilter]);

  const stats = useMemo(() => {
    const dietary = scoped.filter((r) => r.dietary?.trim()).length;
    const access = scoped.filter((r) => r.accessibility?.trim()).length;
    const heads = scoped.reduce((s, r) => s + (Number(r.partySize) || 1), 0);
    return [
      { label: "Registrations with needs", value: String(scoped.length), hint: `${heads} total heads` },
      { label: "Dietary requirements", value: String(dietary), hint: "For catering" },
      { label: "Accessibility requests", value: String(access), hint: "For venue ops" },
    ];
  }, [scoped]);

  const handleExport = useCallback(() => {
    if (!filtered.length) {
      toast.error("Nothing to export for these filters.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Event", value: (r) => eventNames[r.eventId] || "" },
        { header: "Dietary", value: (r) => r.dietary },
        { header: "Accessibility", value: (r) => r.accessibility },
        { header: "Party", value: (r) => r.partySize },
      ],
      filtered,
      "dietary-accessibility.csv",
    );
    toast.success(`Exported ${filtered.length} rows.`);
  }, [filtered, eventNames]);

  // Register this tab's export with the shared top-row Export button.
  useEffect(() => {
    registerExport(() => handleExport);
    return () => registerExport(null);
  }, [handleExport, registerExport]);

  const columns = [
    {
      key: "name",
      header: "Registrant",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{r.name}</span>
          <span className="text-xs text-text-secondary">
            {eventNames[r.eventId] || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "dietary",
      header: "Dietary",
      render: (r) =>
        r.dietary?.trim() ? (
          <Badge variant="warning">{r.dietary}</Badge>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "accessibility",
      header: "Accessibility",
      render: (r) =>
        r.accessibility?.trim() ? (
          <span className="text-sm text-foreground">{r.accessibility}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      key: "party",
      header: "Party",
      align: "right",
      className: "text-right tabular-nums",
      render: (r) => r.partySize,
    },
    {
      key: "registered",
      header: "Registered",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <FilterDropdown
          value={eventFilter}
          onValueChange={setEventFilter}
          options={eventFilterOptions}
          height="h-9"
        />
        {tabSwitch}
      </div>

      <StatGrid stats={stats} columns={3} />

      <SectionCard
        title="Dietary breakdown"
        description="Headcount per requirement for the current scope — hand this to catering."
      >
        {dietaryBreakdown.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {dietaryBreakdown.map((b) => (
              <div
                key={b.tag}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-card px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-amber-400">
                  <Utensils className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none text-foreground tabular-nums">
                    {b.count}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">{b.tag}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-sm text-text-secondary">
            No dietary requirements recorded for this scope.
          </p>
        )}
      </SectionCard>

      {inquiryBreakdown.length ? (
        <SectionCard
          title="Inquiry responses"
          description="Structured dietary & accessibility answers collected in the ticket form."
        >
          <div className="space-y-4">
            {inquiryBreakdown.map((b) => (
              <div key={b.question.id}>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {b.question.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {b.counts
                    .filter((c) => c.count > 0)
                    .map((c) => (
                      <span
                        key={c.label}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {c.label}
                        <span className="tabular-nums text-foreground">
                          {c.count}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <Toolbar>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Accessibility className="h-4 w-4 text-text-tertiary" />
          {filtered.length} {filtered.length === 1 ? "person" : "people"} with needs
        </span>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or need…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(r) => r.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Accessibility}
              title={scoped.length ? "No needs match your search" : "No special needs recorded"}
              description={
                scoped.length
                  ? "Try a different search."
                  : "When registrants share dietary or accessibility needs, they're collected here for planning."
              }
            />
          </div>
        }
      />
    </div>
  );
}

// ===========================================================================
// Requests inbox (post-purchase free-text queries).
// ===========================================================================
function RequestsTab({ config, onConfigChange, requests, setRequests, events, eventNames, registerExport, tabSwitch }) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [promptDraft, setPromptDraft] = useState(config.requestPrompt || "");

  const eventFilterOptions = useMemo(
    () => [
      { value: "all", label: "All events" },
      ...events.map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (
          search &&
          !`${r.name} ${r.email} ${r.message}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [requests, search, eventFilter, statusFilter],
  );

  const openCount = requests.filter((r) => r.status === "Open").length;

  const toggleEnabled = (value) => onConfigChange({ requestsEnabled: value });
  const savePrompt = () => {
    if ((promptDraft || "") === (config.requestPrompt || "")) return;
    onConfigChange({ requestPrompt: promptDraft });
  };

  const setStatus = (req, status) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status } : r)),
    );
    updateDietaryRequest(req.id, { status }).then((res) => {
      if (res === null) toast.error("Couldn't update the request.");
    });
  };

  const remove = (req) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.success("Request deleted.");
    softDeleteDietaryRequest(req.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const handleExport = useCallback(() => {
    if (!filtered.length) {
      toast.error("Nothing to export for these filters.");
      return;
    }
    downloadCsv(
      [
        { header: "Name", value: (r) => r.name },
        { header: "Email", value: (r) => r.email },
        { header: "Event", value: (r) => eventNames[r.eventId] || "" },
        { header: "Message", value: (r) => r.message },
        { header: "Status", value: (r) => r.status },
        { header: "Received", value: (r) => formatDateTime(r.createdAt) },
      ],
      filtered,
      "dietary-requests.csv",
    );
    toast.success(`Exported ${filtered.length} rows.`);
  }, [filtered, eventNames]);

  // Register this tab's export with the shared top-row Export button.
  useEffect(() => {
    registerExport(() => handleExport);
    return () => registerExport(null);
  }, [handleExport, registerExport]);

  const columns = [
    {
      key: "name",
      header: "From",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{r.name || "Guest"}</span>
          <span className="text-xs text-text-secondary">{r.email || "—"}</span>
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {eventNames[r.eventId] || "—"}
        </span>
      ),
    },
    {
      key: "message",
      header: "Request",
      render: (r) => (
        <span className="line-clamp-2 max-w-md text-sm text-foreground">
          {r.message}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill status={r.status} map={DIETARY_REQUEST_STATUS_MAP} />
      ),
    },
    {
      key: "received",
      header: "Received",
      render: (r) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (r) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-card shadow-xl"
            >
              {r.status === "Open" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => setStatus(r, "Resolved")}
                >
                  <Check className="h-4 w-4" /> Mark resolved
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => setStatus(r, "Open")}
                >
                  <RotateCcw className="h-4 w-4" /> Reopen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => remove(r)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Attendee requests"
        description="Let ticket holders send a dietary or accessibility request from the order-success page."
      >
        <SettingsList>
          <SettingRow
            title="Enable Dietary & Accessibility Requests"
            description="Shows a request button after checkout. Each event must also opt in from its Dietary & Accessibility tab."
            checked={config.requestsEnabled}
            onCheckedChange={toggleEnabled}
          />
        </SettingsList>
        {config.requestsEnabled ? (
          <div className="mt-4">
            <Field label="Request prompt" hint="Helper text shown above the message box.">
              <Textarea
                rows={2}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                onBlur={savePrompt}
                placeholder="e.g. Let us know any dietary or accessibility needs and we'll do our best to accommodate."
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={eventFilter}
            onValueChange={setEventFilter}
            options={eventFilterOptions}
            height="h-9"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={DIETARY_REQUEST_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <span className="text-sm text-text-tertiary">
            {openCount} open
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search requests…"
            className="w-full sm:max-w-xs"
          />
          {tabSwitch}
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(r) => r.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={MessageSquare}
              title={requests.length ? "No requests match your filters" : "No requests yet"}
              description={
                requests.length
                  ? "Try clearing the search or filters."
                  : "When ticket holders send a dietary or accessibility request, it lands here."
              }
            />
          </div>
        }
      />
    </div>
  );
}

// ===========================================================================
// Inquiry builder (radio / multiselect question set for ticket forms).
// ===========================================================================
function InquiryTab({ config, onSave, tabSwitch }) {
  const [questions, setQuestions] = useState(config.questions || []);
  const [title, setTitle] = useState(config.inquiryTitle || "");
  const [description, setDescription] = useState(config.inquiryDescription || "");
  const [saving, setSaving] = useState(false);

  const addQuestion = () =>
    setQuestions((q) => [
      ...q,
      {
        id: shortId(),
        label: "Untitled question",
        type: "radio",
        required: false,
        options: [{ id: shortId(), label: "" }],
      },
    ]);

  const updateQuestion = (id, patch) =>
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeQuestion = (id) =>
    setQuestions((q) => q.filter((x) => x.id !== id));

  const moveQuestion = (index, dir) =>
    setQuestions((q) => {
      const j = index + dir;
      if (j < 0 || j >= q.length) return q;
      const next = [...q];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const setOptions = (qid, options) => updateQuestion(qid, { options });
  const addOption = (question) =>
    setOptions(question.id, [
      ...(question.options || []),
      { id: shortId(), label: "" },
    ]);
  const updateOption = (question, optId, label) =>
    setOptions(
      question.id,
      (question.options || []).map((o) =>
        o.id === optId ? { ...o, label } : o,
      ),
    );
  const removeOption = (question, optId) =>
    setOptions(
      question.id,
      (question.options || []).filter((o) => o.id !== optId),
    );

  const save = async () => {
    // Drop empty option labels; keep only questions with a label + an option.
    const cleaned = questions
      .map((q) => ({
        ...q,
        label: q.label.trim(),
        options: (q.options || [])
          .map((o) => ({ id: o.id, label: o.label.trim() }))
          .filter((o) => o.label),
      }))
      .filter((q) => q.label && q.options.length);
    setSaving(true);
    const ok = await onSave({
      questions: cleaned,
      inquiryTitle: title.trim(),
      inquiryDescription: description.trim(),
    });
    setSaving(false);
    if (ok) {
      setQuestions(cleaned);
      toast.success("Inquiry saved.");
    } else {
      toast.error("Couldn't save the inquiry.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">{tabSwitch}</div>

      <SectionCard
        title="Introduction"
        description="Optional heading and copy shown above the inquiry in the ticket form."
      >
        <div className="space-y-4">
          <Field label="Heading">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dietary & accessibility"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell attendees why you're asking."
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Questions"
        description="Radio and multiselect questions included in the ticket form of any event that attaches this inquiry."
        action={
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addQuestion}
          >
            <Plus className="h-4 w-4" /> Add question
          </Button>
        }
      >
        {questions.length ? (
          <div className="space-y-3">
            {questions.map((q, i) => {
              const TypeIcon = q.type === "multiselect" ? ListChecks : CircleDot;
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-border bg-surface-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-2 flex flex-col text-text-tertiary">
                      <button
                        type="button"
                        aria-label="Move up"
                        className="hover:text-foreground disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => moveQuestion(i, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <TypeIcon className="my-0.5 h-4 w-4" />
                      <button
                        type="button"
                        aria-label="Move down"
                        className="hover:text-foreground disabled:opacity-30"
                        disabled={i === questions.length - 1}
                        onClick={() => moveQuestion(i, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid flex-1 gap-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                        <Field label="Question label">
                          <Input
                            value={q.label}
                            onChange={(e) =>
                              updateQuestion(q.id, { label: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Type">
                          <Select
                            value={q.type}
                            onValueChange={(v) => updateQuestion(q.id, { type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DIETARY_QUESTION_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Options">
                        <div className="space-y-2">
                          {(q.options || []).map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <Input
                                value={o.label}
                                onChange={(e) =>
                                  updateOption(q, o.id, e.target.value)
                                }
                                placeholder="Option label"
                                className="flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={(q.options || []).length <= 1}
                                onClick={() => removeOption(q, o.id)}
                                aria-label="Remove option"
                                className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addOption(q)}
                          className="mt-2 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        >
                          <Plus className="h-4 w-4" /> Add option
                        </Button>
                      </Field>

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Switch
                            checked={!!q.required}
                            onCheckedChange={(v) =>
                              updateQuestion(q.id, { required: v })
                            }
                          />
                          Required
                        </label>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove question"
                          className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => removeQuestion(q.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={MailQuestion}
            title="No questions yet"
            description="Add radio or multiselect questions to ask at checkout. Attach the inquiry per event from its Ticket Types tab."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={addQuestion}
              >
                <Plus className="h-4 w-4" /> Add question
              </Button>
            }
          />
        )}
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={save}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save inquiry"}
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Screen — tabbed shell.
// ===========================================================================
export function DietaryAccessibilityScreen() {
  const [regs, setRegs] = useState([]);
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("report");
  // The active tab registers its export here; the shared top-row button calls it
  // (null → the tab has nothing to export, so the button is hidden, e.g. Inquiry).
  const [exportHandler, setExportHandler] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([
      listRegistrations(projectId),
      listEvents(projectId),
      getDietaryConfig(projectId),
      listDietaryRequests(projectId),
    ]).then(([rows, evts, cfg, reqs]) => {
      if (!alive) return;
      setRegs(rows ?? []);
      setEvents(evts ?? []);
      // Fall back to an empty config so the screen renders even when the DB is
      // unconfigured or the read failed (rather than stalling on "Loading…").
      setConfig(
        cfg ?? {
          projectId,
          requestsEnabled: false,
          requestPrompt: "",
          inquiryTitle: "",
          inquiryDescription: "",
          questions: [],
        },
      );
      setRequests(reqs ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventNames = useMemo(() => {
    const m = {};
    for (const e of events) m[e.id] = e.name;
    return m;
  }, [events]);

  // Config mutations are optimistic; persist through the data layer.
  const patchConfig = (patch) => {
    setConfig((prev) => ({ ...(prev || {}), ...patch }));
    upsertDietaryConfig(projectId, patch).then((saved) => {
      if (saved === null) toast.error("Couldn't save the setting.");
      else setConfig(saved);
    });
  };

  const saveInquiry = async (patch) => {
    const saved = await upsertDietaryConfig(projectId, patch);
    if (saved) {
      setConfig(saved);
      return true;
    }
    return false;
  };

  // Icon-only Export (for the active tab) + segmented tab switch — rendered
  // inline on each tab's toolbar row so it lines up with that tab's filters.
  const tabSwitch = (
    <div className="flex items-center gap-2">
      {exportHandler ? (
        <Button
          variant="outline"
          size="icon"
          aria-label="Export"
          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={exportHandler}
        >
          <Download className="h-4 w-4" />
        </Button>
      ) : null}
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-surface-hover text-foreground"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Dietary & Accessibility"
        description="Plan for every dietary and accessibility need — a catering & venue-ops report, an attendee request inbox, and a ticket-form inquiry."
      />

      {loading || !config ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {tab === "report" ? (
            <NeedsReportTab
              regs={regs}
              events={events}
              eventNames={eventNames}
              questions={config.questions}
              registerExport={setExportHandler}
              tabSwitch={tabSwitch}
            />
          ) : null}

          {tab === "requests" ? (
            <RequestsTab
              config={config}
              onConfigChange={patchConfig}
              requests={requests}
              setRequests={setRequests}
              events={events}
              eventNames={eventNames}
              registerExport={setExportHandler}
              tabSwitch={tabSwitch}
            />
          ) : null}

          {tab === "inquiry" ? (
            <InquiryTab config={config} onSave={saveInquiry} tabSwitch={tabSwitch} />
          ) : null}
        </>
      )}
    </MainScreenWrapper>
  );
}

export default DietaryAccessibilityScreen;
