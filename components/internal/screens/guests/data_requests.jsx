"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, ShieldAlert, Trash2 } from "lucide-react";

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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listContacts } from "@/lib/supabase/contacts";
import {
  listDataRequests,
  createDataRequest,
  updateDataRequest,
  softDeleteDataRequest,
} from "@/lib/supabase/data_requests";
import { getUser } from "@/lib/supabase/user";
import {
  DATA_REQUEST_STATUS_FILTER_OPTIONS,
  DATA_REQUEST_STATUS_MAP,
  DATA_REQUEST_STATUS_VALUES,
  DATA_REQUEST_TYPE_MAP,
  DATA_REQUEST_TYPE_VALUES,
  formatDateTime,
} from "./constants";

const isOverdue = (r) =>
  r.status !== "Completed" &&
  r.status !== "Rejected" &&
  r.dueAt &&
  new Date(r.dueAt) < new Date();

export function DataRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listDataRequests(projectId), listContacts(projectId)]).then(
      ([rs, cs]) => {
        if (!alive) return;
        setRequests(rs ?? []);
        setContacts(cs ?? []);
        setLoading(false);
      },
    );
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [requests, search, statusFilter]);

  const stats = useMemo(() => {
    const open = requests.filter(
      (r) => r.status === "New" || r.status === "In Progress",
    ).length;
    const overdue = requests.filter(isOverdue).length;
    const completed = requests.filter((r) => r.status === "Completed").length;
    return [
      { label: "Open", value: open.toLocaleString() },
      { label: "Overdue", value: overdue.toLocaleString() },
      { label: "Completed", value: completed.toLocaleString() },
    ];
  }, [requests]);

  const filtersActive = statusFilter !== "all" || Boolean(search.trim());

  const handleCreate = ({ email, type, note }) => {
    const linked = contacts.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase(),
    );
    const req = {
      id: crypto.randomUUID(),
      projectId,
      contactId: linked?.id || null,
      email: email.trim(),
      type,
      status: "New",
      note,
      dueAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    setRequests((prev) => [req, ...prev]);
    toast.success("Request logged.");
    createDataRequest(req).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the request.");
      else setRequests((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    });
  };

  const handleStatus = (req, status) => {
    const patch = {
      status,
      resolvedAt:
        status === "Completed" || status === "Rejected"
          ? new Date().toISOString()
          : null,
    };
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, ...patch } : r)),
    );
    toast.success(`Marked ${status}.`);
    updateDataRequest(req.id, patch).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
    });
  };

  const handleDelete = (req) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.success("Request removed.");
    softDeleteDataRequest(req.id).then((ok) => {
      if (ok === false) toast.error("Couldn't delete on the server.");
    });
  };

  const columns = [
    {
      key: "requester",
      header: "Requester",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {r.email || "—"}
          </p>
          <p className="text-xs text-text-secondary">
            {r.contactId ? "Linked contact" : "No contact record"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <Badge variant={DATA_REQUEST_TYPE_MAP[r.type]?.variant || "neutral"}>
          {DATA_REQUEST_TYPE_MAP[r.type]?.label || r.type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={DATA_REQUEST_STATUS_MAP} />,
    },
    {
      key: "due",
      header: "Due",
      render: (r) => (
        <span
          className={cn(
            "text-sm",
            isOverdue(r) ? "font-medium text-red-400" : "text-text-secondary",
          )}
        >
          {formatDateTime(r.dueAt)}
          {isOverdue(r) ? " · overdue" : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-text-secondary hover:text-foreground"
                aria-label="Request actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border bg-surface-subtle text-foreground"
            >
              {DATA_REQUEST_STATUS_VALUES.filter((s) => s !== r.status).map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="focus:bg-surface-hover"
                  onClick={() => handleStatus(r, s)}
                >
                  Mark {s}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => setDeleteTarget(r)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Data Requests"
        description="Track GDPR/CCPA export, erasure, and rectification requests to resolution — each with a 30-day due date."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <ShieldAlert className="h-4 w-4" /> New request
          </Button>
        }
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <FilterDropdown
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={DATA_REQUEST_STATUS_FILTER_OPTIONS}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by email…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={ShieldAlert}
              title={filtersActive ? "No requests match" : "No data requests"}
              description={
                filtersActive
                  ? "Try a different status or search."
                  : "Log a subject-access or erasure request to track it to completion."
              }
              action={
                filtersActive ? null : (
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setCreateOpen(true)}
                  >
                    <ShieldAlert className="h-4 w-4" /> New request
                  </Button>
                )
              }
            />
          }
        />
      )}

      <NewRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete request</DialogTitle>
            <DialogDescription>
              Remove this data request? Keep a record if you need an audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                handleDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

function NewRequestDialog({ open, onOpenChange, onCreate }) {
  const [email, setEmail] = useState("");
  const [type, setType] = useState("Export");
  const [note, setNote] = useState("");

  const reset = () => {
    setEmail("");
    setType("Export");
    setNote("");
  };

  const submit = () => {
    if (!email.trim()) {
      toast.error("Enter the requester's email.");
      return;
    }
    onCreate({ email, type, note });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>New data request</DialogTitle>
          <DialogDescription>
            Log a privacy request. It&apos;s linked to a contact automatically
            when the email matches.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Requester email" htmlFor="dr-email">
            <Input
              id="dr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
          </Field>
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_REQUEST_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Note" hint="Optional context for your team">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth recording…"
              rows={2}
            />
          </Field>
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
            Log request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataRequestsScreen;
