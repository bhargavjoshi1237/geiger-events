import { setMemberBoardEmail, withMember } from "@/lib/portal/boards";

// boardEmail: true / false overrides the board default; null clears the member's preference.
export async function POST(request) {
  const { boardEmail } = await request.json().catch(() => ({}));
  return withMember((member) =>
    setMemberBoardEmail(member, typeof boardEmail === "boolean" ? boardEmail : null),
  );
}
