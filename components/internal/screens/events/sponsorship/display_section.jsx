"use client";

import React from "react";
import {
  AlignCenter,
  AlignLeft,
  Eye,
  Layers,
  LayoutGrid,
  Loader2,
  Palette,
  Contrast,
  Square,
  SquareDashed,
} from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  DEFAULT_SPONSORS_DISPLAY,
  SPONSOR_ALIGNS,
  SPONSOR_CARD_STYLES,
  SPONSOR_COLUMNS,
  SPONSOR_CTA_STYLES,
  SPONSOR_CTA_TARGETS,
  SPONSOR_GROUPINGS,
  SPONSOR_LAYOUTS,
  SPONSOR_LOGO_SIZES,
  SPONSOR_LOGO_STYLES,
  newFill,
  newSpot,
  normalizeSponsorshipPage,
  resolveSponsorsDisplay,
  sponsorGroups,
} from "@/lib/events/sponsorship";
import { Segmented, withIcons } from "../theme_controls";
import { usePageTheme } from "../public_page/use_page_theme";
import { SponsorsBlock } from "./sponsors_block";

const GROUPING_OPTIONS = withIcons(SPONSOR_GROUPINGS, { spot: Layers, flat: LayoutGrid });
const CARD_OPTIONS = withIcons(SPONSOR_CARD_STYLES, { plain: SquareDashed, card: Square });
const ALIGN_OPTIONS = withIcons(SPONSOR_ALIGNS, { left: AlignLeft, center: AlignCenter });
const LOGO_STYLE_OPTIONS = withIcons(SPONSOR_LOGO_STYLES, { color: Palette, muted: Contrast });

