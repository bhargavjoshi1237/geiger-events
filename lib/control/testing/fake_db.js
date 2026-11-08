// Test-only stand-in for a supabase-js client: chainable filters over in-memory rows, plus canned rpc results.
export function fakeDb({ tables = {}, rpc = {}, errors = {} } = {}) {
  return {
    async rpc(name, args) {
      if (errors[name]) return { data: null, error: errors[name] };
      return { data: rpc[name] ? rpc[name](args) : [], error: null };
    },
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column, values) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        is(column, value) {
          filters.push((row) => (row[column] ?? null) === value);
          return query;
        },
        then(resolve, reject) {
          const result = errors[table]
            ? { data: null, error: errors[table] }
            : { data: (tables[table] || []).filter((row) => filters.every((f) => f(row))), error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
