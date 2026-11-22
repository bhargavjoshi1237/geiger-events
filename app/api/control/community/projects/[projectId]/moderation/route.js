import { COMMUNITY_KEY } from "@/lib/control/community/scope";
import { parseReportResolve, postView, reportView, topicView } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, projectScope, readJson } from "@/lib/control/scope";

// GET — the boards' moderation queue: topics and replies awaiting approval, and member reports.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await projectScope(ctx, projectId, COMMUNITY_KEY);
    const [topics, posts, reports] = await Promise.all([
      db
        .from("board_topics")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
        .then((r) => must(r, "community.pendingTopics")),
      db
        .from("board_posts")
        .select("*, topic:board_topics(*)")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200)
        .then((r) => must(r, "community.pendingPosts")),
      db
        .from("board_reports")
        .select("*, topic:board_topics(*), post:board_posts(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(300)
        .then((r) => must(r, "community.reports")),
    ]);
    return { topics: topics.map(topicView), posts: posts.map(postView), reports: reports.map(reportView) };
  });
}

// POST { ids, status: "actioned" | "dismissed" } — closes reports, stamping who resolved them.
export async function POST(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { ids, status } = parseReportResolve(await readJson(request));
    const { db } = await projectScope(ctx, projectId, COMMUNITY_KEY);
    const rows = must(
      await db
        .from("board_reports")
        .update({ status, resolved_by: ctx.principal.id, resolved_at: new Date().toISOString() })
        .in("id", ids)
        .eq("project_id", projectId)
        .select("id"),
      "community.resolveReports",
    );
    return { resolved: rows.length };
  });
}
