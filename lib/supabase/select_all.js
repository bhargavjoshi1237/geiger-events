// Pages a PostgREST select past the server's max_rows cap (1000 on Supabase). `build` returns a fresh, ordered query.
export async function selectAll(build, { page = 1000, max = 100000 } = {}) {
  const rows = [];
  for (let from = 0; from < max; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return { data: rows, error: null };
}
