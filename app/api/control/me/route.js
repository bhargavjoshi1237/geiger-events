import { controlBoundary, ensureMembership } from "@/lib/control/boundary";
import { withControl } from "@/lib/control/http";
import { loadControlProfile } from "@/lib/control/profile";

// Every project this team member can operate, with their role and which Control tools it unlocks.
export async function GET(request) {
  return withControl(request, async ({ principal, token }) =>
    loadControlProfile({
      principal,
      boundary: await controlBoundary(),
      ensureMembership: (projectId) => ensureMembership(token, projectId),
    }),
  );
}
