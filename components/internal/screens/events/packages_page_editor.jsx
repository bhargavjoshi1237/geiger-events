"use client";

import React from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  EMPTY_PACKAGES_PAGE,
  normalizePackagesPage,
} from "@/lib/events/packages";
import { listPackageEnquiries } from "@/lib/supabase/package_enquiries";
import { PageDesignSection, defaultPageDesign } from "./page_design";

function PackageEnquiries({ eventId }) {
  const [rows, setRows] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    if (!eventId) return undefined;
    listPackageEnquiries(eventId).then((res) => {
      if (alive) setRows(res || []);
    });
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <SectionCard
      title="Enquiries"
      description={
        rows === null
          ? undefined
          : rows.length
            ? `${rows.length} received.`
            : "Nothing yet. Submissions from the form above land here."
      }
    >
      {rows === null ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading enquiries…
        </div>
      ) : rows?.length ? (
        <div className="space-y-2">
          {rows.slice(0, 20).map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-foreground">
                  {[row.firstName, row.lastName].filter(Boolean).join(" ") ||
                    "Someone"}
                </span>
                <a
                  href={`mailto:${row.email}`}
                  className="text-xs text-text-secondary underline"
                >
                  {row.email}
                </a>
                {row.phone ? (
                  <span className="text-xs text-text-tertiary">{row.phone}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {[
                  row.packageName || "Any package",
                  row.quantity ? `${row.quantity} tickets` : null,
                  row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString()
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.message ? (
                <p className="mt-1.5 text-sm leading-snug text-text-secondary">
                  {row.message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}

export function EventPackagesPageSection({ event, headerItem }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(
    event,
    "packagesPage",
    EMPTY_PACKAGES_PAGE,
  );
  const [design, setDesign, saveDesign] = useEventConfig(
    event,
    "packagesDesign",
    defaultPageDesign(),
  );
  const data = normalizePackagesPage(cfg);

  const set = (key) => (value) => setCfg({ ...data, [key]: value });
  const field = (key) => (e) => set(key)(e.target.value);

  const save = async () => {
    await saveCfg(undefined, { successMsg: "Packages page saved." });
  };

  const publicPath = event?.id ? `/e/${event.id}/packages` : null;

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Packages Page"}
        description={
          headerItem?.desc ||
          "The standalone page your packages sell from — separate from your event's live page."
        }
        action={
          <div className="flex gap-2">
            {publicPath && data.enabled ? (
              <Button
                variant="outline"
                onClick={() => window.open(publicPath, "_blank", "noopener")}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" /> View page
              </Button>
            ) : null}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save page"}
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Publish"
        description="Until this is on, the packages page returns nothing — even to someone with the link."
      >
        <SettingsList>
          <SettingRow
            title="Packages page is live"
            description={
              publicPath
                ? `Published at ${publicPath}`
                : "Save the event first to get its address."
            }
            checked={data.enabled}
            onCheckedChange={set("enabled")}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Hero"
        description="Sits over your event's cover image, so keep it short."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Title"
            hint="Blank uses the event's own name"
            htmlFor="pkgpage-title"
          >
            <Input
              id="pkgpage-title"
              value={data.title}
              onChange={field("title")}
              placeholder="UFC 331 VIP Tickets"
            />
          </Field>
          <Field label="Subtitle" htmlFor="pkgpage-subtitle">
            <Input
              id="pkgpage-subtitle"
              value={data.subtitle}
              onChange={field("subtitle")}
              placeholder="Crypto.com Arena | Los Angeles, CA"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Intro"
        description="A paragraph between the hero and the packages, with an optional link."
      >
        <div className="grid gap-4">
          <Field label="Heading" htmlFor="pkgpage-introheading">
            <Input
              id="pkgpage-introheading"
              value={data.introHeading}
              onChange={field("introHeading")}
              placeholder="Optional"
            />
          </Field>
          <Field label="Body" htmlFor="pkgpage-introbody">
            <Textarea
              id="pkgpage-introbody"
              rows={3}
              value={data.introBody}
              onChange={field("introBody")}
              placeholder="VIP Experience packages can include premium seating, hospitality and more."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link label" htmlFor="pkgpage-introlinklabel">
              <Input
                id="pkgpage-introlinklabel"
                value={data.introLinkLabel}
                onChange={field("introLinkLabel")}
                placeholder="View the FAQs"
              />
            </Field>
            <Field label="Link address" htmlFor="pkgpage-introlinkurl">
              <Input
                id="pkgpage-introlinkurl"
                value={data.introLinkUrl}
                onChange={field("introLinkUrl")}
                placeholder="example.com/vip-faq"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Packages band"
        description="The heading over the tier cards themselves."
      >
        <Field label="Heading" htmlFor="pkgpage-gridheading">
          <Input
            id="pkgpage-gridheading"
            value={data.gridHeading}
            onChange={field("gridHeading")}
            placeholder="VIP Packages"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Why choose us"
        description="An optional image-and-text band under the packages, for the pitch."
      >
        <SettingsList>
          <SettingRow
            title="Show this band"
            checked={data.pitchEnabled}
            onCheckedChange={set("pitchEnabled")}
          />
        </SettingsList>

        {data.pitchEnabled ? (
          <div className="mt-4 grid gap-4">
            <Field label="Heading" htmlFor="pkgpage-pitchheading">
              <Input
                id="pkgpage-pitchheading"
                value={data.pitchHeading}
                onChange={field("pitchHeading")}
                placeholder="Why choose our VIP experience?"
              />
            </Field>
            <Field label="Body" htmlFor="pkgpage-pitchbody">
              <Textarea
                id="pkgpage-pitchbody"
                rows={3}
                value={data.pitchBody}
                onChange={field("pitchBody")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Image address" htmlFor="pkgpage-pitchimage">
                <Input
                  id="pkgpage-pitchimage"
                  value={data.pitchImage}
                  onChange={field("pitchImage")}
                  placeholder="https://…"
                />
              </Field>
              <Field
                label="Button label"
                hint="Scrolls up to the packages"
                htmlFor="pkgpage-pitchcta"
              >
                <Input
                  id="pkgpage-pitchcta"
                  value={data.pitchCtaLabel}
                  onChange={field("pitchCtaLabel")}
                  placeholder="Shop packages"
                />
              </Field>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Enquiry form"
        description="For buyers who want to talk first, and the only route for packages set to “Collect enquiries”."
      >
        <SettingsList>
          <SettingRow
            title="Show the enquiry form"
            checked={data.leadsEnabled}
            onCheckedChange={set("leadsEnabled")}
          />
        </SettingsList>

        {data.leadsEnabled ? (
          <div className="mt-4 grid gap-4">
            <Field label="Heading" htmlFor="pkgpage-leadsheading">
              <Input
                id="pkgpage-leadsheading"
                value={data.leadsHeading}
                onChange={field("leadsHeading")}
                placeholder="Learn more about our VIP experiences"
              />
            </Field>
            <Field
              label="Consent line"
              hint="Shown beside the tick box above Submit"
              htmlFor="pkgpage-leadsconsent"
            >
              <Textarea
                id="pkgpage-leadsconsent"
                rows={2}
                value={data.leadsConsent}
                onChange={field("leadsConsent")}
                placeholder="By submitting this form I agree to be contacted about this event."
              />
            </Field>
            <Field
              label="Send enquiries to"
              hint="Blank sends them to the event's organizer address"
              htmlFor="pkgpage-leadsrecipient"
            >
              <Input
                id="pkgpage-leadsrecipient"
                type="email"
                value={data.leadsRecipient}
                onChange={field("leadsRecipient")}
                placeholder="hospitality@example.com"
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      {data.leadsEnabled ? <PackageEnquiries eventId={event?.id} /> : null}

      <SectionCard
        title="Design"
        description="This page's own layout, theme and blocks — independent of your event page's design."
        bodyPadding={false}
        bare
      >
        <PageDesignSection
          design={design}
          event={event}
          eventId={event?.id}
          onChange={setDesign}
          onPersist={(next) =>
            saveDesign(next, { successMsg: "Page design saved." })
          }
        />
      </SectionCard>
    </div>
  );
}

export default EventPackagesPageSection;
