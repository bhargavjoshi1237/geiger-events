import { getBoardForMember, withMember } from "@/lib/portal/boards";

// One board's topics. Query: sort=latest|top|new, q=search, tag=tag.
export async function GET(request, { params }) {
  const { boardId } = await params;
  const sp = new URL(request.url).searchParams;
  return withMember((member) =>
    getBoardForMember(member, boardId, {
      sort: sp.get("sort") || "latest",
      q: sp.get("q") || "",
      tag: sp.get("tag") || "",
    }),
  );
}
