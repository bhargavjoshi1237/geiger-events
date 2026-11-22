import { getOrgEntitlements, isProductUnlocked, normalizeOrgDomain } from "@/lib/supabase/domains";
import { withControl } from "@/lib/control/http";
import { must, projectPermissions } from "@/lib/control/scope";
import { TEAM_KEYS, requireAllowed } from "@/lib/control/team/keys";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "geiger.studio";
const CNAME_TARGET = "custom.events.geiger.events";

// GET — the organisation's subdomain and whether its plan includes subdomains and custom domains; changes stay on the dashboard.
export async function GET(request, { params }) {
  const { projectId } = await params;
  return withControl(request, async (ctx) => {
    const access = await projectPermissions(ctx, projectId, [TEAM_KEYS.view]);
    requireAllowed(access, TEAM_KEYS.view, "Your role can't see domains.");
    const pub = access.db.schema("public");
    const project = must(await pub.from("projects").select("organization_id").eq("id", projectId).is("deleted_at", null).maybeSingle(), "team.domainProject");
    const empty = { organization: null, subdomainAddon: false, customDomainAddon: false, subdomain: null, rootDomain: ROOT_DOMAIN, cnameTarget: CNAME_TARGET };
    if (!project?.organization_id) return empty;
    const org = must(await pub.from("organizations").select("id,name,metadata").eq("id", project.organization_id).is("deleted_at", null).maybeSingle(), "team.domainOrg");
    if (!org) return empty;
    const entitlements = getOrgEntitlements(org);
    const subdomainAddon = isProductUnlocked(entitlements, "subdomain");
    // RLS may hide the domain row from non-owners; that reads as "none set" rather than an error.
    const domain = subdomainAddon
      ? await pub.from("org_domains").select("*").eq("organization_id", org.id).eq("type", "subdomain").is("deleted_at", null).maybeSingle()
      : { data: null };
    const row = domain.error ? null : normalizeOrgDomain(domain.data);
    return {
      ...empty,
      organization: { id: org.id, name: org.name ?? "" },
      subdomainAddon,
      customDomainAddon: isProductUnlocked(entitlements, "domain"),
      subdomain: row ? { name: row.subdomain, address: `${row.subdomain}.${ROOT_DOMAIN}`, status: row.status, verified: row.verified } : null,
    };
  });
}
