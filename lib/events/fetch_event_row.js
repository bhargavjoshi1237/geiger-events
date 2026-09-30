// Server-side anonymous read of one event row for the ISR public routes (/e/[id] and its sub-pages).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchEventRow(id, { revalidate = 10 } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !UUID.test(String(id || ""))) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/events?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Accept-Profile": "events",
        },
        next: { revalidate },
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (err) {
    console.error("[e/:id] server read failed", err);
    return null;
  }
}
