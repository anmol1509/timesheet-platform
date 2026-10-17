// Applies pending Prisma migrations as part of a production deploy, before the app is built.
//
// - Production only: preview builds (pull requests) skip it, so a branch can never change the live
//   database. Set RUN_MIGRATIONS=1 to run it somewhere else on purpose.
// - Uses the direct (non-pooled) connection when there is one: migrations take a lock that a pooled
//   connection cannot hold.
// - Fails the build if a migration fails. The previous deployment then stays live and the database is
//   left as it was (each migration runs in its own transaction).
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env !== "production" && process.env.RUN_MIGRATIONS !== "1") {
  console.log(`[migrate] Skipped (VERCEL_ENV=${env ?? "unset"}). Migrations only run on production deploys.`);
  process.exit(0);
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] No database URL (POSTGRES_URL_NON_POOLING or DATABASE_URL). Not building, so the live site stays on the old version.");
  process.exit(1);
}

console.log(`[migrate] Applying pending migrations (${process.env.POSTGRES_URL_NON_POOLING ? "direct connection" : "DATABASE_URL"})…`);
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
  timeout: 5 * 60 * 1000, // a migration stuck on a lock must not hang the build
});

if (result.error || result.status !== 0) {
  console.error("[migrate] Migration failed" + (result.error ? `: ${result.error.message}` : "") + ". The build was stopped; the database was not left half-changed and the previous deployment stays live.");
  process.exit(result.status || 1);
}
console.log("[migrate] Done.");
