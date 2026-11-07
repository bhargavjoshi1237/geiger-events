"use client";

import React, { useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";

import { Button, Input } from "@geiger/ui";
import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import {
  AREA_STYLES,
  CAPACITY_STYLES,
  DEFAULT_PLANNING_RULES,
  estimateAllStyles,
  formatDimensions,
  normalisePlanningRules,
  RULE_LIMITS,
  setupStyleLabel,
} from "@/lib/event_design";
import { CountInput, LengthInput, UnitToggle } from "../fields";
import { densityFromDisplay, densityToDisplay, formatPerPerson } from "./format";

// Project planning rules: space per person by style, aisles and clearances, row and table-edge spacing — with a live sample room.

const LENGTH_RULES = [
  { key: "mainAisleM", label: "Main & side aisles", hint: "Fire-route width between seating blocks and along walls." },
  { key: "tableClearanceM", label: "Between tables", hint: "Chair back to chair back between neighbouring tables." },
  { key: "exitClearanceM", label: "Exit clear zone", hint: "Kept free in front of every door and emergency exit." },
  { key: "featureClearanceM", label: "Service space", hint: "Around stages, bars, buffets and AV." },
  { key: "frontZoneM", label: "Front zone", hint: "Front wall or stage edge to the first row." },
];

const ROW_RULES = [
  { key: "rowSpacingM", label: "Theatre row pitch", hint: "Chair back to chair back." },
  { key: "seatPitchM", label: "Table edge per seat", hint: "Boardroom, U-shape and hollow square." },
  { key: "perimeterSetbackM", label: "Table to wall", hint: "Pulled-out chair plus a walkway behind it." },
];

function DensityInput({ value, unit, onChange }) {
  const shown = String(densityToDisplay(value, unit));
  const [draft, setDraft] = useState(shown);
  const [synced, setSynced] = useState(shown);
  if (shown !== synced) {
    setSynced(shown);
    setDraft(shown);
  }
  const [lo, hi] = RULE_LIMITS.areaPerPerson;
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const m2 = densityFromDisplay(text, unit);
          if (Number.isFinite(m2) && m2 >= lo && m2 <= hi) {
            setSynced(String(densityToDisplay(m2, unit)));
            onChange(m2);
          }
        }}
        onBlur={() => setDraft(shown)}
        className="pr-14 tabular-nums"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
        {unit === "ft" ? "sq ft" : "m²"}
      </span>
    </div>
  );
}

export function PlanningRulesForm({ rules, customised, sampleSpace, saving, onSave }) {
  const [unit, setUnit] = useState(sampleSpace?.unit === "ft" ? "ft" : "m");
  const [draft, setDraft] = useState(rules);
  const [base, setBase] = useState(rules);
  if (base !== rules) {
    setBase(rules);
    setDraft(rules);
  }
  const dirty = JSON.stringify(normalisePlanningRules(draft)) !== JSON.stringify(normalisePlanningRules(rules));
  const isDefault = JSON.stringify(normalisePlanningRules(draft)) === JSON.stringify(normalisePlanningRules(DEFAULT_PLANNING_RULES));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const sample = useMemo(() => {
    const w = Number(sampleSpace?.widthM) > 0 ? Number(sampleSpace.widthM) : 20;
    const l = Number(sampleSpace?.lengthM) > 0 ? Number(sampleSpace.lengthM) : 15;
    return { widthM: w, lengthM: l, outline: { type: "rect" }, objects: [] };
  }, [sampleSpace]);
  const estimates = useMemo(() => estimateAllStyles(sample, draft), [sample, draft]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <SectionCard
          title="Space per person"
          description="Planning density for each setup style, before aisles, exits and features come off."
          action={<UnitToggle value={unit} onChange={setUnit} />}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {AREA_STYLES.map((style) => (
              <Field
                key={style}
                label={setupStyleLabel(style)}
                hint={`Default ${formatPerPerson(DEFAULT_PLANNING_RULES.areaPerPerson[style], unit)}`}
              >
                <DensityInput
                  value={draft.areaPerPerson[style]}
                  unit={unit}
                  onChange={(m2) => set({ areaPerPerson: { ...draft.areaPerPerson, [style]: m2 } })}
                />
              </Field>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Aisles & clearances" description="Checked on every plan and kept clear by Generate layout.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {LENGTH_RULES.map((r) => (
              <Field key={r.key} label={r.label} hint={r.hint}>
                <LengthInput
                  metres={draft[r.key]}
                  unit={unit}
                  min={RULE_LIMITS[r.key][0]}
                  onChange={(m) => set({ [r.key]: Math.min(RULE_LIMITS[r.key][1], m) })}
                />
              </Field>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Rows & table edges">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ROW_RULES.map((r) => (
              <Field key={r.key} label={r.label} hint={r.hint}>
                <LengthInput
                  metres={draft[r.key]}
                  unit={unit}
                  min={RULE_LIMITS[r.key][0]}
                  onChange={(m) => set({ [r.key]: Math.min(RULE_LIMITS[r.key][1], m) })}
                />
              </Field>
            ))}
            <Field label="Seats between aisles" hint="Longest run in one row.">
              <CountInput
                value={draft.maxSeatsPerRow}
                min={RULE_LIMITS.maxSeatsPerRow[0]}
                max={RULE_LIMITS.maxSeatsPerRow[1]}
                onChange={(n) => set({ maxSeatsPerRow: n })}
              />
            </Field>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard
          title="Sample room"
          description={`${sampleSpace?.name || "A bare room"} · ${formatDimensions(sample.widthM, sample.lengthM, unit)}`}
        >
          <ul className="space-y-2">
            {CAPACITY_STYLES.map((style) => (
              <li key={style} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-secondary">{setupStyleLabel(style)}</span>
                <span className="font-medium tabular-nums text-foreground">{estimates[style].estimate || "—"}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            disabled={isDefault}
            onClick={() => setDraft(normalisePlanningRules(DEFAULT_PLANNING_RULES))}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!dirty || saving}
            onClick={() => onSave(normalisePlanningRules(draft))}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save rules
          </Button>
        </div>
        <p className="text-right text-xs text-text-tertiary">
          {customised ? "This project uses its own rules." : "Using the standard planning defaults."}
        </p>
      </div>
    </div>
  );
}

export default PlanningRulesForm;
