"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Armchair, Loader2, MoreHorizontal, Plus } from "lucide-react";

import {
  EmptyState,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  createSeatMap,
  listSeatMaps,
  softDeleteSeatMap,
  updateSeatMap,
} from "@/lib/supabase/seat_maps";

import { SeatMapEditor } from "./seat_map_editor";

// Seat map configurations for a venue. A venue has several (end-stage concert,
// in-the-round, banquet rounds); an event picks one, so a recurring room builds
// its map once and reuses it forever.

const SEAT_MAP_STATUS_MAP = {
  Draft: { label: "Draft", variant: "muted", dotClass: "bg-text-tertiary" },
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Archived: { label: "Archived", variant: "muted", dotClass: "bg-text-tertiary" },
};

const STATUS_OPTIONS = Object.keys(SEAT_MAP_STATUS_MAP);

function CreateDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState({ name: "", status: "Draft" });

  const close = (next) => {
    if (!next) setDraft({ name: "", status: "Draft" });
    onOpenChange(next);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the configuration a name first.");
      return;
    }
    onCreate(draft);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <Armchair className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">New configuration</DialogTitle>
            <DialogDescription className="text-xs">
              One layout of this room — you can build several and pick one per event.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 p-5">
            <Field label="Name">
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. End-stage concert"
              />
            </Field>
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SeatMapsSection({ venue }) {
  const projectId = useOptionalProject()?.projectId ?? null;
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  // Bumping the token re-runs the fetch effect; handlers use it to reconcile
  // after a failed write rather than calling the loader directly.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    if (!venue?.id) return undefined;
    let alive = true;
    listSeatMaps(venue.id).then((rows) => {
      if (!alive) return;
      setMaps(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [venue?.id, reloadToken]);

  const openMap = useMemo(() => maps.find((m) => m.id === openId) || null, [maps, openId]);

  const handleCreate = async (draft) => {
    const optimistic = {
      id: crypto.randomUUID(),
      venueId: venue.id,
      projectId,
      name: draft.name.trim(),
      status: draft.status,
      config: {},
      createdBy: userId,
    };
    setMaps((prev) => [optimistic, ...prev]);
    const created = await createSeatMap(optimistic);
    if (!created) {
      setMaps((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Couldn't create the configuration.");
      return;
    }
    setMaps((prev) => prev.map((m) => (m.id === created.id ? created : m)));
    toast.success("Configuration created.");
    setOpenId(created.id);
  };

  const handleStatus = (map, status) => {
    setMaps((prev) => prev.map((m) => (m.id === map.id ? { ...m, status } : m)));
    updateSeatMap(map.id, { status }).then((row) => {
      if (!row) toast.error("Couldn't update the status.");
    });
  };

  const handleDelete = async (map) => {
    setMaps((prev) => prev.filter((m) => m.id !== map.id));
    const ok = await softDeleteSeatMap(map.id);
    if (!ok) {
      toast.error("Couldn't delete the configuration.");
      reload();
      return;
    }
    toast.success("Configuration deleted.");
  };

  if (openMap) {
    return <SeatMapEditor mapId={openMap.id} onBack={() => setOpenId(null)} />;
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <SectionCard
      title="Seat map configurations"
      description="Build the room once, then attach a configuration to any event held here."
      action={
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> New configuration
        </Button>
      }
    >
      {maps.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="No seat maps yet"
          description="Add a configuration to lay out sections, rows and seats for this venue."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" /> New configuration
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {maps.map((map) => (
            <li key={map.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => setOpenId(map.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-foreground">
                  {map.name || "Untitled configuration"}
                </span>
                <span className="mt-0.5 block text-xs text-text-secondary">
                  Open the floor editor
                </span>
              </button>
              <StatusPill status={map.status} map={SEAT_MAP_STATUS_MAP} />
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      aria-label={`Actions for ${map.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-border bg-surface-subtle">
                    <DropdownMenuItem onClick={() => setOpenId(map.id)}>
                      Open editor
                    </DropdownMenuItem>
                    {STATUS_OPTIONS.filter((s) => s !== map.status).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => handleStatus(map, s)}>
                        Mark {s.toLowerCase()}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                      onClick={() => handleDelete(map)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </SectionCard>
  );
}

export default SeatMapsSection;
