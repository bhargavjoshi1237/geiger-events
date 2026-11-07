import { meetingIcsByToken } from "@/lib/portal/meetings";

// Add-to-calendar file linked from meeting emails; the meeting's calendar token is the bearer secret.
export async function GET(request, { params }) {
  const { token } = await params;
  const file = await meetingIcsByToken(String(token || "").replace(/\.ics$/i, ""));
  if (!file) return new Response("Meeting not found.", { status: 404 });
  return new Response(file.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
