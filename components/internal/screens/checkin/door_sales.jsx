"use client";

import React from "react";
import { DoorOpen } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { CheckinSettingsScreen } from "./checkin_kit";

export function DoorSalesScreen() {
  return (
    <CheckinSettingsScreen
      title="Door Sales"
      description="Sell tickets at the entrance and check buyers in as walk-ins. Enable it per event in the event editor once it’s on here."
      icon={DoorOpen}
      feature="doorSales"
      enableLabel="Door sales"
      enableHint="Let staff sell walk-in tickets at the door."
    >
      {({ slice, set, enabled }) => (
        <div className={enabled ? "space-y-6" : "hidden"}>
          <SectionCard title="Payment methods" description="How staff record a walk-in sale. Payment is marked at the door — no gateway is charged.">
            <SettingsList>
              <SettingRow
                title="Cash"
                checked={slice.methods?.cash}
                onCheckedChange={(v) => set({ methods: { ...slice.methods, cash: v } })}
              />
              <SettingRow
                title="Card (external terminal)"
                checked={slice.methods?.card}
                onCheckedChange={(v) => set({ methods: { ...slice.methods, card: v } })}
              />
              <SettingRow
                title="Complimentary"
                description="Issue a free walk-in ticket."
                checked={slice.methods?.comp}
                onCheckedChange={(v) => set({ methods: { ...slice.methods, comp: v } })}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Behavior" description="What happens right after a door sale.">
            <SettingsList>
              <SettingRow
                title="Auto check-in buyer"
                description="Admit the buyer immediately as a walk-in registration."
                checked={slice.autoCheckin}
                onCheckedChange={(v) => set({ autoCheckin: v })}
              />
              <SettingRow
                title="Require email"
                description="Collect an email so the buyer gets a receipt and ticket."
                checked={slice.requireEmail}
                onCheckedChange={(v) => set({ requireEmail: v })}
              />
            </SettingsList>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default DoorSalesScreen;
