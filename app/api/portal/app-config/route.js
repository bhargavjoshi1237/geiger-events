import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSessionMember } from "@/lib/portal/session";
import { listMemberProjectIds } from "@/lib/portal/memberships";
import { mergeForMember } from "@/lib/app_config/model";

// The shared app's sections + home, merged across every project the member holds tickets or memberships with.
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const projectIds = await listMemberProjectIds(member.email);
  const configured = new Map();
  const sb = adminClient();
  if (sb && projectIds.length) {
    const { data, error } = await sb
      .from("app_configs")
      .select("project_id, config")
      .in("project_id", projectIds);
    // A failed read leaves every project on defaults, so nothing disappears from the app by accident.
    if (error) console.error("[portal.app-config]", error.message);
    for (const row of data || []) configured.set(row.project_id, row.config);
  }

  return NextResponse.json(mergeForMember(projectIds.map((id) => configured.get(id) ?? null)));
}
