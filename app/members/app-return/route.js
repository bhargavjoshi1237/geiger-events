// Bounces a Stripe Checkout return back into the members mobile app. Stripe only
// accepts http(s) return URLs, so membership checkout returns here and this
// redirects to the app's custom scheme, which the in-app auth session intercepts
// and closes. Query params (membership_session / membership_canceled) pass through.
export async function GET(request) {
  const params = new URL(request.url).searchParams.toString();
  const location = `geigerevents://membership-return${params ? `?${params}` : ""}`;
  return new Response(null, { status: 307, headers: { Location: location } });
}
