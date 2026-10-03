// Runs every migration, the seed and the SQL integrity tests against an
// in-process Postgres (PGlite). No Docker or Supabase CLI needed.
//   node scripts/db-check.mjs            -> migrations + seed + tests
//   node scripts/db-check.mjs --no-seed  -> migrations + tests only
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const withSeed = !process.argv.includes("--no-seed");

// Minimal stand-ins for what Supabase provides.
const SUPABASE_SHIM = `
  create schema if not exists auth;
  create schema if not exists extensions;
  create table if not exists auth.users (id uuid primary key, email text, phone text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      current_setting('request.jwt.claim.sub', true)), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
`;

async function runFile(db, path) {
  const sql = readFileSync(path, "utf8");
  const t = Date.now();
  try {
    await db.exec(sql);
    console.log(`  ok   ${path.split(/[\\/]/).slice(-2).join("/")} (${Date.now() - t}ms)`);
  } catch (e) {
    console.error(`  FAIL ${path}\n       ${e.message}`);
    if (e.position) {
      const pos = Number(e.position);
      console.error("       near: " + sql.slice(Math.max(0, pos - 200), pos + 100).replace(/\n/g, "\n             "));
    }
    if (e.where) console.error("       where: " + e.where);
    process.exit(1);
  }
}

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
await db.exec(SUPABASE_SHIM);

const migDir = join(root, "supabase", "migrations");
console.log("migrations:");
for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  await runFile(db, join(migDir, f));
}
if (withSeed && existsSync(join(root, "supabase", "seed.sql"))) {
  console.log("seed:");
  await runFile(db, join(root, "supabase", "seed.sql"));
}
const testDir = join(root, "supabase", "tests");
if (existsSync(testDir)) {
  console.log("tests:");
  for (const f of readdirSync(testDir).filter((f) => f.endsWith(".sql")).sort()) {
    await runFile(db, join(testDir, f));
  }
}
if (process.argv.includes("--summary")) {
  const r = await db.query(`select
    (select count(*) from public.journal_entries) entries,
    (select count(*) from public.stock_movements) movements,
    (select count(*) from public.sales) sales,
    (select count(*) from public.product_variants) variants`);
  console.table(r.rows);
}
console.log("db-check passed");
