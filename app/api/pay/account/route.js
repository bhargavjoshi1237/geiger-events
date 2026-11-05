import { ACCOUNT_STATUS, CONNECT_COUNTRIES } from "@geiger/pay";
import { PayError, serializePayError } from "@geiger/pay/server";

import { getDemoMode, pay, projectOrganization, saveDemoMode, sessionClient } from "@/lib/pay/server";
import { isDemoConfigured } from "@/lib/stripe/server";

// Stripe reviews accounts after onboarding; re-check an unfinished one at most once a minute.
const RESYNC_AFTER_MS = 60_000;

function isStale(account) {
  if (account.status !== ACCOUNT_STATUS.ACTION_REQUIRED && account.status !== ACCOUNT_STATUS.PENDING) return false;
  return !account.syncedAt || Date.now() - new Date(account.syncedAt).getTime() > RESYNC_AFTER_MS;
}

// Every call is scoped to a project whose organization the signed-in user belongs to; owner-only steps check `pay.can_manage`.
async function withProject(projectId, work) {
  try {
    const session = await sessionClient();
    if (!session) throw new PayError("supabase_unconfigured", "Sign-in is unavailable right now.", { status: 503 });
    const { data: auth } = await session.auth.getUser();
    if (!auth?.user) throw new PayError("unauthorized", "Sign in to continue.", { status: 401 });

    const organizationId = await projectOrganization(projectId);
    if (!organizationId) throw new PayError("not_found", "This project isn't part of an organization.", { status: 404 });
    const { data: member, error } = await session.rpc("is_org_member", { target_org: organizationId });
    if (error) throw new PayError("store_error", `Check organization access: ${error.message}`, { status: 500 });
    if (member !== true) throw new PayError("forbidden", "You're not a member of this organization.", { status: 403 });

    return Response.json(await work({ session, user: auth.user, organizationId }));
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || 500;
    if (status >= 500) console.error("[pay/account]", error);
    return Response.json({ error: serializePayError(error) }, { status: Math.min(Math.max(status, 400), 599) });
  }
}

function requireStripe() {
  if (!pay.configured) {
    throw new PayError("stripe_unconfigured", "Stripe isn't set up for Geiger Events yet.", { status: 503 });
  }
}

async function canManage(session, organizationId) {
  const { data, error } = await session.schema("pay").rpc("can_manage", { target_org: organizationId });
  if (error) throw new PayError("store_error", `Check payment permissions: ${error.message}`, { status: 500 });
  return data === true;
}

async function readJson(request) {
  return request.json().catch(() => ({}));
}

// The Stripe return and refresh links come back to the screen that started onboarding, on this site only.
function returnUrlFrom(request, value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new PayError("invalid_request", "Missing the page to return to after Stripe.");
  }
  if (url.origin !== request.headers.get("origin")) {
    throw new PayError("invalid_request", "Stripe can only return you to this site.");
  }
  url.hash = "";
  url.searchParams.delete("stripe");
  return (step) => {
    const next = new URL(url);
    next.searchParams.set("stripe", step);
    return next.toString();
  };
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  return withProject(projectId, async ({ session, organizationId }) => {
    let account = pay.configured ? await pay.accounts.summary(organizationId) : { status: ACCOUNT_STATUS.NOT_CONNECTED };
    if (account.id && (params.get("refresh") === "1" || isStale(account))) {
      account = await pay.accounts.refresh(organizationId).catch((error) => {
        console.error("[pay/account] refresh", error);
        return account;
      });
    }
    return {
      account,
      canManage: await canManage(session, organizationId),
      stripeConfigured: pay.configured,
      demoMode: await getDemoMode(projectId),
      demoAvailable: isDemoConfigured(),
    };
  });
}

export async function POST(request) {
  const body = await readJson(request);
  return withProject(body.projectId, async ({ session, organizationId }) => {
    requireStripe();
    const country = String(body.country || "").toUpperCase();
    if (!CONNECT_COUNTRIES.some((item) => item.code === country)) {
      throw new PayError("invalid_request", "Choose the country your business is based in.");
    }
    const returnTo = returnUrlFrom(request, body.returnUrl);
    const { data: org } = await session
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    const { url } = await pay.accounts.startOnboarding({
      session,
      organizationId,
      country,
      displayName: org?.name || undefined,
      returnUrl: returnTo("return"),
      refreshUrl: returnTo("refresh"),
    });
    return { url };
  });
}

export async function PATCH(request) {
  const body = await readJson(request);
  return withProject(body.projectId, async ({ organizationId }) => {
    requireStripe();
    return { account: await pay.accounts.refresh(organizationId) };
  });
}

export async function DELETE(request) {
  const body = await readJson(request);
  return withProject(body.projectId, async ({ session, organizationId }) => {
    requireStripe();
    return { account: await pay.accounts.disconnect({ session, organizationId }) };
  });
}

// Demo mode decides whether ticket sales take real money, so like connecting Stripe it's owner-only.
export async function PUT(request) {
  const body = await readJson(request);
  return withProject(body.projectId, async ({ session, user, organizationId }) => {
    if (typeof body.demoMode !== "boolean") throw new PayError("invalid_request", "`demoMode` must be true or false.");
    if (!(await canManage(session, organizationId))) {
      throw new PayError("forbidden", "Only organization owners can change demo mode.", { status: 403 });
    }
    if (body.demoMode && !isDemoConfigured()) {
      throw new PayError("demo_unavailable", "Geiger's demo sandbox isn't configured.", { status: 503 });
    }
    return { demoMode: await saveDemoMode(body.projectId, body.demoMode, user.id) };
  });
}
