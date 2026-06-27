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

const SQL_DIR = "supabase/sqls";

function getSqlFiles() {
  const dir = path.join(process.cwd(), SQL_DIR);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => `${SQL_DIR}/${file}`);
}

const SQL_FILES = getSqlFiles();

function extractTableName(stmt) {
  const match = stmt.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/i,
  );
  return match ? match[1] : null;
}

function extractIndexName(stmt) {
  const match = stmt.match(
    /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)/i,
  );
  return match ? match[1] : null;
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

async function tableExists(client, tableName) {
  const res = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return res.rows[0].exists;
}

async function indexExists(client, indexName) {
  const res = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
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
    console.log("Connected to database.\n");

    // NOTE: this Supabase project is SHARED across the Geiger suite, so a
    // blanket "drop all flow_* tables" (as geiger-flow does) would destroy other
    // apps' data. --clean here is deliberately scoped to this app's own table.
    if (process.argv.includes("--clean")) {
      console.log("Dropping public.flow_events (events app only)...");
      await client.query("DROP TABLE IF EXISTS public.flow_events CASCADE");
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
        const tableName = extractTableName(stmt);
        const indexName = extractIndexName(stmt);

        if (
          tableName &&
          /^create\s+table\s+/i.test(stmt) &&
          (await tableExists(client, tableName))
        ) {
          console.log(`  SKIP (exists): table ${tableName}`);
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
          const label = tableName
            ? `table ${tableName}`
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
