"use client";

import { createBrowserClient } from "@supabase/ssr";

// Same cookie options as geiger-dash, so the desktop sign-in writes the exact session cookie the suite gate reads.
export function createDesktopClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
