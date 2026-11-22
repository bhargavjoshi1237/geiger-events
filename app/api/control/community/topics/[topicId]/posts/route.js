import { deliverBoardEmails } from "@/lib/portal/boards";
import { topicScope } from "@/lib/control/community/scope";
import { organiserName, parseReply, postView, tokenClaims } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { body, parentPostId? } — an organiser reply, published at once, then the queued reply emails go out.
export async function POST(request, { params }) {
  const { topicId } = await params;
  return withControl(request, async (ctx) => {
    const input = parseReply(await readJson(request));
    const { db } = await topicScope(ctx, topicId);
    if (input.parentPostId) {
      const parent = must(
        await db.from("board_posts").select("id").eq("id", input.parentPostId).eq("topic_id", topicId).maybeSingle(),
        "community.replyParent",
      );
      if (!parent) throw new ApiError("not_found", 404, "That reply isn't in this topic.");
    }
    const claims = tokenClaims(ctx.token);
    const saved = must(
      await db
        .from("board_posts")
        .insert({
          topic_id: topicId,
          parent_post_id: input.parentPostId,
          author_kind: "organiser",
          author_user_id: ctx.principal.id,
          author_name: organiserName(claims),
          author_email: typeof claims.email === "string" ? claims.email : "",
          body: input.body,
          status: "published",
        })
        .select("*")
        .single(),
      "community.reply",
    );
    await deliverBoardEmails({ topicId, origin: new URL(request.url).origin }).catch(() => null);
    return { post: postView(saved) };
  });
}
