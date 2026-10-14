// Phase 6 UI checks in headless Chromium (fresh seed). Usage: node admin6.mjs http://localhost:5173
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:5173";
const SHOTS = path.join(import.meta.dirname, "shots");
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const browser = await chromium.launch();
const consoleErrors = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/tile\.openstreetmap|net::ERR/i.test(m.text())) consoleErrors.push(`[console] ${page.url()} ${m.text()}`);
    if (m.type() === "warning" && /recharts|width\(-?\d+\) and height/i.test(m.text())) consoleErrors.push(`[warn] ${page.url()} ${m.text()}`);
  });
  return page;
}
async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo1234");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10_000 });
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const toast = (page, re) => page.locator("[data-sonner-toast]").filter({ hasText: re }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);

// ---- Donor reports a request ----
{
  const page = await newPage();
  await login(page, "donor@redlink.test");
  await page.locator('a[href^="/donor/requests/"]').first().click();
  await page.getByRole("button", { name: "Report this request" }).click();
  await page.getByLabel("What happened?").fill("The hospital phone number on this request doesn't work.");
  await page.screenshot({ path: `${SHOTS}/p6-report-dialog.png` });
  await page.getByRole("button", { name: "Send report" }).click();
  check(await toast(page, /Report sent/), `donor: report sent from request page`);
  check((await page.getByRole("button", { name: "Reported this request" }).isDisabled()), `donor: button shows "Reported"`);
  await page.context().close();
}

// ---- Hospital sees Report on accepted donors ----
{
  const page = await newPage();
  await login(page, "hospital@redlink.test");
  await page.locator('a[href^="/hospital/requests/"]:not([href$="/new"])').first().click();
  await page.getByRole("heading", { name: /Matched donors/ }).waitFor();
  const reportBtns = await page.getByRole("button", { name: /^Report / }).count();
  const accepted = await page.getByText("Record donation").count();
  check(reportBtns >= 1 && reportBtns === accepted, `hospital: Report button on each accepted donor (${reportBtns})`);
  await page.context().close();
}

// ---- Admin ----
const page = await newPage();
await login(page, "admin@redlink.test");
check(new URL(page.url()).pathname === "/admin", `admin: lands on /admin`);
await page.getByText("Total donors").waitFor();
await page.locator(".recharts-surface").nth(1).waitFor();
check((await page.locator(".recharts-surface").count()) >= 2, `analytics: 2 charts rendered`);
check((await page.locator(".recharts-bar-rectangle").count()) > 0, `analytics: bars drawn`);
const tiles = await page.locator("section[aria-label=Totals] p.text-3xl").allInnerTexts();
check(tiles.length === 6 && tiles[0] === "41" && tiles[4] === "100%" && /min/.test(tiles[5]), `analytics: 6 tiles (${tiles.join(" | ")})`);
check((await page.getByRole("link", { name: /awaiting verification/ }).innerText()).includes("1"), `analytics: 1 pending verification link`);
check((await page.getByRole("link", { name: /Open flags/ }).innerText()).includes("2"), `analytics: 2 open flags (seed + donor's report)`);
await page.screenshot({ path: `${SHOTS}/p6-analytics.png`, fullPage: true });

// Verification queue
await page.getByRole("link", { name: "Verifications" }).first().click();
await page.getByText("New Life Hospital").waitFor();
check((await page.getByText("MH-HOSP-2026-1150").count()) === 1, `verifications: licence shown`);
await page.screenshot({ path: `${SHOTS}/p6-verifications.png` });
await page.getByRole("button", { name: "Approve" }).click();
check(await toast(page, /approved/), `verifications: approve works`);
await page.getByText("All caught up").waitFor();
check(true, `verifications: queue empty after approving`);

