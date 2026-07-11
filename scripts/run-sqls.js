require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Mirrors geiger-flow's scripts/run-sqls.js. Executes every supabase/sqls/*.sql
// in filename order against the project in STRING_URI. Statements are split on
// top-level `;` (dollar-quoted function bodies are kept intact), `create table`
// / `create index` are made idempotent and skipped when they already exist, and
// everything else (alter/policy/trigger/insert…) re-runs safely because the SQL
// files are written idempotently. Add a feature → drop a new .sql in the folder
// and re-run `node scripts/run-sqls.js`.

const STRING_URI = process.env.STRING_URI;

if (!STRING_URI) {
  console.error("ERROR: STRING_URI environment variable is not set.");
  process.exit(1);
}

// --articles pushes ONLY the SEO/marketing page inserts under supabase/articles
// (nested by page type) into public.dash_seo_pages — nothing from supabase/sqls.
// Every article file is an idempotent `insert … on conflict (page_type, slug) do
// nothing`, so re-running never duplicates a page.
const ARTICLES_MODE = process.argv.includes("--articles");
const SQL_DIR = ARTICLES_MODE ? "supabase/articles" : "supabase/sqls";

function walkSqlFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkSqlFiles(full));
    } else if (entry.name.endsWith(".sql")) {
      files.push(full);
    }
  }
  return files;
}

function getSqlFiles() {
  const dir = path.join(process.cwd(), SQL_DIR);
  if (!fs.existsSync(dir)) {
    return [];
  }
  // Articles live in subfolders (solutions/, core-features/, features/) so walk
  // recursively; the plain sqls dir is flat. Sort by repo-relative path so order
  // is stable and deterministic.
  const found = ARTICLES_MODE
    ? walkSqlFiles(dir)
    : fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".sql"))
        .map((file) => path.join(dir, file));
  return found
    .map((file) => path.relative(process.cwd(), file).split(path.sep).join("/"))
    .sort();
}

const SQL_FILES = getSqlFiles();

function extractTableName(stmt) {
  // Captures an optional schema qualifier so events.* tables are checked in the
  // right schema (defaults to public when unqualified).
  const match = stmt.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)/i,
  );
  if (!match) return null;
  return { schema: match[1] || "public", name: match[2] };
}

function extractIndexName(stmt) {
  const match = stmt.match(
    /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)/i,
  );
  return match ? match[1] : null;
}

// --- Articles constraint + preflight -----------------------------------------
// Pages nest under /<type>/<product>/<slug>, so dash_seo_pages is unique on
// (product, page_type, slug) and the article inserts target that key. This
// ensures the matching unique index exists (replacing the older (page_type,
// slug) one) so `on conflict (product, page_type, slug)` resolves. Idempotent.
const ARTICLE_PRODUCT = "geiger-events";

function articleTypeFromPath(file) {
  return file.includes("/solutions/") ? "solution" : "feature";
}

function articleSlugFromPath(file) {
  return path.basename(file, ".sql");
}

async function ensureArticlesConstraint(client) {
  try {
    await client.query("drop index if exists public.idx_seo_pages_type_slug");
    await client.query(
      "create unique index if not exists idx_seo_pages_product_type_slug on public.dash_seo_pages (product, page_type, slug)",
    );
    console.log(
      "Constraint: unique (product, page_type, slug) ensured on public.dash_seo_pages.\n",
    );
  } catch (err) {
    console.log(`Constraint step warning: ${err.message}\n`);
  }
}

// With product in the unique key a slug can never collide across products, so
// this is purely informational: how many pages are new vs already Events-owned
// (an idempotent re-run). Type comes from the folder, slug from the filename.
async function articlesPreflight(client) {
  let rows;
  try {
    ({ rows } = await client.query(
      "select page_type, slug, product from public.dash_seo_pages where product = $1",
      [ARTICLE_PRODUCT],
    ));
  } catch (err) {
    console.log(
      `Preflight skipped (couldn't read public.dash_seo_pages: ${err.message}).\n`,
    );
    return;
  }

  const existing = new Set();
  for (const r of rows) existing.add(`${r.page_type}::${r.slug}`);

  let fresh = 0;
  let ownedByUs = 0;
  for (const file of SQL_FILES) {
    const key = `${articleTypeFromPath(file)}::${articleSlugFromPath(file)}`;
    if (existing.has(key)) ownedByUs++;
    else fresh++;
  }

  console.log(
    `Preflight: ${fresh} new, ${ownedByUs} already Events-owned (idempotent re-run).\n`,
  );
}

