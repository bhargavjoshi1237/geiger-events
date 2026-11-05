import { createServerClient } from "@supabase/ssr";
import { createPay } from "@geiger/pay/server";

import { getDemoStripe, getStripe } from "@/lib/stripe/server";
import { adminClient } from "@/lib/supabase/admin";

// Events sells through each organization's own connected Stripe account; Geiger takes no cut for now.
export const pay = createPay({ app: "events" });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The signed-in user's Supabase client from request cookies, for owner and membership checks.
export async function sessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) cookieStore.set(name, value, options);
      },
    },
  });
}

function requireAdmin() {
  const sb = adminClient();
  if (!sb) throw new Error("Service-role Supabase client is not configured.");
  return sb;
}

export async function projectOrganization(projectId) {
  if (!UUID.test(projectId ?? "")) return null;
  const { data, error } = await requireAdmin()
    .schema("public")
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Load project: ${error.message}`);
  return data?.organization_id || null;
}

// Demo mode runs the project's ticket checkout on Geiger's Stripe sandbox instead of the connected account.
export async function getDemoMode(projectId) {
  if (!UUID.test(projectId ?? "")) return false;
  const { data, error } = await requireAdmin()
    .from("payment_settings")
    .select("demo_mode")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Load payment settings: ${error.message}`);
  return data?.demo_mode === true;
}

export async function saveDemoMode(projectId, demoMode, userId) {
  const { data, error } = await requireAdmin()
    .from("payment_settings")
    .upsert({ project_id: projectId, demo_mode: demoMode, updated_by: userId }, { onConflict: "project_id" })
    .select("demo_mode")
    .single();
  if (error) throw new Error(`Save payment settings: ${error.message}`);
  return data.demo_mode === true;
}

// A ticket checkout's channel travels back on the success URL as `pay=demo` or `pay=acct_…`; absent means a pre-Connect platform session.
export function channelParam(channel) {
  return channel.kind === "demo" ? "demo" : channel.stripeAccount;
}

export function channelFromParam(value) {
  if (value === "demo") return { kind: "demo" };
  if (/^acct_[A-Za-z0-9]+$/.test(value || "")) return { kind: "connected", stripeAccount: value };
  return { kind: "platform" };
}

export function stripeForChannel(channel = { kind: "platform" }) {
  if (channel.kind === "demo") return { stripe: getDemoStripe(), options: undefined };
  if (channel.kind === "connected") return { stripe: getStripe(), options: { stripeAccount: channel.stripeAccount } };
  return { stripe: getStripe(), options: undefined };
}

// Tickets are only issued for a session Geiger itself created for this event's project, on the account it claims.
export async function confirmChannel(session, channel, event) {
  const meta = session?.metadata || {};
  if (channel.kind === "connected") {
    const paymentId = meta.geiger_payment;
    if (!UUID.test(paymentId ?? "") || !event?.projectId) return false;
    const record = await pay.payments.get(paymentId);
    return Boolean(
      record &&
        record.app === pay.app &&
        record.checkout_session_id === session.id &&
        record.stripe_account_id === channel.stripeAccount &&
        record.project_id === event.projectId,
    );
  }
  // A demo session stops issuing tickets the moment the project leaves demo mode.
  if (channel.kind === "demo" || meta.paymentMode === "demo") return getDemoMode(event?.projectId);
  return true;
}
