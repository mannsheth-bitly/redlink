// Runs the acceptance suites, re-seeding the demo database before each script (they expect fresh data).
// Needs the app running: `npm run dev` (API on :4000, React on :5173).
//   npm run test:api   → API checks for Phases 1–6
//   npm run test:ui    → browser checks (first time: npx playwright install chromium)
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const suite = process.argv[2] ?? "api";
const UI_BASE = process.env.UI_BASE ?? "http://localhost:5173";
const scripts =
  suite === "ui"
    ? ["ui/smoke.mjs", "ui/admin6.mjs", "ui/sweep.mjs"]
    : ["api/p1.mjs", "api/p2.mjs", "api/p3.mjs", "api/p4.mjs", "api/p5.mjs", "api/p6.mjs"];

const failed = [];
for (const s of scripts) {
  const seed = spawnSync("npm", ["run", "db:seed"], { cwd: ROOT, shell: true, encoding: "utf8" });
  if (seed.status !== 0) {
    console.error(seed.stdout, seed.stderr);
    process.exit(1);
  }
  console.log(`\n=== ${s} ===`);
  const run = spawnSync(process.execPath, [path.join(import.meta.dirname, s), ...(suite === "ui" ? [UI_BASE] : [])], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (run.status !== 0) failed.push(s);
}
console.log(failed.length ? `\nFAILED: ${failed.join(", ")}` : `\nAll ${scripts.length} ${suite.toUpperCase()} suites passed.`);
process.exitCode = failed.length ? 1 : 0;
