"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, IdCard, Info, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { LanyardBadge } from "@/components/internal/shared/lanyard/lanyard_badge";
import { Button } from "@geiger/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useEventConfig } from "@/lib/events/use-event-config";
import { getCheckinSettings } from "@/lib/supabase/checkin";
import { SAMPLE_ATTENDEE } from "@/lib/passes/attendees";
import { withSides } from "@/lib/passes/layout";
import { resolveTemplate } from "@/lib/passes/render";
import { withDefaults } from "../checkin/constants";

const DESIGNER_TAB = "Badge Printing";

const PROJECT_DEFAULT = "default";

const DEFAULT_BADGE = { enabled: false, templateId: "" };

function useProjectPassDesigns(active) {
  const { projectId } = useProject();
  const [state, setState] = useState({
    templates: [],
    qrSettings: {},
    loading: true,
  });

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    getCheckinSettings(projectId).then((settings) => {
      if (!alive) return;
      const config = settings?.config || {};
      const templates = (withDefaults(config, "badge").templates || []).map(withSides);
      setState({
        templates,
        qrSettings: withDefaults(config, "qrTickets"),
        loading: false,
      });
    });
    return () => {
      alive = false;
    };
  }, [projectId, active]);

  return state;
}

export function useEventPass(event, override) {
  const badge = override || event?.badge || DEFAULT_BADGE;
  const enabled = Boolean(badge.enabled);
  const { templates, qrSettings, loading } = useProjectPassDesigns(enabled);

  const template = useMemo(() => {
    if (!templates.length) return null;
    return (
      templates.find((t) => t.id === badge.templateId) ||
      resolveTemplate(templates, "", "")
    );
  }, [templates, badge.templateId]);

  return { enabled, template, templates, qrSettings, loading: enabled && loading };
}

export function PassShowcasePanel({
  event,
  template,
  qrSettings,
  title = "Attendee pass",
  description = "The pass this event prints. Drag it to swing it.",
  action,
  height = 360,
  className,
}) {
  if (!template) return null;

  return (
    <SectionCard
      bare
      title={title}
      description={description}
      action={action}
      className={className}
    >
      <LanyardBadge
        template={template}
        event={event}
        attendee={SAMPLE_ATTENDEE}
        qrSettings={qrSettings}
        height={height}
      />
    </SectionCard>
  );
}

export function EventPassShowcase({ event, badge, ...panel }) {
  const { enabled, template, qrSettings, loading } = useEventPass(event, badge);
  if (loading || !enabled) return null;
  return (
    <PassShowcasePanel
      event={event}
      template={template}
      qrSettings={qrSettings}
      {...panel}
    />
  );
}

export function EventBadgeSection({ event, headerItem }) {
  const { openEventInTab } = useWorkspaceUrl();
  const [cfg, , save] = useEventConfig(event, "badge", DEFAULT_BADGE);
  const { template, templates, qrSettings, loading } = useEventPass(event, cfg);

  const openDesigner = () => openEventInTab(event.id, DESIGNER_TAB);

  const setEnabled = (enabled) =>
    save(
      { ...cfg, enabled },
      { successMsg: enabled ? "Badges on for this event." : "Badges off for this event." },
    );

  const setTemplate = (value) =>
    save(
      { ...cfg, templateId: value === PROJECT_DEFAULT ? "" : value },
      { successMsg: "Pass design updated." },
    );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Badge printing"}
        description={
          headerItem?.desc ||
          "Print attendee passes for this event and choose the design they print on."
        }
        action={
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            disabled={!cfg.enabled}
            onClick={openDesigner}
          >
            <IdCard className="h-4 w-4" /> Edit badge
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <SectionCard
        title="Attendee badges"
        description="Whether this event's attendees get a printed pass, and which of the project's designs it uses."
      >
        <SettingsList>
          <SettingRow
            title="Print badges for this event"
            description="Adds this event to Badge Printing and shows its pass across the editor."
            checked={Boolean(cfg.enabled)}
            onCheckedChange={setEnabled}
          />
        </SettingsList>

        {cfg.enabled ? (
          <div className="mt-4 border-t border-border pt-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading pass designs…
              </div>
            ) : templates.length ? (
              <Field
                label="Pass design"
                hint="A design bound to a ticket tier or a role still wins for the attendees it matches."
              >
                <Select
                  value={cfg.templateId || PROJECT_DEFAULT}
                  onValueChange={setTemplate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_DEFAULT}>Project default</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
                <Info className="h-4 w-4 shrink-0 text-text-tertiary" />
                <p className="min-w-0 flex-1 text-sm text-text-secondary">
                  This project has no pass designs yet — create one in Badge
                  Printing and it becomes available here.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openDesigner}
                  className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  Open {DESIGNER_TAB}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </SectionCard>

      {cfg.enabled ? (
        <PassShowcasePanel
          event={event}
          template={template}
          qrSettings={qrSettings}
          description="How the pass hangs at the door. Drag it to swing it, or flick it sideways to see the back."
          height={420}
        />
      ) : null}
    </div>
  );
}

export default EventBadgeSection;
