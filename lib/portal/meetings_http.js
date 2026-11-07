import { after, NextResponse } from "next/server";

import { getSessionMember } from "@/lib/portal/session";
import { publicBaseUrl, runMeetingNotice } from "@/lib/meetings/notify";

// Shared plumbing for the /api/portal/meetings routes: session check, error mapping, deferred notices.

export async function withMember(work) {
  const member = await getSessionMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return work(member);
}

export function reply(request, result) {
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }
  const { notice, ...body } = result || {};
  if (notice) {
    const baseUrl = publicBaseUrl(request);
    after(() => runMeetingNotice(notice, { baseUrl }));
  }
  return NextResponse.json(body);
}

export async function readBody(request) {
  return request.json().catch(() => ({}));
}