function addIfNotExists(stmt) {
  if (/^create\s+table\s+/i.test(stmt) && !/if\s+not\s+exists/i.test(stmt)) {
    return stmt.replace(/create\s+table\s+/i, "create table if not exists ");
  }
  if (
    /^create\s+(?:unique\s+)?index\s+/i.test(stmt) &&
    !/if\s+not\s+exists/i.test(stmt)
  ) {
    return stmt.replace(/create\s+(?:unique\s+)?index\s+/i, "$&if not exists ");
  }
  return stmt;
}

function stripLeadingComments(stmt) {
  const lines = stmt.split("\n");
  let i = 0;
  while (
    i < lines.length &&
    (lines[i].trim() === "" || lines[i].trim().startsWith("--"))
  ) {
    i++;
  }
  return lines.slice(i).join("\n").trim();
}

function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === "$") {
      const tagMatch = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i += tag.length;
          continue;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          current += tag;
          i += tag.length;
          dollarTag = "";
          continue;
        }
      }
    }

    if (sql[i] === ";" && !inDollarQuote) {
      current += ";";
      const code = stripLeadingComments(current);
      if (code) {
        statements.push(code);
      }
      current = "";
      i++;
      continue;
    }

    if (sql[i] === "-" && sql[i + 1] === "-" && !inDollarQuote) {
      const lineEnd = sql.indexOf("\n", i);
      if (lineEnd === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, lineEnd + 1);
      i = lineEnd + 1;
      continue;
    }

    current += sql[i];
    i++;
  }

  const code = stripLeadingComments(current);
  if (code) {
    statements.push(code);
  }

  return statements;
}

async function tableExists(client, schema, tableName) {
  const res = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2
     ) AS exists`,
    [schema, tableName],
  );
  return res.rows[0].exists;
}

async function indexExists(client, indexName) {
  // Index names are unique per schema; match by name across any schema so
  // events.* indexes are detected too.
  const res = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes WHERE indexname = $1
     ) AS exists`,
    [indexName],
  );
  return res.rows[0].exists;
}

async function run() {
  const client = new Client({
    connectionString: STRING_URI,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.");
    console.log(
      ARTICLES_MODE
        ? `Mode: --articles (SEO pages → public.dash_seo_pages, ${SQL_FILES.length} file(s))\n`
        : `Mode: schema (${SQL_DIR}, ${SQL_FILES.length} file(s))\n`,
    );

    if (ARTICLES_MODE) {
      await ensureArticlesConstraint(client);
      await articlesPreflight(client);
    }

    // NOTE: this Supabase project is SHARED across the Geiger suite, so a
    // blanket "drop all flow_* tables" (as geiger-flow does) would destroy other
    // apps' data. --clean here is deliberately scoped to this app's own tables,
    // which live in the dedicated `events` schema.
    if (process.argv.includes("--clean") && !ARTICLES_MODE) {
      console.log("Dropping events.* app tables (events app only)...");
      await client.query(`
        drop table if exists
          events.event_orders,
          events.event_notes,
          events.registrations,
          events.registration_forms,
          events.event_templates,
          events.events,
          events.event_series
        cascade`);
      console.log("Clean complete.\n");
    }

    for (const file of SQL_FILES) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${file}`);
        continue;
      }

      console.log(`\n========== ${file} ==========`);
      const sql = fs.readFileSync(filePath, "utf-8");
      const statements = splitStatements(sql);

      for (const rawStmt of statements) {
        const stmt = addIfNotExists(rawStmt);
        const table = extractTableName(stmt);
        const tableLabel = table ? `${table.schema}.${table.name}` : null;
        const indexName = extractIndexName(stmt);

        if (
          table &&
          /^create\s+table\s+/i.test(stmt) &&
          (await tableExists(client, table.schema, table.name))
        ) {
          console.log(`  SKIP (exists): table ${tableLabel}`);
          continue;
        }

        if (
          indexName &&
          /^create\s+(?:unique\s+)?index\s+/i.test(stmt) &&
          (await indexExists(client, indexName))
        ) {
          console.log(`  SKIP (exists): index ${indexName}`);
          continue;
        }

        try {
          await client.query(stmt);
          const label = tableLabel
            ? `table ${tableLabel}`
            : indexName
              ? `index ${indexName}`
              : stmt.slice(0, 80).replace(/\n/g, " ");
          console.log(`  OK: ${label}`);
        } catch (err) {
          console.error("Statement error:");
          console.error(err);
        }
      }
    }

    console.log("\nDone.");
  } catch (err) {
    console.error("Fatal error:");
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
