"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutTemplate, Plus, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useProject } from "@/context/project-context";
import {
  createTemplate,
  listTemplates,
  softDeleteTemplate,
  updateTemplate,
} from "../lib/programs";
import { formatRate, RATE_MODEL_OPTIONS } from "../lib/constants";

// Reusable program templates: a tier ladder plus rules that a new program is
// minted from. Copy-on-create — editing a template never reaches a program
// already built from it, which is what keeps per-event programs independent.

const EMPTY_DRAFT = { name: "", description: "" };

const DEFAULT_TIERS = [
  { name: "Standard", rank: 0, rateModel: "percent", rateValue: 10, thresholdSales: 0 },
];

export function ProgramTemplatesScreen() {
  const { projectId } = useProject();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    listTemplates(projectId).then((result) => {
      if (!alive) return;
      setRows(result ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    const tierCount = rows.reduce((s, r) => s + r.tiers.length, 0);
    return [
      { label: "Templates", value: String(rows.length) },
      { label: "Tiers defined", value: String(tierCount) },
    ];
  }, [rows]);

  const handleCreate = async () => {
    const name = draft.name.trim();
    if (!name) return toast.error("Give the template a name.");
    const optimistic = {
      id: crypto.randomUUID(),
      name,
      description: draft.description.trim(),
      rules: {},
      tiers: DEFAULT_TIERS,
    };
    setRows((prev) => [optimistic, ...prev]);
    const created = await createTemplate(projectId, optimistic);
    if (created) {
      setRows((prev) => prev.map((r) => (r.id === created.id ? created : r)));
      setDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      toast.success("Template created");
    } else {
      setRows((prev) => prev.filter((r) => r.id !== optimistic.id));
      toast.error("Couldn't create that template.");
    }
  };

  // Templates store their ladder as a jsonb array, so a tier edit is a whole-
  // array write — there are no child rows to reconcile.
  const saveTiers = async (template, tiers) => {
    const previous = template.tiers;
    setRows((prev) =>
      prev.map((r) => (r.id === template.id ? { ...r, tiers } : r)),
    );
    const saved = await updateTemplate(template.id, { tiers });
    if (!saved) {
      setRows((prev) =>
        prev.map((r) => (r.id === template.id ? { ...r, tiers: previous } : r)),
      );
      toast.error("Couldn't save the ladder.");
    }
  };

  const handleDelete = async (template) => {
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== template.id));
    const ok = await softDeleteTemplate(template.id);
    if (ok) toast.success("Template deleted");
    else {
      setRows(snapshot);
      toast.error("Couldn't delete that template.");
    }
  };

  const createButton = (
    <Button
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="mr-2 h-4 w-4" />
      New template
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Program templates"
        description="A saved tier ladder and rule set. Creating a program from one copies it — the program then evolves on its own."
        actions={createButton}
      />

      <StatsBar stats={stats} columns={2} />

      <Toolbar>
        <span className="text-sm text-text-secondary">
          {filtered.length} template{filtered.length === 1 ? "" : "s"}
        </span>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates"
        />
      </Toolbar>

      {loading ? (
        <LoadingArea />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={rows.length === 0 ? "No templates yet" : "No matching templates"}
          description={
            rows.length === 0
              ? "Save a ladder you'd reuse across events so you don't rebuild it every time."
              : "No template matches that search."
          }
          action={rows.length === 0 ? createButton : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((template) => (
            <SectionCard
              key={template.id}
              title={template.name}
              description={template.description || "No description."}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      saveTiers(template, [
                        ...template.tiers,
                        {
                          name: `Tier ${template.tiers.length + 1}`,
                          rank: template.tiers.length,
                          rateModel: "percent",
                          rateValue: 10,
                          thresholdSales: 0,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add tier
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${template.name}`}
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              }
            >
              {template.tiers.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No tiers yet — a program made from this template would pay
                  nothing until you add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {template.tiers.map((tier, index) => (
                    <div
                      // Ladder position is the identity here: template tiers are
                      // plain jsonb, with no id of their own.
                      key={`${template.id}-${index}`}
                      className="grid items-end gap-3 rounded-lg border border-border bg-surface-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
                    >
                      <Field label="Name">
                        <Input
                          defaultValue={tier.name}
                          onBlur={(e) =>
                            saveTiers(
                              template,
                              template.tiers.map((t, i) =>
                                i === index ? { ...t, name: e.target.value } : t,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Model">
                        <Select
                          value={tier.rateModel}
                          onValueChange={(v) =>
                            saveTiers(
                              template,
                              template.tiers.map((t, i) =>
                                i === index ? { ...t, rateModel: v } : t,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="border-border bg-surface-subtle">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle">
                            {RATE_MODEL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Rate">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={tier.rateValue}
                          onBlur={(e) =>
                            saveTiers(
                              template,
                              template.tiers.map((t, i) =>
                                i === index
                                  ? { ...t, rateValue: Number(e.target.value) || 0 }
                                  : t,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Sales to reach">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={tier.thresholdSales}
                          onBlur={(e) =>
                            saveTiers(
                              template,
                              template.tiers.map((t, i) =>
                                i === index
                                  ? {
                                      ...t,
                                      thresholdSales: Number(e.target.value) || 0,
                                    }
                                  : t,
                              ),
                            )
                          }
                        />
                      </Field>
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-xs text-text-tertiary">
                          {formatRate(tier.rateModel, tier.rateValue)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${tier.name}`}
                          className="text-red-400 hover:bg-red-500/10"
                          onClick={() =>
                            saveTiers(
                              template,
                              template.tiers.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New program template</DialogTitle>
            <DialogDescription>
              Starts with one 10% tier. Adjust the ladder after creating it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Standard club night"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                rows={3}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleCreate}
            >
              Create template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ProgramTemplatesScreen;
