"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Workflow as WorkflowIcon,
  Copy,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";

import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  softDeleteWorkflow,
} from "@/lib/supabase/workflows";
import { listEvents } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

import {
  WORKFLOW_STATUS_MAP,
  SCOPE_MAP,
  STATUS_FILTER_OPTIONS,
  TRIGGER_FILTER_OPTIONS,
  TRIGGER_CATALOG,
  catalogEntry,
  formatRelativeDate,
} from "./constants";
import { WorkflowBuilderScreen } from "./workflow_builder";

const EMPTY_DRAFT = {
  name: "",
  trigger: "ticket.purchased",
  scope: "workspace",
  eventId: "",
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wf_${Math.random().toString(36).slice(2)}`;

const stepId = () => `step_${newId()}`;

function CreateWorkflowDialog({ open, onOpenChange, onCreate, events }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give your workflow a name first.");
      return;
    }
    if (draft.scope === "event" && !draft.eventId) {
      toast.error("Pick an event for an event-scoped workflow.");
      return;
    }
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-background">
        <DialogHeader>
          <DialogTitle>Create workflow</DialogTitle>
          <DialogDescription>
            Pick a trigger to start — you can add conditions and actions in the
            builder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Workflow name" htmlFor="wf-name">
            <Input
              id="wf-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. VIP welcome on purchase"
            />
          </Field>

          <Field label="Trigger" hint="The event action that starts this workflow.">
            <Select value={draft.trigger} onValueChange={set("trigger")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_CATALOG.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scope">
              <Select value={draft.scope} onValueChange={set("scope")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">All events (workspace)</SelectItem>
                  <SelectItem value="event">A specific event</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.scope === "event" ? (
              <Field label="Event">
                <Select value={draft.eventId} onValueChange={set("eventId")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {(events || []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AllWorkflowsScreen() {
  const [workflows, setWorkflows] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [trigger, setTrigger] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);

  const { workflowId, openWorkflow, closeWorkflow } = useWorkspaceUrl();

  const eventName = useMemo(() => {
    const map = new Map((events || []).map((e) => [e.id, e.name]));
    return (id) => map.get(id) || "";
  }, [events]);

  const selected = useMemo(
    () => (workflowId ? workflows.find((w) => w.id === workflowId) || null : null),
    [workflowId, workflows],
  );

  useEffect(() => {
    let alive = true;
    listWorkflows().then((rows) => {
      if (!alive) return;
      setWorkflows(rows ?? []);
      setLoading(false);
    });
    listEvents().then((rows) => alive && setEvents(rows ?? []));
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (trigger !== "all" && w.trigger !== trigger) return false;
      if (search) {
        const t = catalogEntry(w.trigger)?.label || "";
        if (!`${w.name} ${t}`.toLowerCase().includes(search.toLowerCase()))
          return false;
      }
      return true;
    });
  }, [workflows, search, status, trigger]);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.status === "Active").length;
    const drafts = workflows.filter((w) => w.status === "Draft").length;
    const runs = workflows.reduce((s, w) => s + (w.runCount || 0), 0);
    return [
      { label: "Total workflows", value: String(workflows.length), footer: `${active} active` },
      { label: "Active", value: String(active), footer: "Listening for triggers" },
      { label: "Total runs", value: runs.toLocaleString(), footer: "Across all workflows" },
      { label: "Drafts", value: String(drafts), footer: "Not yet activated" },
    ];
  }, [workflows]);

  const persistCreate = (workflow) => {
    createWorkflow(workflow).then((saved) => {
      if (!saved) {
        toast.error("Couldn't save the workflow to the server.");
      } else {
        setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
      }
    });
  };

  const handleCreate = (draft) => {
    const name = draft.name.trim();
    const triggerStep = {
      id: stepId(),
      kind: "trigger",
      type: draft.trigger,
      config: {},
      position: { x: 0, y: 0 },
    };
    const workflow = {
      id: newId(),
      name,
      description: "",
      status: "Draft",
      trigger: draft.trigger,
      scope: draft.scope,
      eventId: draft.scope === "event" ? draft.eventId : null,
      steps: [triggerStep],
      graph: {},
      viewMode: "list",
      runCount: 0,
      lastRunAt: null,
      createdBy: userId,
    };
    setWorkflows((prev) => [workflow, ...prev]);
    toast.success(`"${name}" created as a draft.`);
    persistCreate(workflow);
  };

  const handleUpdate = (updated) => {
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    updateWorkflow(updated.id, updated).then((saved) => {
      if (!saved) toast.error("Couldn't save your changes to the server.");
    });
  };

  const handleToggleStatus = (workflow) => {
    const next = workflow.status === "Active" ? "Paused" : "Active";
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflow.id ? { ...w, status: next } : w)),
    );
    toast.success(
      next === "Active" ? `"${workflow.name}" activated.` : `"${workflow.name}" paused.`,
    );
    updateWorkflow(workflow.id, { status: next }).then((saved) => {
      if (!saved) toast.error("Couldn't update the workflow status.");
    });
  };

  const handleDelete = (workflow) => {
    setDeleteTarget(null);
    setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
    toast.success(`Deleted "${workflow.name}".`);
    softDeleteWorkflow(workflow.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete the workflow on the server.");
    });
  };

  const handleDuplicate = (workflow) => {
    const copy = {
      ...workflow,
      id: newId(),
      name: `${workflow.name} (copy)`,
      status: "Draft",
      runCount: 0,
      lastRunAt: null,
      createdBy: userId,
    };
    setWorkflows((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${workflow.name}".`);
    persistCreate(copy);
  };

  const columns = [
    {
      key: "name",
      header: "Workflow",
      render: (w) => {
        const t = catalogEntry(w.trigger);
        const stepCount = Math.max(0, (w.steps?.length || 1) - 1);
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{w.name}</span>
            <span className="text-xs text-text-secondary">
              When {t?.label || "—"} · {stepCount} step{stepCount === 1 ? "" : "s"}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (w) => <StatusPill status={w.status} map={WORKFLOW_STATUS_MAP} />,
    },
    {
      key: "scope",
      header: "Scope",
      render: (w) => (
        <Badge variant={SCOPE_MAP[w.scope]?.variant || "neutral"}>
          {w.scope === "event"
            ? eventName(w.eventId) || "Event"
            : SCOPE_MAP[w.scope]?.label || "Workspace"}
        </Badge>
      ),
    },
    {
      key: "runs",
      header: "Runs",
      align: "right",
      className: "text-right tabular-nums text-text-secondary",
      render: (w) => (w.runCount || 0).toLocaleString(),
    },
    {
      key: "lastRun",
      header: "Last run",
      className: "text-text-secondary",
      render: (w) => formatRelativeDate(w.lastRunAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (w) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                aria-label="Workflow actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => openWorkflow(w.id)}
              >
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleToggleStatus(w)}
              >
                {w.status === "Active" ? (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => handleDuplicate(w)}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(w)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (selected) {
    return (
      <WorkflowBuilderScreen
        workflow={selected}
        events={events}
        onBack={closeWorkflow}
        onUpdate={handleUpdate}
        onDelete={(w) => {
          handleDelete(w);
          closeWorkflow();
        }}
      />
    );
  }

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Workflows"
        description="Automate what happens when something happens — when a ticket is bought, someone checks in, and more. Build flows of conditions and actions."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create workflow
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={trigger}
            onValueChange={setTrigger}
            options={TRIGGER_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search workflows…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workflows…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(w) => w.id}
          onRowClick={(w) => openWorkflow(w.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={WorkflowIcon}
                title={
                  workflows.length
                    ? "No workflows match your filters"
                    : "No workflows yet"
                }
                description={
                  workflows.length
                    ? "Try clearing the search or filters, or create a new workflow."
                    : "Create your first automation — e.g. send a VIP a welcome email the moment they buy a ticket."
                }
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" /> Create workflow
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        events={events}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => handleDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default AllWorkflowsScreen;
