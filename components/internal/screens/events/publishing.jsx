"use client";

import React, { useState } from "react";
import { Globe, Link2, Lock, EyeOff, Check, LayoutGrid } from "lucide-react";

import {
  DataTable,
  EditorSectionHeader,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_STATUS_MAP, eventSlug } from "./sample_data";
import { useEventConfig } from "@/lib/events/use-event-config";

// UI radio values are lowercase; the event model stores capitalised labels.
const VISIBILITY_TO_LABEL = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
};

// --- Visibility --------------------------------------------------------------

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Listed in discovery, search engines, and your organizer page.",
    icon: Globe,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Only people with the link can find it. Not listed anywhere.",
    icon: Link2,
  },
  {
    value: "private",
    label: "Private",
    description: "Invite-only. Attendees must be signed in and approved.",
    icon: Lock,
  },
];

export function VisibilitySection({ event, headerItem, onPatch, onCommit }) {
  const [visibility, setVisibility] = useState(
    (event?.visibility || "Public").toLowerCase(),
  );
  const [access, setAccess, saveAccess, saving] = useEventConfig(
    event,
    "access",
    { password: false, passwordValue: "", indexing: true, requireSignin: false },
  );
  const setAccessField = (key) => (value) =>
    setAccess({ ...access, [key]: value });

  const choose = (value) => {
    setVisibility(value);
    const label = VISIBILITY_TO_LABEL[value] || "Public";
    // Visibility is a column — persist immediately.
    (onCommit || onPatch)?.({ visibility: label });
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Visibility"}
        description={headerItem?.desc}
      />
      <div className="grid gap-3">
        {VISIBILITY_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = visibility === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                active
                  ? "border-border-strong bg-surface-card"
                  : "border-border bg-transparent hover:bg-surface-card",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {opt.label}
                </p>
                <p className="text-xs text-text-secondary">{opt.description}</p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border",
                  active ? "border-white bg-white" : "border-[#444]",
                )}
              >
                {active ? <Check className="h-3 w-3 text-[#161616]" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <SectionCard
        title="Event Wall"
        description="Your public events hub — configured under Events → Event Wall."
      >
        <SettingsList>
          <SettingRow
            icon={LayoutGrid}
            title="List on Event Wall"
            description="Show this event on your public Event Wall page."
            checked={!!event.isListable}
            onCheckedChange={(v) => (onCommit || onPatch)?.({ isListable: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Access & indexing">
        <SettingsList>
          <SettingRow
            icon={Lock}
            title="Password protect"
            description="Require a password before the page loads."
            checked={access.password}
            onCheckedChange={setAccessField("password")}
          />
          {access.password ? (
            <div className="py-3">
              <Field label="Event password">
                <Input
                  placeholder="Set a password"
                  className="max-w-xs"
                  value={access.passwordValue || ""}
                  onChange={(e) =>
                    setAccessField("passwordValue")(e.target.value)
                  }
                />
              </Field>
            </div>
          ) : null}
          <SettingRow
            icon={Globe}
            title="Allow search engine indexing"
            description="Let Google and others list this event in results."
            checked={access.indexing}
            onCheckedChange={setAccessField("indexing")}
          />
          <SettingRow
            icon={EyeOff}
            title="Require sign-in to register"
            description="Attendees must have a Geiger account."
            checked={access.requireSignin}
            onCheckedChange={setAccessField("requireSignin")}
          />
        </SettingsList>
      </SectionCard>
      <div className="mt-5 flex justify-end">
            <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() =>
              saveAccess(access, { successMsg: "Visibility settings saved." })
            }
          >
            Save changes
          </Button>
        </div>
    </div>
  );
}

// --- Custom URL --------------------------------------------------------------

const REDIRECTS = [
  { id: "r1", from: "/summer-launch", to: "/summer-product-launch", status: "On sale" },
  { id: "r2", from: "/ama", to: "/founder-ama-live", status: "On sale" },
];

export function CustomUrlSection({ event, headerItem }) {
  const [url, setUrl, saveUrl, saving] = useEventConfig(event, "url", {
    slug: eventSlug(event),
    domain: "",
  });
  const slug = url.slug || "";
  const setSlug = (next) => setUrl({ ...url, slug: next });
  const available = slug.length > 3;

  const columns = [
    {
      key: "from",
      header: "Redirect from",
      render: (r) => (
        <code className="rounded bg-surface-card px-1.5 py-0.5 text-xs text-muted-foreground">
          geiger.events{r.from}
        </code>
      ),
    },
    {
      key: "to",
      header: "To",
      render: (r) => (
        <code className="rounded bg-surface-card px-1.5 py-0.5 text-xs text-muted-foreground">
          {r.to}
        </code>
      ),
    },
    {
      key: "status",
      header: "Event",
      render: (r) => <StatusPill status={r.status} map={EVENT_STATUS_MAP} />,
    },
  ];

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Custom URL"}
        description={headerItem?.desc}
      />
      <Field label="URL slug" hint="Lowercase letters, numbers, and hyphens.">
        <div className="flex items-center overflow-hidden rounded-md border border-border bg-surface-card">
          <span className="border-r border-border px-3 py-2.5 text-sm text-text-secondary">
            geiger.events/
          </span>
          <input
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
              )
            }
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none"
          />
          <span
            className={cn(
              "mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
              available
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400",
            )}
          >
            {available ? <Check className="h-3 w-3" /> : null}
            {available ? "Available" : "Too short"}
          </span>
        </div>
      </Field>

      <div className="mt-5 flex justify-end">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() => saveUrl(url, { successMsg: "URL saved." })}
        >
          Save URL
        </Button>
      </div>

      <SectionCard
        title="Custom domain"
        description="Host event pages on your own domain (Pro plan)."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Domain" className="flex-1">
            <Input
              placeholder="events.yourbrand.com"
              value={url.domain || ""}
              onChange={(e) => setUrl({ ...url, domain: e.target.value })}
            />
          </Field>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Verify domain
          </Button>
        </div>
        <Badge variant="warning" className="mt-3">
          Not connected
        </Badge>
      </SectionCard>

      <SectionCard
        title="Redirects"
        description="Old links that point to current events."
        bodyPadding={false}
      >
        <DataTable
          columns={columns}
          data={REDIRECTS}
          getRowKey={(r) => r.id}
          className="rounded-none border-0"
        />
      </SectionCard>
    </div>
  );
}
