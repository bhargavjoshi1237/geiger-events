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
import { FormFieldsEditor } from "@/components/internal/shared/form_fields_editor";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useEventConfig } from "@/lib/events/use-event-config";
import { ctaHref } from "@/lib/events/ctas";
import {
  EMPTY_SPONSORSHIP_PAGE,
  FIXED_ENQUIRY_FIELDS,
  normalizeSponsorshipPage,
  sponsorPagePath,
} from "@/lib/events/sponsorship";

function TextField({ id, label, hint, value, onChange, placeholder, type = "text" }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}

export function EventSponsorPageSection({ event, headerItem, onPatch }) {
  const [cfg, setCfg, saveCfg, saving] = useEventConfig(event, "sponsorshipPage", EMPTY_SPONSORSHIP_PAGE, onPatch);
  const data = normalizeSponsorshipPage(cfg);

  const set = (key) => (value) => setCfg({ ...data, [key]: value });
  // The live switch saves on its own, so publishing never waits on the Save button.
  const setLive = (enabled) => saveCfg({ ...data, enabled }, { successMsg: enabled ? "Sponsorship page is live." : "Sponsorship page hidden." });
  const setFields = (updater) =>
    setCfg({ ...data, fields: typeof updater === "function" ? updater(data.fields) : updater });
  const save = () => saveCfg(undefined, { successMsg: "Sponsorship page saved." });

  const publicPath = sponsorPagePath(event?.id);

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Sponsor Page"}
        description={
          headerItem?.desc ||
          "A shareable prospectus: your open spots, how to reach you, and an interest form."
        }
        action={
          <div className="flex gap-2">
            {publicPath && data.enabled ? (
              <Button
                variant="outline"
                onClick={() => window.open(ctaHref(publicPath), "_blank", "noopener")}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" /> View page
              </Button>
            ) : null}
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save page"}
            </Button>
          </div>
        }
      />

      <SectionCard title="Publish" description="Until this is on, the sponsorship page shows nothing — even to someone with the link.">
        <SettingsList>
          <SettingRow
            title="Sponsorship page is live"
            description={publicPath ? `Published at ${publicPath}` : "Save the event first to get its address."}
            checked={data.enabled}
            onCheckedChange={setLive}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Page copy" description="Sits over your event's cover, above the list of open spots.">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="sponsorpage-title"
              label="Title"
              hint="Blank uses “Sponsor <event name>”"
              value={data.title}
              onChange={set("title")}
              placeholder="Partner with DevSummit 2026"
            />
            <TextField
              id="sponsorpage-subtitle"
              label="Subtitle"
              value={data.subtitle}
              onChange={set("subtitle")}
              placeholder="3,000 engineers · 2 days · London"
            />
          </div>
          <Field label="Introduction" htmlFor="sponsorpage-intro">
            <Textarea
              id="sponsorpage-intro"
              rows={4}
              value={data.intro}
              onChange={(e) => set("intro")(e.target.value)}
              placeholder="Who comes, why they come, and what sponsors get out of it."
            />
          </Field>
          <SettingsList>
            <SettingRow
              title="Show prices"
              description="Off shows every spot as “on request”, whatever its price."
              checked={data.showPrices}
              onCheckedChange={set("showPrices")}
            />
            <SettingRow
              title="Show taken spots"
              description="Keep full spots on the page, marked as taken — useful social proof."
              checked={data.showFilled}
              onCheckedChange={set("showFilled")}
            />
          </SettingsList>
        </div>
      </SectionCard>

      <SectionCard
        title="Contact methods"
        description="How prospects reach you directly. Anything left blank is hidden; deals happen off-platform."
      >
        <div className="grid gap-4">
          <TextField
            id="sponsorpage-contactheading"
            label="Heading"
            value={data.contactHeading}
            onChange={set("contactHeading")}
            placeholder="Talk to us"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="sponsorpage-email"
              label="Email"
              type="email"
              value={data.contactEmail}
              onChange={set("contactEmail")}
              placeholder="partners@example.com"
            />
            <TextField
              id="sponsorpage-phone"
              label="Phone"
              value={data.contactPhone}
              onChange={set("contactPhone")}
              placeholder="+44 20 7946 0000"
            />
            <TextField
              id="sponsorpage-whatsapp"
              label="WhatsApp"
              hint="Number with country code"
              value={data.contactWhatsapp}
              onChange={set("contactWhatsapp")}
              placeholder="+44 7700 900000"
            />
            <TextField
              id="sponsorpage-booking"
              label="Booking link"
              hint="Calendly, Cal.com…"
              value={data.bookingUrl}
              onChange={set("bookingUrl")}
              placeholder="cal.com/you/sponsorship"
            />
          </div>
          <TextField
            id="sponsorpage-bookinglabel"
            label="Booking button label"
            value={data.bookingLabel}
            onChange={set("bookingLabel")}
            placeholder="Book a call"
          />
          <Field label="Note" hint="Optional — e.g. who to ask for, office hours" htmlFor="sponsorpage-note">
            <Textarea
              id="sponsorpage-note"
              rows={2}
              value={data.contactNote}
              onChange={(e) => set("contactNote")(e.target.value)}
              placeholder="Ask for Priya, our partnerships lead. We reply within one working day."
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Interest form" description="Submissions land in Sponsor Enquiries, ready to turn into a filled spot.">
        <div className="grid gap-4">
          <SettingsList>
            <SettingRow
              title="Show the interest form"
              description="Off leaves only your contact methods on the page."
              checked={data.formEnabled}
              onCheckedChange={set("formEnabled")}
            />
          </SettingsList>
          {data.formEnabled ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="sponsorpage-formheading"
                  label="Form heading"
                  value={data.formHeading}
                  onChange={set("formHeading")}
                  placeholder="Register your interest"
                />
                <TextField
                  id="sponsorpage-success"
                  label="Thank-you message"
                  hint="Blank uses a standard message"
                  value={data.successMessage}
                  onChange={set("successMessage")}
                  placeholder="Thanks — we'll be in touch within a day."
                />
              </div>
              <TextField
                id="sponsorpage-formintro"
                label="Form introduction"
                hint="Optional"
                value={data.formIntro}
                onChange={set("formIntro")}
                placeholder="Tell us a little about you and we'll send the full prospectus."
              />
              <Field label="Consent text" hint="Optional — adds a required checkbox" htmlFor="sponsorpage-consent">
                <Textarea
                  id="sponsorpage-consent"
                  rows={2}
                  value={data.consent}
                  onChange={(e) => set("consent")(e.target.value)}
                  placeholder="I agree to be contacted about sponsoring this event."
                />
              </Field>
            </>
          ) : null}
        </div>
      </SectionCard>

      {data.formEnabled ? (
        <FormFieldsEditor
          fields={data.fields}
          setFields={setFields}
          lockedFields={FIXED_ENQUIRY_FIELDS}
          title="Form questions"
          description="Company, name and email are always asked — they're what a sponsor record needs. Add anything else you want to know."
        />
      ) : null}
    </div>
  );
}

export default EventSponsorPageSection;
