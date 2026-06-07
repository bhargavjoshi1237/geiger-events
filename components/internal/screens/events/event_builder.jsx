"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Basics (name, summary, format) ------------------------------------------

export function BasicsSection({ event }) {
  const [form, setForm] = useState({
    name: event?.name || "",
    summary: "An evening of talks and networking.",
    type: event?.type || "In-person",
  });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard title="Basics">
        <div className="grid gap-4">
          <Field label="Event name">
            <Input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="What's it called?"
            />
          </Field>
          <Field
            label="Short summary"
            hint="Shown in listings and social previews."
          >
            <Textarea
              value={form.summary}
              onChange={(e) => set("summary")(e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Format">
            <Select value={form.type} onValueChange={set("type")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="In-person">In-person</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// --- Tickets -----------------------------------------------------------------

const INITIAL_TICKETS = [
  { id: 1, name: "General Admission", price: 25, qty: 200 },
  { id: 2, name: "Early Bird", price: 18, qty: 80 },
  { id: 3, name: "VIP", price: 60, qty: 40 },
];

export function TicketsSection({ event }) {
  const [tickets, setTickets] = useState(INITIAL_TICKETS);

  const addTicket = () =>
    setTickets((t) => [
      ...t,
      { id: Date.now(), name: "New ticket", price: 0, qty: 50 },
    ]);
  const removeTicket = (id) => setTickets((t) => t.filter((x) => x.id !== id));
  const updateTicket = (id, key, value) =>
    setTickets((t) => t.map((x) => (x.id === id ? { ...x, [key]: value } : x)));

  return (
    <div className="space-y-6">
      <SectionCard
        title="Ticket types"
        description="Add the tiers attendees can buy."
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-[#2a2a2a] bg-transparent text-[#d4d4d4] hover:bg-[#252525] hover:text-white"
            onClick={addTicket}
          >
            <Plus className="h-4 w-4" /> Add ticket
          </Button>
        }
      >
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="flex items-end gap-3 rounded-lg border border-[#2a2a2a] bg-[#202020] p-3"
            >
              <Field label="Name" className="flex-1">
                <Input
                  value={t.name}
                  onChange={(e) => updateTicket(t.id, "name", e.target.value)}
                />
              </Field>
              <Field label="Price ($)" className="w-24">
                <Input
                  type="number"
                  value={t.price}
                  onChange={(e) =>
                    updateTicket(t.id, "price", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Qty" className="w-24">
                <Input
                  type="number"
                  value={t.qty}
                  onChange={(e) =>
                    updateTicket(t.id, "qty", Number(e.target.value))
                  }
                />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                className="mb-0.5 text-[#737373] hover:bg-red-500/10 hover:text-red-400"
                onClick={() => removeTicket(t.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// --- Registration settings ---------------------------------------------------

export function RegistrationSettingsSection({ event }) {
  const [settings, setSettings] = useState({
    requireApproval: false,
    showRemaining: true,
  });
  const set = (key) => (value) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div className="space-y-6">
      <SectionCard title="Registration settings">
        <SettingsList>
          <SettingRow
            title="Require approval"
            description="Manually approve each registration before it's confirmed."
            checked={settings.requireApproval}
            onCheckedChange={set("requireApproval")}
          />
          <SettingRow
            title="Show tickets remaining"
            description="Display a live count of remaining tickets on the event page."
            checked={settings.showRemaining}
            onCheckedChange={set("showRemaining")}
          />
        </SettingsList>
      </SectionCard>
    </div>
  );
}
