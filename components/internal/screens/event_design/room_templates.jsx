"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Copy, LayoutTemplate, Pencil, Plus, SquarePen, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, ScreenHeader, SearchInput, StatsBar, Toolbar } from "@/components/internal/shared/screen_kit";
import { Badge, Button, LogoLoading } from "@geiger/ui";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { getUser } from "@/lib/supabase/user";
import { copyFloorPlan, listFloorPlans, softDeleteFloorPlan, updateFloorPlan } from "@/lib/supabase/floor_plans";
import { planSummary, setupStyleLabel } from "@/lib/event_design";
import { FloorPlanEditor } from "./editor/plan_editor";
import { NewPlanDialog } from "./dialogs/new_plan_dialog";
import { ConfirmDeleteDialog, SaveAsDialog } from "./dialogs/plan_dialogs";
import { PlanCard } from "./plan_card";
import { createPlanFrom } from "./create_plan";
import { useDesignContext } from "./use_design_context";
import { GALLERY_GRID, SETUP_STYLE_FILTER_OPTIONS } from "./constants";

// Room Templates: reusable layouts (floor_plans kind "template"), grouped by category; any plan can start from one.

const UNCATEGORISED = "Uncategorised";

export function RoomTemplatesScreen() {
  const { projectId } = useProject();
  const { recordId, openRecord, closeRecord } = useWorkspaceUrl();
  const ctx = useDesignContext(projectId);
  const [templates, setTemplates] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [style, setStyle] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [useTarget, setUseTarget] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listFloorPlans(projectId, { kind: "template" }), listFloorPlans(projectId, { kind: "plan" })]).then(
      ([tmpl, rows]) => {
        if (!alive) return;
        setTemplates(tmpl ?? []);
        setPlans(rows ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const uses = useMemo(() => {
    const map = new Map();
    plans.forEach((p) => p.sourcePlanId && map.set(p.sourcePlanId, (map.get(p.sourcePlanId) || 0) + 1));
    return map;
  }, [plans]);

  const categories = useMemo(
    () => [...new Set(templates.map((t) => t.templateCategory || UNCATEGORISED))].sort(),
    [templates],
  );

  const stats = useMemo(() => {
    const top = templates.reduce((best, t) => ((uses.get(t.id) || 0) > (best ? uses.get(best.id) || 0 : 0) ? t : best), null);
    const fromTemplates = templates.reduce((n, t) => n + (uses.get(t.id) || 0), 0);
    return [
      { label: "Templates", value: String(templates.length), footer: "Reusable layouts" },
      { label: "Categories", value: String(categories.length), footer: "Weddings, galas, meetings…" },
      { label: "Plans started", value: String(fromTemplates), footer: "From a template" },
      { label: "Most used", value: top ? String(uses.get(top.id)) : "—", footer: top ? top.name : "Not used yet" },
    ];
  }, [templates, categories, uses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && (t.templateCategory || UNCATEGORISED) !== category) return false;
      if (style !== "all" && t.setupStyle !== style) return false;
      if (q && !`${t.name} ${t.templateCategory} ${t.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, category, style]);

  const groups = useMemo(() => {
    const names = [...new Set(filtered.map((t) => t.templateCategory || UNCATEGORISED))].sort();
    return names.map((name) => ({ name, items: filtered.filter((t) => (t.templateCategory || UNCATEGORISED) === name) }));
  }, [filtered]);

  const replaceTemplate = (next) => setTemplates((prev) => prev.map((t) => (t.id === next.id ? next : t)));

  const createTemplate = async (input) => {
    const created = await createPlanFrom(input, { projectId, kind: "template" });
    if (!created) {
      toast.error("Couldn't create the template.");
      return false;
    }
    setTemplates((prev) => [created, ...prev]);
    toast.success("Template created — lay it out.");
    openRecord(created.id);
    return true;
  };

  const startPlan = async (input) => {
    const created = await createPlanFrom(input, { projectId, kind: "plan" });
    if (!created) {
      toast.error("Couldn't create the plan.");
      return false;
    }
    setPlans((prev) => [created, ...prev]);
    if (input.outsideCount) {
      toast.warning(`Plan created — ${input.outsideCount} object${input.outsideCount === 1 ? "" : "s"} fall outside the new room.`);
    } else {
      toast.success("Plan created — it's in Floor Plans.");
    }
    openRecord(created.id);
    return true;
  };

  const duplicate = async (t) => {
    const user = await getUser();
    const copy = await copyFloorPlan(t, { name: `${t.name} (copy)`, kind: "template", createdBy: user?.id ?? null });
    if (!copy) {
      toast.error("Couldn't duplicate the template.");
      return;
    }
    setTemplates((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${t.name}".`);
  };

  const saveDetails = async ({ name, templateCategory }) => {
    const saved = await updateFloorPlan(detailsTarget.id, { name, templateCategory });
    if (!saved) {
      toast.error("Couldn't save the template.");
      return false;
    }
    replaceTemplate({ ...detailsTarget, name: saved.name, templateCategory: saved.templateCategory });
    toast.success("Template updated.");
    return true;
  };

  const remove = async (t) => {
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    const ok = await softDeleteFloorPlan(t.id);
    if (!ok) {
      setTemplates((prev) => [t, ...prev]);
      toast.error("Couldn't delete the template.");
      return;
    }
    toast.success(`Deleted "${t.name}".`);
  };

  if (recordId) {
    return (
      <FloorPlanEditor
        planId={recordId}
        onBack={closeRecord}
        backLabel="Room Templates"
        onSaved={(p) => (p.kind === "template" ? replaceTemplate(p) : null)}
      />
    );
  }

  const categoryOptions = [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))];
  const hasFilters = search || category !== "all" || style !== "all";

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Room Templates"
        description="Layouts you set up once — a 20-round gala, a classroom, a boardroom — and drop into any room."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown value={category} onValueChange={setCategory} options={categoryOptions} height="h-9" />
          <FilterDropdown value={style} onValueChange={setStyle} options={SETUP_STYLE_FILTER_OPTIONS} height="h-9" />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={48} aria-label="Loading templates" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutTemplate}
            title={templates.length ? "No templates match your filters" : "No room templates yet"}
            description={
              templates.length
                ? "Try clearing the search or filters."
                : "Create one here, or open any floor plan and choose Save as template."
            }
            action={
              templates.length && hasFilters ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setStyle("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" /> New template
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.name} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {group.name} <span className="font-normal text-text-tertiary">· {group.items.length}</span>
              </h2>
              <div className={GALLERY_GRID}>
                {group.items.map((t) => {
                  const used = uses.get(t.id) || 0;
                  const seats = planSummary(t).seats;
                  return (
                    <PlanCard
                      key={t.id}
                      plan={t}
                      showStatus={false}
                      subtitle={`${setupStyleLabel(t.setupStyle)} · ${seats} seat${seats === 1 ? "" : "s"}`}
                      onOpen={() => openRecord(t.id)}
                      badges={<Badge variant="neutral">{used ? `Used by ${used} plan${used === 1 ? "" : "s"}` : "Not used yet"}</Badge>}
                      footerAction={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={() => setUseTarget(t)}
                        >
                          New plan <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      }
                      actions={[
                        { icon: ArrowUpRight, label: "New plan from template", onSelect: () => setUseTarget(t) },
                        { icon: SquarePen, label: "Edit layout", onSelect: () => openRecord(t.id) },
                        { icon: Pencil, label: "Rename / category", onSelect: () => setDetailsTarget(t) },
                        { icon: Copy, label: "Duplicate", onSelect: () => duplicate(t) },
                        { separator: true },
                        { icon: Trash2, label: "Delete", destructive: true, onSelect: () => setDeleteTarget(t) },
                      ]}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <NewPlanDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        ctx={ctx}
        projectId={projectId}
        templates={templates}
        kind="template"
        title="New room template"
        description="Set the room size and style, then lay out the template in the editor."
        submitLabel="Create template"
        onCreate={createTemplate}
      />

      <NewPlanDialog
        open={!!useTarget}
        onOpenChange={(o) => !o && setUseTarget(null)}
        ctx={ctx}
        projectId={projectId}
        templates={templates}
        initial={{ source: "template", templateId: useTarget?.id, name: useTarget?.name }}
        title="New plan from template"
        description="Pick the room it goes in. Objects keep their positions; anything that no longer fits is flagged."
        onCreate={startPlan}
      />

      <SaveAsDialog
        open={!!detailsTarget}
        onOpenChange={(o) => !o && setDetailsTarget(null)}
        mode="template"
        initial={detailsTarget}
        ctx={ctx}
        projectId={projectId}
        title="Template details"
        description="Rename it or file it under another category."
        submitLabel="Save"
        onSubmit={saveDetails}
      />

      <ConfirmDeleteDialog
        target={deleteTarget}
        title="Delete template"
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={remove}
      >
        Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Plans already started from it
        are not affected.
      </ConfirmDeleteDialog>
    </MainScreenWrapper>
  );
}

export default RoomTemplatesScreen;
