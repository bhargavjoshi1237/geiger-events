import { COMMUNITY_KEY } from "@/lib/control/community/scope";
import { boardView, topicView, TOPIC_STATUSES } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { requireId } from "@/lib/control/ids";
import { must, projectScope } from "@/lib/control/scope";

// GET ?board=&status= — the project's boards and their topics, most recent activity first.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const { db } = await projectScope(ctx, projectId, COMMUNITY_KEY);
    const query = new URL(request.url).searchParams;
    let topics = db.from("board_topics").select("*").eq("project_id", projectId).is("deleted_at", null);
    const board = query.get("board");
    if (board) topics = topics.eq("board_id", requireId(board));
    const status = query.get("status");
    if (TOPIC_STATUSES.includes(status)) topics = topics.eq("status", status);
    const [boards, rows] = await Promise.all([
      db
        .from("boards")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .then((r) => must(r, "community.boards")),
      topics.order("last_activity_at", { ascending: false }).limit(300).then((r) => must(r, "community.topics")),
    ]);
    return { boards: boards.map(boardView), topics: rows.map(topicView) };
  });
}
