"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  Toolbar,
  SearchInput,
  StatusPill,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
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
import { useProject } from "@/context/project-context";
import { newId } from "@/components/internal/screens/events/sample_data";
import { listRecords } from "@/lib/supabase/ticketing";
import {
  listMembers,
  createMember,
  updateMember,
  softDeleteMember,
} from "@/lib/supabase/memberships";
import { formatDate, MEMBER_STATUS_MAP } from "../tickets/constants";

const STATUSES = ["Active", "Expired", "Cancelled"];

function AddMemberDialog({ open, onOpenChange, plans, onCreate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [membershipId, setMembershipId] = useState("");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setEmail("");
      setMembershipId(plans[0]?.id || "");
    }
  }

  const submit = () => {
    if (!name.trim() && !email.trim()) {
      toast.error("Add a name or email.");
      return;
    }
    onCreate({ name: name.trim(), email: email.trim(), membershipId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Enroll someone in a membership plan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="member-name">
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </Field>
          <Field label="Email" htmlFor="member-email">
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Plan">
            <Select value={membershipId} onValueChange={setMembershipId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.length ? (
                  plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No plans yet
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
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
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersScreen() {
  const { projectId } = useProject();
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listMembers(projectId),
      listRecords(projectId, "membership"),
    ]).then(([m, p]) => {
      if (!alive) return;
      setMembers(m ?? []);
      setPlans(p ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const planName = useMemo(() => {
    const map = {};
    for (const p of plans) map[p.id] = p.name;
    return map;
  }, [plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) =>
      q
        ? (m.name || "").toLowerCase().includes(q) ||
          (m.email || "").toLowerCase().includes(q)
        : true,
    );
  }, [members, search]);

  const handleCreate = ({ name, email, membershipId }) => {
    const member = {
      id: newId(),
      projectId,
      membershipId: membershipId || null,
      name,
      email,
      status: "Active",
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    setMembers((prev) => [member, ...prev]);
    createMember(member).then((saved) => {
      if (saved === null) return;
      if (!saved) toast.error("Couldn't save the member to the server.");
      else {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? saved : m)));
        toast.success("Member added.");
      }
    });
  };

  const setStatus = (member, status) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status } : m)),
    );
    updateMember(member.id, { status }).then((res) => {
      if (res === false) toast.error("Couldn't update on the server.");
    });
  };

  const remove = (member) => {
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    toast.success("Member removed.");
    softDeleteMember(member.id).then((ok) => {
      if (ok === false) toast.error("Couldn't remove on the server.");
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Members"
        description="Everyone enrolled in a membership plan."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search members…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
        </div>
      ) : filtered.length ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface-subtle px-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {m.name || m.email || "Member"}
                  </span>
                  <StatusPill status={m.status} map={MEMBER_STATUS_MAP} />
                </div>
                <p className="mt-0.5 truncate text-xs text-text-secondary">
                  {planName[m.membershipId] || "No plan"}
                  {m.email && m.name ? ` · ${m.email}` : ""} · since{" "}
                  {formatDate(m.startedAt)}
                </p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
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
                    {STATUSES.filter((s) => s !== m.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                        onClick={() => setStatus(m, s)}
                      >
                        Mark {s.toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-surface-strong" />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                      onClick={() => remove(m)}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Users}
            title={members.length ? "No matches" : "No members yet"}
            description={
              members.length
                ? "Try a different search."
                : "Add your first member, or let people join from the public page."
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add member
              </Button>
            }
          />
        </div>
      )}

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        plans={plans}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default MembersScreen;
