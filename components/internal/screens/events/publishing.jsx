"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Globe, Link2, Lock, EyeOff, Check } from "lucide-react";

import {
  DataTable,
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
import { EVENT_STATUS_MAP } from "./sample_data";

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

export function VisibilitySection({ event }) {
  const [visibility, setVisibility] = useState("public");
  const [password, setPassword] = useState(false);

  return (
    <div className="space-y-6">
      <SectionCard title="Who can see this event">
        <div className="grid gap-3">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = visibility === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                  active
                    ? "border-[#3a3a3a] bg-[#202020]"
                    : "border-[#2a2a2a] bg-transparent hover:bg-[#1f1f1f]",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#d4d4d4]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#ededed]">
                    {opt.label}
                  </p>
                  <p className="text-xs text-[#737373]">{opt.description}</p>
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
      </SectionCard>

      <SectionCard title="Access & indexing">
        <SettingsList>
          <SettingRow
            icon={Lock}
            title="Password protect"
            description="Require a password before the page loads."
            checked={password}
            onCheckedChange={setPassword}
          />
          {password ? (
            <div className="py-3">
              <Field label="Event password">
                <Input placeholder="Set a password" className="max-w-xs" />
              </Field>
            </div>
          ) : null}
          <SettingRow
            icon={Globe}
            title="Allow search engine indexing"
            description="Let Google and others list this event in results."
            checked
          />
          <SettingRow
            icon={EyeOff}
            title="Require sign-in to register"
            description="Attendees must have a Geiger account."
          />
        </SettingsList>
        <div className="mt-5 flex justify-end">
          <Button
            className="bg-white text-[#161616] hover:bg-[#e7e7e7]"
            onClick={() => toast.success("Visibility settings saved.")}
          >
            Save changes
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Custom URL --------------------------------------------------------------

const REDIRECTS = [
  { id: "r1", from: "/summer-launch", to: "/summer-product-launch", status: "On sale" },
  { id: "r2", from: "/ama", to: "/founder-ama-live", status: "On sale" },
];

export function CustomUrlSection({ event }) {
  const [slug, setSlug] = useState("summer-product-launch");
  const available = slug.length > 3;

  const columns = [
    {
      key: "from",
      header: "Redirect from",
      render: (r) => (
        <code className="rounded bg-[#202020] px-1.5 py-0.5 text-xs text-[#d4d4d4]">
          geiger.events{r.from}
        </code>
      ),
    },
    {
      key: "to",
      header: "To",
      render: (r) => (
        <code className="rounded bg-[#202020] px-1.5 py-0.5 text-xs text-[#a3a3a3]">
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
      <SectionCard title="Event link">
        <Field label="URL slug" hint="Lowercase letters, numbers, and hyphens.">
          <div className="flex items-center overflow-hidden rounded-md border border-[#2a2a2a] bg-[#202020]">
            <span className="border-r border-[#2a2a2a] px-3 py-2.5 text-sm text-[#737373]">
              geiger.events/
            </span>
            <input
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                )
              }
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[#ededed] outline-none"
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
            className="bg-white text-[#161616] hover:bg-[#e7e7e7]"
            onClick={() => toast.success("URL saved.")}
          >
            Save URL
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Custom domain"
        description="Host event pages on your own domain (Pro plan)."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Domain" className="flex-1">
            <Input placeholder="events.yourbrand.com" />
          </Field>
          <Button
            variant="outline"
            className="border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
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