// Users
await page.getByRole("link", { name: "Users" }).first().click();
await page.getByLabel("Name, email, phone or organisation").fill("Neha");
await page.getByRole("button", { name: "Search" }).click();
await page.getByText("Sneha Kulkarni").waitFor();
check((await page.locator("main ul > li").count()) === 2, `users: "Neha" finds Neha Singh and Sneha Kulkarni`);
await page.getByLabel("Name, email, phone or organisation").fill("Neha Singh");
await page.getByRole("button", { name: "Search" }).click();
await page.waitForFunction(() => document.querySelectorAll("main ul > li").length === 1);
check(true, `users: "Neha Singh" narrows to 1`);
await page.getByRole("button", { name: "Suspend Neha Singh" }).click();
check((await page.getByRole("dialog").innerText()).includes("withdrawn from requests"), `users: suspend dialog explains the clean-up`);
await page.getByRole("button", { name: "Suspend account" }).click();
check(await toast(page, /Neha Singh suspended/), `users: suspended`);
await page.locator("li").getByText("Suspended", { exact: true }).waitFor();
await page.screenshot({ path: `${SHOTS}/p6-users.png` });
await page.getByRole("button", { name: "Reactivate Neha Singh" }).click();
await page.getByRole("button", { name: "Reactivate account" }).click();
check(await toast(page, /reactivated/), `users: reactivated`);

// Flags
await page.getByRole("link", { name: "Flags" }).first().click();
await page.getByText("Accepted two requests but did not arrive").waitFor();
check((await page.getByText("doesn't work").count()) === 1, `flags: donor's new report is listed`);
await page.screenshot({ path: `${SHOTS}/p6-flags.png`, fullPage: true });
const donorFlag = page.locator("li").filter({ hasText: "doesn't work" });
await donorFlag.getByRole("button", { name: "Resolve", exact: true }).click();
await page.getByLabel("Note to the reporter (optional)").fill("Thanks, we've asked the hospital to update it.");
await page.getByRole("dialog").getByRole("button", { name: "Resolve", exact: true }).click();
check(await toast(page, /resolved/), `flags: resolved with a note`);
await page.waitForFunction(() => !document.body.innerText.includes("doesn't work"));
check(true, `flags: resolved report leaves the Open tab`);
await page.getByRole("tab", { name: "Resolved" }).click();
await page.getByText(/asked the hospital to update it/).waitFor();
check(true, `flags: Resolved tab shows the note`);

// All requests
await page.getByRole("link", { name: "Requests" }).first().click();
await page.getByRole("heading", { name: "All requests" }).waitFor();
await page.locator('a[href^="/admin/requests/"]').first().waitFor();
check((await page.locator('a[href^="/admin/requests/"]').count()) === 2, `requests: 2 open requests by default`);
await page.getByLabel("Show").selectOption("");
await page.waitForFunction(() => document.querySelectorAll('a[href^="/admin/requests/"]').length === 8);
check(true, `requests: "All" shows 8`);
await page.locator('a[href^="/admin/requests/"]').filter({ hasText: "Vidyavihar General Hospital" }).filter({ hasText: "Open" }).first().click();
await page.getByText("Admin view (read-only)").waitFor();
check((await page.locator('a[href^="tel:"]').count()) >= 1, `request view: accepted donor's phone visible`);
check((await page.getByRole("button", { name: /Cancel request|Record donation|Report/ }).count()) === 0, `request view: no actions for admin`);
await page.screenshot({ path: `${SHOTS}/p6-request.png`, fullPage: true });

// Find donors
await page.getByRole("link", { name: "Find donors" }).first().click();
await page.getByText(/as receivers and hospitals see it/).waitFor();
check(true, `find donors: admin page loads`);

// Mobile + dark
for (const p of ["/admin", "/admin/verifications", "/admin/users", "/admin/requests", "/admin/flags"]) {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${BASE}${p}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  check(await noOverflow(page), `375 px: ${p} has no sideways scroll`);
}
await page.goto(`${BASE}/admin`);
await page.locator(".recharts-surface").nth(1).waitFor();
await page.screenshot({ path: `${SHOTS}/p6-analytics-mobile.png`, fullPage: true });
check((await page.getByRole("button", { name: "Open menu" }).isVisible()), `375 px: menu button shown`);
await page.setViewportSize({ width: 900, height: 800 });
check((await page.getByRole("button", { name: "Open menu" }).isVisible()), `900 px: admin uses the menu (6 links don't fit)`);
await page.setViewportSize({ width: 1280, height: 900 });
await page.emulateMedia({ colorScheme: "dark" });
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload();
await page.locator(".recharts-surface").nth(1).waitFor();
await page.screenshot({ path: `${SHOTS}/p6-analytics-dark.png`, fullPage: true });

check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `:\n  ${consoleErrors.join("\n  ")}` : ""}`);
await browser.close();
console.log(failures === 0 ? "\nALL UI CHECKS PASSED" : `\n${failures} UI CHECK(S) FAILED`);
process.exitCode = failures ? 1 : 0;
