import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/portal/session";

export async function GET() {
  const member = await getSessionMember();
  return NextResponse.json({ member: member || null });
}
