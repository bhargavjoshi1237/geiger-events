import { PortalRoute } from "@/components/workspace_portal/shell/portal_route";

export const dynamic = "force-dynamic";

// Every portal address: a page, a record (/r/<list>/<number>), sign-in or an invite link.
export default async function WorkspacePortalPage({ params, searchParams }) {
  const { slug = [] } = await params;
  const search = await searchParams;
  const one = (value) => (typeof value === "string" ? value : null);
  return <PortalRoute slug={slug.map((part) => decodeURIComponent(part))} token={one(search?.token)} next={one(search?.next)} />;
}
