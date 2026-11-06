// Published geiger.studio feature and solution pages for Events, grouped for the landing page's guide index.
// Plain REST like product badges: the pages live in the public schema next to the dash, not in this app's schema.
const PRODUCT = "geiger-events";
// The dash publishes from its studio, so an hour is soon enough for a new page to appear here.
const REVALIDATE_SECONDS = 3600;

const pathFor = (row) => `/${row.page_type === "feature" ? "features" : "solutions"}/events/${row.slug}`;
const toLink = (row) => ({ title: row.title, href: pathFor(row) });

// { features, useCases, compare } as lists of { title, href }, or null if the read fails so the section hides.
export async function getEventGuides() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(
      `${url}/rest/v1/dash_seo_pages?select=page_type,slug,title&product=eq.${PRODUCT}&is_published=is.true&page_type=in.(feature,solution)&order=title`,
      { headers: { apikey: key, "Accept-Profile": "public" }, next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!response.ok) return null;
    const rows = await response.json();
    const solutions = rows.filter((row) => row.page_type === "solution");
    return {
      features: rows.filter((row) => row.page_type === "feature").map(toLink),
      useCases: solutions.filter((row) => !row.slug.endsWith("-alternative")).map(toLink),
      compare: solutions.filter((row) => row.slug.endsWith("-alternative")).map(toLink),
    };
  } catch {
    return null;
  }
}
