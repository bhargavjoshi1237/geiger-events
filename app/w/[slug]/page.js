import WallClient from "./wall_client";

// Standalone published Event Wall, reachable at /w/<slug> — the public hub
// listing every event an organizer has marked listable. This server wrapper
// resolves SEO/OG metadata for the shared link; the interactive listing renders
// in the client child (WallClient), mirroring app/e/[id].

// Minimal server-side read of the wall's public branding for <head> tags. Uses a
// plain PostgREST GET with the anon key (RLS allows public read of the wall) —
// no browser client, so it's safe on the server. Degrades to null on any
// failure or when Supabase isn't configured; the page still renders.
async function fetchWallMeta(slug) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !slug) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/event_wall?slug=eq.${encodeURIComponent(slug)}&select=name,tagline,logo_url&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          // The wall lives in the `events` schema, not `public`.
          "Accept-Profile": "events",
        },
        // Public branding changes rarely; a short revalidate keeps OG fresh
        // without hitting the DB on every crawl.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const wall = await fetchWallMeta(slug);
  const name = wall?.name || "Events";
  const description =
    wall?.tagline || `Upcoming events from ${wall?.name || "our team"}.`;
  const images = wall?.logo_url ? [wall.logo_url] : [];
  return {
    title: `${name} — Events`,
    description,
    openGraph: {
      title: `${name} — Events`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: `${name} — Events`,
      description,
      images,
    },
  };
}

export default async function EventWallPage({ params }) {
  const { slug } = await params;
  return <WallClient slug={slug} />;
}
