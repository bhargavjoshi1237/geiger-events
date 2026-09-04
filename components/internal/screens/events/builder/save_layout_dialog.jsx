"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useOptionalProject } from "@/context/project-context";
import { createLayout } from "@/lib/supabase/page_layouts";
import { getUser } from "@/lib/supabase/user";
import { treeStats } from "@/lib/events/page_tree";

// Keeps the arrangement, not the copy: the tree and the theme it was designed
// against, saved to the project so the next event can start from it.
export function SaveLayoutDialog({ open, onOpenChange, tree, theme, defaultName }) {
  const project = useOptionalProject();
  const projectId = project?.projectId || null;

  // Remounted per opening by the caller's key, so the initialisers below are
  // the reset — no effect needed to clear the form.
  const [name, setName] = useState(defaultName ? `${defaultName} layout` : "");
  const [description, setDescription] = useState("");
  const [userId, setUserId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, []);

  const stats = treeStats(tree);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the layout a name.");
      return;
    }
    setSaving(true);
    const row = await createLayout({
      projectId,
      name: trimmed,
      description: description.trim(),
      category: "Saved",
      tree,
      theme,
      createdBy: userId,
    });
    setSaving(false);
    if (!row) {
      toast.error("Couldn't save the layout.");
      return;
    }
    toast.success(`"${row.name}" saved to this project`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as layout</DialogTitle>
          <DialogDescription>
            {projectId
              ? `Saves this arrangement — ${stats.sections} section${stats.sections === 1 ? "" : "s"}, ${stats.components} block${stats.components === 1 ? "" : "s"} — so any event in this project can start from it.`
              : "Saved layouts need a project. Open this page from inside a project to save it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">Name</span>
            <Input
              value={name}
              autoFocus
              placeholder="e.g. Two-day conference"
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-card"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Description
            </span>
            <Textarea
              value={description}
              rows={3}
              placeholder="What this arrangement is for, and when to reach for it."
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface-card"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || !projectId}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveLayoutDialog;
