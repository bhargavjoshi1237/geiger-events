"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Mail,
  MoreHorizontal,
  Crown,
  ShieldCheck,
  Users,
  ScanLine,
  Eye,
} from "lucide-react";

import {
  DataTable,
  Field,
  SectionCard,
  EditorSectionHeader,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useEventConfig } from "@/lib/events/use-event-config";

const ROLES = [
  { value: "Owner", description: "Full access, including billing and deletion." },
  { value: "Admin", description: "Manage events, tickets, and team — no billing." },
  { value: "Co-host", description: "Edit event details and message attendees." },
  { value: "Check-in staff", description: "Scan tickets and view the guest list only." },
  { value: "Viewer", description: "Read-only access to analytics and lists." },
];

// Roles ranked by authority — a warm-to-cool palette so tiers read at a glance.
const ROLE_STYLE = {
  Owner: {
    icon: Crown,
    variant: "warning",
    avatar: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  Admin: {
    icon: ShieldCheck,
    variant: "purple",
    avatar: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  },
  "Co-host": {
    icon: Users,
    variant: "info",
    avatar: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  },
  "Check-in staff": {
    icon: ScanLine,
    variant: "success",
    avatar: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  Viewer: {
    icon: Eye,
    variant: "neutral",
    avatar: "border-border bg-surface-card text-muted-foreground",
  },
};

const FALLBACK_STYLE = ROLE_STYLE.Viewer;

function RoleBadge({ role }) {
  const style = ROLE_STYLE[role] || FALLBACK_STYLE;
  const Icon = style.icon;
  return (
    <Badge variant={style.variant}>
      <Icon className="h-3 w-3" />
      {role}
    </Badge>
  );
}

const INITIAL_MEMBERS = [
  { id: "m1", name: "Ava Mitchell", email: "ava@geiger.events", role: "Owner" },
  { id: "m2", name: "Marco Reyes", email: "marco@geiger.events", role: "Admin" },
  { id: "m3", name: "Priya Shah", email: "priya@geiger.events", role: "Co-host" },
  { id: "m4", name: "Lena Okafor", email: "lena@partner.co", role: "Check-in staff" },
];

const PENDING = [
  { id: "p1", email: "sam@studio.io", role: "Co-host", sent: "2 days ago" },
  { id: "p2", email: "dani@crew.co", role: "Check-in staff", sent: "5 hours ago" },
];

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CoHostsAdminsSection({ event, headerItem }) {
  const [members, , saveMembers] = useEventConfig(event, "team", INITIAL_MEMBERS);
  const [pending, , savePending] = useEventConfig(
    event,
    "pendingInvites",
    PENDING,
  );
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "Co-host" });

  const sendInvite = () => {
    if (!invite.email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    savePending(
      [
        { id: `p${Date.now()}`, email: invite.email, role: invite.role, sent: "Just now" },
        ...pending,
      ],
      { successMsg: "Invitation sent." },
    );
    setInvite({ email: "", role: "Co-host" });
    setOpen(false);
  };

  const changeRole = (id, role) => {
    saveMembers(
      members.map((x) => (x.id === id ? { ...x, role } : x)),
      { successMsg: "Role updated." },
    );
  };

  const removeMember = (id) => {
    saveMembers(members.filter((x) => x.id !== id), {
      successMsg: "Member removed.",
    });
  };

  const columns = [
    {
      key: "name",
      header: "Member",
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className={`border text-xs font-medium ${(ROLE_STYLE[m.role] || FALLBACK_STYLE).avatar}`}
            >
              {initials(m.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{m.name}</p>
            <p className="text-xs text-text-secondary">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) => <RoleBadge role={m.role} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={m.role === "Owner"}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground disabled:opacity-30"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-border bg-surface-subtle text-foreground"
          >
            {ROLES.filter((r) => r.value !== "Owner" && r.value !== m.role).map(
              (r) => (
                <DropdownMenuItem
                  key={r.value}
                  className="focus:bg-surface-hover"
                  onClick={() => changeRole(m.id, r.value)}
                >
                  Make {r.value}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuSeparator className="bg-surface-hover" />
            <DropdownMenuItem
              variant="destructive"
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              onClick={() => removeMember(m.id)}
            >
              Remove from team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Co-hosts & Admins"}
        description={`${members.length} people have access to this workspace.`}
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Invite member
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={members}
        getRowKey={(m) => m.id}
      />

      {pending.length ? (
        <SectionCard title="Pending invitations">
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-subtle text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.email}
                  </p>
                  <p className="text-xs text-text-secondary">Invited {p.sent}</p>
                </div>
                <RoleBadge role={p.role} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  onClick={() =>
                    savePending(
                      pending.filter((x) => x.id !== p.id),
                      { successMsg: "Invitation revoked." },
                    )
                  }
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email to join this workspace with the role you pick.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Email address">
              <Input
                type="email"
                value={invite.email}
                onChange={(e) =>
                  setInvite((i) => ({ ...i, email: e.target.value }))
                }
                placeholder="teammate@example.com"
              />
            </Field>
            <Field label="Role">
              <Select
                value={invite.role}
                onValueChange={(v) => setInvite((i) => ({ ...i, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r.value !== "Owner").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              {ROLES.find((r) => r.value === invite.role)?.description}
            </p>
          </div>
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
              onClick={sendInvite}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
