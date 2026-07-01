"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";

// Active-project selector for the topbar. Lists the projects the signed-in user
// can reach (org membership, enforced by RLS) and switches the whole workspace
// to the one they pick via the ?project= URL param. Also creates a new project
// (bootstrapping an org if needed).
export function ProjectSwitcher() {
  const { project, projects, loading, setActiveProject, createProject } =
    useProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Give your project a name.");
      return;
    }
    setSaving(true);
    const created = await createProject(name);
    setSaving(false);
    if (created) {
      toast.success(`Switched to "${created.name}".`);
      setName("");
      setCreateOpen(false);
    } else {
      toast.error("Couldn't create the project.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            <span className="truncate max-w-[140px] md:max-w-[200px]">
              {loading
                ? "Loading…"
                : project?.name || "Select project"}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60 border-border bg-surface-subtle shadow-xl"
        >
          <DropdownMenuLabel className="text-text-tertiary">
            Projects
          </DropdownMenuLabel>
          {projects.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => setActiveProject(p.id)}
              >
                <Check
                  className={`h-4 w-4 ${
                    p.id === project?.id ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="bg-surface-strong" />
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              A project scopes its events, tickets, registrations, and
              automations. You&apos;ll be switched to it once created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Project name" htmlFor="project-name">
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Events"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) submit();
                }}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProjectSwitcher;
