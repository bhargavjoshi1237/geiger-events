import { listBoardsForMember, withMember } from "@/lib/portal/boards";

// The boards this member can see, with new-activity counts and their email preference.
export async function GET() {
  return withMember((member) => listBoardsForMember(member));
}
