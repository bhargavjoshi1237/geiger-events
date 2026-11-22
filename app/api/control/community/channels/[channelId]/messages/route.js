import { channelScope } from "@/lib/control/community/scope";
import { chatMessageView, organiserName, parseChatBody, tokenClaims } from "@/lib/control/community/views";
import { withControl } from "@/lib/control/http";
import { must, readJson } from "@/lib/control/scope";
import { ApiError } from "@/lib/staff_access/errors";

// POST { body } — a message from the organiser, signed with their account name as the dashboard signs it.
export async function POST(request, { params }) {
  const { channelId } = await params;
  return withControl(request, async (ctx) => {
    const body = parseChatBody(await readJson(request));
    const { db, row } = await channelScope(ctx, channelId);
    if (row.status === "archived") throw new ApiError("invalid_state", 409, "This chat is archived. Reopen it to post.");
    const saved = must(
      await db
        .from("chat_messages")
        .insert({
          channel_id: channelId,
          author_user_id: ctx.principal.id,
          sender_kind: "organiser",
          author_name: organiserName(tokenClaims(ctx.token)),
          body,
          metadata: {},
        })
        .select("*")
        .single(),
      "community.send",
    );
    return { message: chatMessageView(saved) };
  });
}
