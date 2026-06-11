"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Map as MapIcon,
  Globe,
  Plus,
  Navigation,
  Car,
  Train,
  Clock,
} from "lucide-react";

import {
  DataTable,
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENTS } from "./sample_data";

const TIMEZONES = [
  { value: "Europe/London", label: "London (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-7)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+2)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
];

function MapPlaceholder({ className }) {
  return (
    <div
      className={
        "relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-card " +
        (className || "")
      }
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#2a2a2a_1px,transparent_1px),linear-gradient(to_bottom,#2a2a2a_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
      <div className="relative flex flex-col items-center gap-1 text-text-secondary">
        <MapPin className="h-7 w-7 text-muted-foreground" />
        <span className="text-xs">Map preview</span>
      </div>
    </div>
  );
}

// --- Location & Time ---------------------------------------------------------

export function LocationTimeSection({ event }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Venue">
          <div className="grid gap-4">
            <Field label="Venue name">
              <Input defaultValue="The Glasshouse" />
            </Field>
            <Field label="Address">
              <Input defaultValue="61 Southwark Street, London SE1 0HL" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Room / floor">
                <Input placeholder="e.g. Mezzanine" />
              </Field>
              <Field label="Timezone">
                <Select defaultValue="Europe/London">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Location preview" bodyPadding={false}>
          <div className="p-4">
            <MapPlaceholder className="aspect-[4/3]" />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Date & time">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Doors open">
            <Input type="time" defaultValue="18:00" />
          </Field>
          <Field label="Starts">
            <Input type="datetime-local" defaultValue="2026-06-18T18:30" />
          </Field>
          <Field label="Ends">
            <Input type="datetime-local" defaultValue="2026-06-18T22:00" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Location & time saved.")}
          >
            Save
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Map & Directions --------------------------------------------------------

const DIRECTION_PROVIDERS = [
  { name: "Google Maps", icon: MapIcon },
  { name: "Apple Maps", icon: Navigation },
  { name: "Citymapper", icon: Train },
];

export function MapDirectionsSection({ event }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Pinned location" bodyPadding={false}>
        <div className="p-4">
          <MapPlaceholder className="aspect-[21/9]" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Open in:</span>
            {DIRECTION_PROVIDERS.map((p) => {
              const Icon = p.icon;
              return (
                <Button
                  key={p.name}
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <Icon className="h-4 w-4" /> {p.name}
                </Button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Getting there"
          description="Shown under the map on your event page."
        >
          <div className="grid gap-4">
            <Field label="Public transport" hint="Nearest stations and lines.">
              <Textarea
                rows={3}
                defaultValue="2 min from Southwark (Jubilee line). London Bridge (10 min walk)."
              />
            </Field>
            <Field label="Parking" hint="On-site or nearby options.">
              <Textarea
                rows={2}
                defaultValue="No on-site parking. NCP Great Suffolk Street, 5 min walk."
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Nearby" description="Useful spots around the venue.">
          <SettingsList>
            <SettingRow
              icon={Train}
              title="Southwark Station"
              description="Jubilee line · 2 min walk"
              control={<Badge variant="info">Transit</Badge>}
            />
            <SettingRow
              icon={Car}
              title="NCP Car Park"
              description="Great Suffolk Street · 5 min walk"
              control={<Badge variant="neutral">Parking</Badge>}
            />
            <SettingRow
              icon={MapPin}
              title="The Anchor"
              description="Riverside pub · 4 min walk"
              control={<Badge variant="neutral">Food & drink</Badge>}
            />
          </SettingsList>
        </SectionCard>
      </div>
    </div>
  );
}

// --- Time-zone Support -------------------------------------------------------

export function TimezoneSupportSection({ event }) {
  const columns = [
    {
      key: "name",
      header: "Event",
      render: (e) => (
        <span className="font-medium text-foreground">{e.name}</span>
      ),
    },
    {
      key: "city",
      header: "Location",
      render: (e) => <span className="text-sm text-muted-foreground">{e.city}</span>,
    },
    {
      key: "tz",
      header: "Timezone",
      render: (e) => (
        <Badge variant="neutral">
          <Globe className="h-3 w-3" />
          {e.city === "Remote" ? "Attendee local" : "Europe/London"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Defaults">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Workspace default timezone">
            <Select defaultValue="Europe/London">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Time format">
            <Select defaultValue="12h">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (6:30 PM)</SelectItem>
                <SelectItem value="24h">24-hour (18:30)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <SettingsList className="mt-5">
          <SettingRow
            icon={Clock}
            title="Show times in attendee's local timezone"
            description="Online events display converted times based on the visitor's device."
            checked
          />
          <SettingRow
            icon={Globe}
            title="Display timezone label"
            description="Append the timezone (e.g. BST) next to every time."
            checked
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Per-event timezones"
        description="How each event currently handles time."
        bodyPadding={false}
      >
        <DataTable
          columns={columns}
          data={EVENTS.slice(0, 5)}
          getRowKey={(e) => e.id}
          className="rounded-none border-0"
        />
      </SectionCard>
    </div>
  );
}