// Grey wordmarks, so the preview reads as logos in both themes before any real sponsor exists.
const wordmark = (text) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><text x="110" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#8a8a8a">${text}</text></svg>`,
  )}`;

const sampleFill = (name) =>
  newFill({ sponsor: { name, logoUrl: wordmark(name), website: "", description: "Sample sponsor for the preview." } });

const SAMPLE_SPONSORSHIP = {
  spots: [
    newSpot({ name: "Headline partner", fills: [sampleFill("Northwind")] }),
    newSpot({ name: "Gold", quantity: 3, fills: [sampleFill("Contoso"), sampleFill("Fabrikam"), sampleFill("Tailspin")] }),
    newSpot({ name: "Community", quantity: 2, fills: [sampleFill("Litware"), sampleFill("Adatum")] }),
  ],
};

function StripControls({ display, set }) {
  const isGrid = display.layout === "grid";
  const isMarquee = display.layout === "marquee";
  return (
    <SectionCard title="Sponsor strip" description="How confirmed sponsors appear on the event page.">
      <div className="grid gap-5">
        <Field label="Heading" hint="Blank hides the heading" htmlFor="sponsordisplay-heading">
          <Input
            id="sponsordisplay-heading"
            value={display.heading}
            onChange={(e) => set("heading")(e.target.value)}
            placeholder="Our sponsors"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Layout" hint="Scrolling runs the logos in a continuous band.">
            <Segmented value={display.layout} onChange={set("layout")} options={SPONSOR_LAYOUTS} />
          </Field>
          {!isMarquee ? (
            <Field label="Grouping" hint="By spot adds a label above each spot's sponsors.">
              <Segmented value={display.grouping} onChange={set("grouping")} options={GROUPING_OPTIONS} />
            </Field>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Logo size">
            <Segmented value={display.logoSize} onChange={set("logoSize")} options={SPONSOR_LOGO_SIZES} />
          </Field>
          <Field label="Logo colour" hint="Muted logos turn to colour on hover.">
            <Segmented value={display.logoStyle} onChange={set("logoStyle")} options={LOGO_STYLE_OPTIONS} />
          </Field>
        </div>

        {!isMarquee ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {isGrid ? (
              <Field label="Columns" hint="At desktop width; smaller screens step down.">
                <Segmented value={display.columns} onChange={set("columns")} options={SPONSOR_COLUMNS} />
              </Field>
            ) : null}
            {isGrid || display.layout === "list" ? (
              <Field label="Card style">
                <Segmented value={display.cardStyle} onChange={set("cardStyle")} options={CARD_OPTIONS} />
              </Field>
            ) : null}
            {display.layout !== "list" ? (
              <Field label="Alignment">
                <Segmented value={display.align} onChange={set("align")} options={ALIGN_OPTIONS} />
              </Field>
            ) : null}
          </div>
        ) : null}

        <SettingsList>
          {display.grouping === "spot" && !isMarquee ? (
            <SettingRow
              title="Feature the top spot"
              description="Your first spot's logos show a size larger. Reorder spots in Sponsor Spots."
              checked={display.featureTop}
              onCheckedChange={set("featureTop")}
            />
          ) : null}
          <SettingRow
            title="Show sponsor names"
            description="The company name under each logo."
            checked={display.showNames}
            onCheckedChange={set("showNames")}
          />
          <SettingRow
            title="Show spot names"
            description="Which spot each sponsor holds — e.g. “Gold”."
            checked={display.showSpotLabels}
            onCheckedChange={set("showSpotLabels")}
          />
          <SettingRow
            title="Link to sponsors' websites"
            description="Logos open the sponsor's site in a new tab."
            checked={display.linkLogos}
            onCheckedChange={set("linkLogos")}
          />
          <SettingRow
            title="Include pending sponsors"
            description="Show deals that are agreed but not yet settled."
            checked={display.includePending}
            onCheckedChange={set("includePending")}
          />
        </SettingsList>
      </div>
    </SectionCard>
  );
}

function CtaControls({ event, cta, setCta, onNavigate }) {
  const page = normalizeSponsorshipPage(event?.sponsorshipPage);
  const unreachable =
    cta.target === "page" && !page.enabled
      ? "Your sponsorship page is off, so this stays hidden until you publish it."
      : cta.target === "contact" && !page.contactEmail
        ? "Add a contact email on the Sponsor Page, or this stays hidden."
        : cta.target === "custom" && !cta.url.trim()
          ? "Add a link, or this stays hidden."
          : null;

  return (
    <SectionCard
      title="Become a sponsor"
      description="Point interested companies from your event page to where they can talk to you."
    >
      <div className="grid gap-5">
        <SettingsList>
          <SettingRow
            title="Show a “become a sponsor” link"
            description="Sits under the sponsor strip."
            checked={cta.enabled}
            onCheckedChange={setCta("enabled")}
          />
        </SettingsList>

        {cta.enabled ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Style">
                <Segmented value={cta.style} onChange={setCta("style")} options={SPONSOR_CTA_STYLES} />
              </Field>
              <Field label="Goes to">
                <Segmented value={cta.target} onChange={setCta("target")} options={SPONSOR_CTA_TARGETS} />
              </Field>
            </div>

            {unreachable ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
                <p className="min-w-0 flex-1 text-xs text-amber-400">{unreachable}</p>
                {cta.target !== "custom" && onNavigate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("sponsorpage")}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    Open Sponsor Page
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Label" htmlFor="sponsorcta-label">
                <Input
                  id="sponsorcta-label"
                  value={cta.label}
                  onChange={(e) => setCta("label")(e.target.value)}
                  placeholder="Become a sponsor"
                />
              </Field>
              {cta.target === "custom" ? (
                <Field label="Link" htmlFor="sponsorcta-url">
                  <Input
                    id="sponsorcta-url"
                    value={cta.url}
                    onChange={(e) => setCta("url")(e.target.value)}
                    placeholder="example.com/sponsor-deck.pdf"
                  />
                </Field>
              ) : null}
            </div>

            {cta.style === "banner" ? (
              <div className="grid gap-5">
                <Field label="Banner heading" htmlFor="sponsorcta-heading">
                  <Input
                    id="sponsorcta-heading"
                    value={cta.heading}
                    onChange={(e) => setCta("heading")(e.target.value)}
                  />
                </Field>
                <Field label="Banner text" htmlFor="sponsorcta-body">
                  <Textarea
                    id="sponsorcta-body"
                    rows={2}
                    value={cta.body}
                    onChange={(e) => setCta("body")(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <SettingsList>
              <SettingRow
                title="Show before any sponsor signs"
                description="Lets an event with no sponsors yet still invite them."
                checked={cta.showWhenEmpty}
                onCheckedChange={setCta("showWhenEmpty")}
              />
            </SettingsList>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}

export function EventSponsorDisplaySection({ event, headerItem, onPatch, onNavigate }) {
  const [raw, setRaw, saveRaw, saving] = useEventConfig(event, "sponsorsDisplay", DEFAULT_SPONSORS_DISPLAY, onPatch);
  const display = resolveSponsorsDisplay(raw);
  const { accent } = usePageTheme({ design: event?.pageDesign, live: false });

  const set = (key) => (value) => setRaw({ ...display, [key]: value });
  const setCta = (key) => (value) => setRaw({ ...display, cta: { ...display.cta, [key]: value } });

  const hasReal = sponsorGroups(event, { ...display, includePending: true }).length > 0;
  const previewEvent = hasReal ? event : { ...event, sponsorship: SAMPLE_SPONSORSHIP };
  const previewDisplay = hasReal ? display : { ...display, includePending: true };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Sponsor Display"}
        description={
          headerItem?.desc ||
          "How sponsors appear on your event page, and whether it invites new ones."
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setRaw(DEFAULT_SPONSORS_DISPLAY)}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              Reset
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={() => saveRaw(undefined, { successMsg: "Sponsor display saved." })}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save display"}
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-surface-subtle p-5">
        <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Eye className="h-3.5 w-3.5" /> Preview{hasReal ? "" : " · sample sponsors until you fill a spot"}
        </p>
        <SponsorsBlock event={previewEvent} accent={accent} display={previewDisplay} />
      </div>

      <StripControls display={display} set={set} />
      <CtaControls event={event} cta={display.cta} setCta={setCta} onNavigate={onNavigate} />

      <p className="text-xs text-text-tertiary">
        Standard pages show the Sponsors section automatically. On a customised layout, add the Sponsors block from Design.
      </p>
    </div>
  );
}

export default EventSponsorDisplaySection;
