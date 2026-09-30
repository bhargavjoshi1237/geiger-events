"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeSponsorship } from "@/lib/events/sponsorship";

// The full deal configuration stays in member-only storage; metadata is public.
export async function getEventSponsorship(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from("event_sponsorship")
      .select("spots")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) {
      console.error("[event_sponsorship.get]", error.message);
      return null;
    }
    return normalizeSponsorship(data || { spots: [] });
  } catch (error) {
    console.error("[event_sponsorship.get]", error);
    return null;
  }
}

// The RPC writes deals and their public projection in one transaction.
export async function saveEventSponsorship(eventId, spots) {
  if (!eventId || !isSupabaseConfigured()) return false;
  try {
    const { error } = await createClient().rpc("save_event_sponsorship", {
      p_event_id: eventId,
      p_spots: normalizeSponsorship({ spots }).spots,
    });
    if (error) {
      console.error("[event_sponsorship.save]", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[event_sponsorship.save]", error);
    return false;
  }
}
