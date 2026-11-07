import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { deliverBoardEmails } from "@/lib/portal/boards";

// Organiser-triggered send of queued reply emails for one topic (after replying or approving from the dashboard).
// The caller's own Supabase session must be able to read the topic through RLS, so it only reaches their projects.
async function organiserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    db: { schema: "events" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) store.set(name, value, options);
      },
    },
  });
}

export async function POST(request) {
  const { topicId } = await request.json().catch(() => ({}));
  if (!topicId) return NextResponse.json({ error: "Missing topic." }, { status: 400 });

  const sb = await organiserClient();
  if (!sb) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: topic } = await sb.from("board_topics").select("id").eq("id", topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const result = await deliverBoardEmails({ topicId, origin: new URL(request.url).origin });
  return NextResponse.json(result);
}
