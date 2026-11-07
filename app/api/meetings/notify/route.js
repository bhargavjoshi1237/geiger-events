import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import { publicBaseUrl, runMeetingNotice } from "@/lib/meetings/notify";

// Organiser-side meeting changes (booked, cancelled, moved) email the attendees involved.
// The caller must be able to read the meeting through RLS, i.e. be a member of its project.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["meeting_confirmed", "meeting_cancelled", "meeting_rescheduled"]);
const FRESH_MS = 15 * 60 * 1000;

async function userClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (match) {
    const sb = createClient(url, key, {
      db: { schema: "events" },
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await sb.auth.getUser(match[1]);
    return data?.user ? sb : null;
  }
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const sb = createServerClient(url, key, {
    db: { schema: "events" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) store.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  return data?.user ? sb : null;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "");
  const meetingId = String(body.meetingId || "");
  if (!KINDS.has(kind) || !UUID.test(meetingId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const sb = await userClient(request);
  if (!sb) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: meeting, error } = await sb
    .from("meetings")
    .select("id, status, cancelled_by, updated_at")
    .eq("id", meetingId)
    .maybeSingle();
  if (error || !meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });

  // Only notify about a change that just happened and matches the meeting's state.
  const fresh = Date.now() - new Date(meeting.updated_at).getTime() < FRESH_MS;
  const matches =
    (kind === "meeting_cancelled" && meeting.status === "cancelled" && meeting.cancelled_by === "organiser") ||
    (kind !== "meeting_cancelled" && meeting.status === "scheduled");
  if (!fresh || !matches) return NextResponse.json({ ok: false, skipped: true });

  const baseUrl = publicBaseUrl(request);
  after(() => runMeetingNotice({ kind, meetingId }, { baseUrl }));
  return NextResponse.json({ ok: true });
}
