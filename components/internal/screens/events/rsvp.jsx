"use client";

import React from "react";
import { Loader2, UserPlus, CalendarClock } from "lucide-react";

import {
  EditorSectionHeader,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEventConfig } from "@/lib/events/use-event-config";

// All RSVP behaviour for an event lives here — the master toggle, response
// options, capacity/waitlist, plus-ones, and confirmations. Persisted as a
// single `rsvp` bag through the event metadata (see useEventConfig).
const DEFAULT_RSVP = {
  enabled: true,
  allowMaybe: true,
  requireApproval: false,
  deadline: "",
  limitCapacity: false,
  capacity: 100,
  waitlist: true,
  allowGuests: false,
  maxGuests: 1,
  collectGuestNames: true,
  showGuestList: true,
  allowChanges: true,
  sendConfirmation: true,
};

export function RsvpOptionsSection({ event, headerItem }) {
  const [rsvp, setRsvp, saveRsvp, saving] = useEventConfig(
    event,
    "rsvp",
    DEFAULT_RSVP,
  );

  // Toggles persist immediately; free-text/number fields edit transiently and
  // persist on blur (so we don't hit the server on every keystroke).
  const commit = (key) => (value) => saveRsvp({ ...rsvp, [key]: value });
  const draft = (key) => (value) => setRsvp({ ...rsvp, [key]: value });

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "RSVP Options"}
        description={
          headerItem?.desc ||
          "Let attendees respond to your event — set how RSVPs are collected, capped, and confirmed."
        }
      />

      {/* Master switch — when off, the rest of the options are hidden. */}
      <SettingsList>
        <SettingRow
          title="Enable RSVPs"
          description="Show an RSVP button on the event page so people can respond."
          checked={rsvp.enabled}
          onCheckedChange={commit("enabled")}
        />
      </SettingsList>

      {rsvp.enabled ? (
        <>
          <SectionCard
            title="Responses"
            description="What people can do when they respond."
          >
            <SettingsList>
              <SettingRow
                title='Allow "Maybe" responses'
                description="Let guests mark themselves as undecided, not just going or not going."
                checked={rsvp.allowMaybe}
                onCheckedChange={commit("allowMaybe")}
              />
              <SettingRow
                title="Require approval"
                description="Manually approve each RSVP before it's confirmed."
                checked={rsvp.requireApproval}
                onCheckedChange={commit("requireApproval")}
              />
              <SettingRow
                title="Allow changes & cancellations"
                description="Attendees can update or withdraw their RSVP after responding."
                checked={rsvp.allowChanges}
                onCheckedChange={commit("allowChanges")}
              />
              <SettingRow
                icon={CalendarClock}
                title="RSVP deadline"
                description="Close RSVPs automatically after this date. Leave empty for no deadline."
                control={
                  <Input
                    type="date"
                    value={rsvp.deadline}
                    aria-label="RSVP deadline"
                    onChange={(e) => draft("deadline")(e.target.value)}
                    onBlur={() => saveRsvp()}
                    className="w-44"
                  />
                }
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Capacity & waitlist"
            description="Cap attendance and handle overflow."
          >
            <SettingsList>
              <SettingRow
                title="Limit capacity"
                description="Cap the number of people who can RSVP."
                checked={rsvp.limitCapacity}
                onCheckedChange={commit("limitCapacity")}
              />
              {rsvp.limitCapacity ? (
                <SettingRow
                  title="Maximum attendees"
                  description="RSVPs close automatically once this is reached."
                  control={
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={rsvp.capacity}
                      aria-label="Maximum attendees"
                      onChange={(e) => draft("capacity")(Number(e.target.value))}
                      onBlur={() => saveRsvp()}
                      className="w-24 tabular-nums"
                    />
                  }
                />
              ) : null}
              {rsvp.limitCapacity ? (
                <SettingRow
                  title="Enable waitlist"
                  description="Collect a waitlist once the event is full and promote as spots open."
                  checked={rsvp.waitlist}
                  onCheckedChange={commit("waitlist")}
                />
              ) : null}
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Guests"
            description="Whether attendees can bring others."
          >
            <SettingsList>
              <SettingRow
                icon={UserPlus}
                title="Allow plus-ones"
                description="Let attendees bring additional guests with their RSVP."
                checked={rsvp.allowGuests}
                onCheckedChange={commit("allowGuests")}
              />
              {rsvp.allowGuests ? (
                <SettingRow
                  title="Max guests per RSVP"
                  description="How many extra people each attendee can bring."
                  control={
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={rsvp.maxGuests}
                      aria-label="Max guests per RSVP"
                      onChange={(e) => draft("maxGuests")(Number(e.target.value))}
                      onBlur={() => saveRsvp()}
                      className="w-24 tabular-nums"
                    />
                  }
                />
              ) : null}
              {rsvp.allowGuests ? (
                <SettingRow
                  title="Collect guest names"
                  description="Ask for the name of each additional guest."
                  checked={rsvp.collectGuestNames}
                  onCheckedChange={commit("collectGuestNames")}
                />
              ) : null}
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Visibility & confirmations"
            description="What attendees see and receive."
          >
            <SettingsList>
              <SettingRow
                title="Show who's going"
                description="Display the guest list and attendee count on the public page."
                checked={rsvp.showGuestList}
                onCheckedChange={commit("showGuestList")}
              />
              <SettingRow
                title="Send confirmation email"
                description="Email a confirmation to each attendee when they RSVP."
                checked={rsvp.sendConfirmation}
                onCheckedChange={commit("sendConfirmation")}
              />
            </SettingsList>
          </SectionCard>

          <div className="flex justify-end">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={() => saveRsvp(undefined, { successMsg: "RSVP options saved." })}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save RSVP options"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default RsvpOptionsSection;
