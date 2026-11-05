import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/supabase/admin";
import { BASE_PATH, STATE_PATTERN, browserLoginUrl } from "@/lib/desktop/config";

// Runs in the system browser: signs in on the suite if needed, then hands the desktop app a one-time sign-in token.

async function sessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    // Matches geiger-dash so a token refresh here rewrites the suite's cookie instead of shadowing it.
    cookieOptions: {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) cookieStore.set(name, value, options);
      },
    },
  });
}

// The token travels in the fragment, so it never reaches a server log; the return page strips it and opens the app.
function toReturnPage(params) {
  const fragment = new URLSearchParams(params).toString();
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: `${BASE_PATH}/desktop/return#${fragment}`,
      "Cache-Control": "no-store",
    },
  });
}

async function mintSignInToken(email) {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) {
    console.error("[desktop.handoff] mint", error?.message || "no hashed_token");
    return null;
  }
  return data.properties.hashed_token;
}

export async function GET(request) {
  const state = new URL(request.url).searchParams.get("state") || "";
  if (!STATE_PATTERN.test(state)) return toReturnPage({ error: "invalid_state" });

  const supabase = await sessionClient();
  if (!supabase) return toReturnPage({ error: "unavailable", state });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return NextResponse.redirect(browserLoginUrl(state));

  const email = String(user.email || "").trim().toLowerCase();
  const tokenHash = email ? await mintSignInToken(email) : null;
  if (!tokenHash) return toReturnPage({ error: "mint_failed", state });

  return toReturnPage({ token_hash: tokenHash, type: "magiclink", state, email });
}
