"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@geiger/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { useProject } from "@/context/project-context";
import { CreateProjectDialog } from "./create_project_dialog";

export function ProjectSwitcher() {
  const { project, projects, loading, setActiveProject } = useProject();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
            <span className="truncate max-w-[140px] md:max-w-[200px]">
              {loading ? "Loading…" : project?.name || "Select project"}
            </span>
            {!loading ? (
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : null}
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
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground">No projects yet.</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-surface-active hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
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

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export default ProjectSwitcher;
