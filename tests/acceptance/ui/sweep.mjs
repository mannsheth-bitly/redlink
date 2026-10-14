// Phase 7 QA sweep: every page at 375 px (light + dark) for overflow and console errors,
// plus README screenshots (desktop, light) into docs/screenshots. Fresh seed expected.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:5173";
const QA = path.join(import.meta.dirname, "shots", "qa");
const README = path.resolve(import.meta.dirname, "..", "..", "..", "docs", "screenshots");
mkdirSync(QA, { recursive: true });
mkdirSync(README, { recursive: true });
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const errors = [];
const browser = await chromium.launch();

async function session(email, colorScheme, viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/tile\.openstreetmap|net::ERR/i.test(m.text())) errors.push(`[console] ${page.url()} ${m.text()}`);
  });
  if (email) {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("demo1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10_000 });
  }
  return page;
}

const settle = async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
};
const overflow = (page) =>
  page.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth + 1) return null;
    // Report the widest offending element to make fixing easy.
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1 && (!worst || r.right > worst.right)) worst = { right: Math.round(r.right), tag: el.tagName, cls: String(el.className).slice(0, 80) };
    }
    return worst;
  });

const ROLES = [
  { email: null, name: "public", pages: ["/", "/about", "/login", "/signup", "/signup?role=DONOR", "/does-not-exist"] },
  { email: "donor@redlink.test", name: "donor", pages: ["/donor", "FIRST:a[href^='/donor/requests/']", "/donor/contacts", "/donor/history", "/donor/profile", "/notifications"] },
  { email: "receiver@redlink.test", name: "receiver", pages: ["/receiver", "/receiver/requests", "/receiver/requests/new", "/receiver/contacts", "FIRST:a[href^='/receiver/requests/']:not([href$='/new'])"] },
  { email: "hospital@redlink.test", name: "hospital", pages: ["/hospital", "FIRST:a[href^='/hospital/requests/']:not([href$='/new'])", "/hospital/requests/new", "/hospital/search", "/hospital/donations"] },
  { email: "emergency@redlink.test", name: "emergency", pages: ["/emergency", "/emergency/requests/new", "/emergency/search", "/emergency/donations"] },
  { email: "bloodbank@redlink.test", name: "bloodbank", pages: ["/bloodbank", "/bloodbank/requests", "/bloodbank/camps", "/bloodbank/donations"] },
  { email: "newhospital@redlink.test", name: "pending", pages: ["/hospital"] },
  { email: "admin@redlink.test", name: "admin", pages: ["/admin", "/admin/verifications", "/admin/users", "/admin/requests", "/admin/flags", "/admin/search", "FIRST:a[href^='/admin/requests/']"] },
];

for (const scheme of ["light", "dark"]) {
  for (const role of ROLES) {
    const page = await session(role.email, scheme, { width: 375, height: 812 });
    let i = 0;
    for (const p of role.pages) {
      if (p.startsWith("FIRST:")) {
        const back = role.name === "admin" ? "/admin/requests" : `/${role.name}${role.name === "receiver" ? "/requests" : ""}`;
        await page.goto(`${BASE}${back}`);
        await page.locator(p.slice(6)).first().click();
      } else {
        await page.goto(`${BASE}${p}`);
      }
      await settle(page);
      const o = await overflow(page);
      const label = `${role.name} ${p.startsWith("FIRST:") ? "(detail page)" : p}`;
      check(o === null, `375 px ${scheme}: ${label}${o ? ` overflows at ${o.right}px <${o.tag} class="${o.cls}">` : ""}`);
      await page.screenshot({ path: path.join(QA, `${scheme}-${role.name}-${i++}.png`), fullPage: true });
    }
    await page.context().close();
  }
}

// README screenshots: desktop light, plus two phone shots.
const shots = [
  { email: null, url: "/", file: "01-landing.png" },
  { email: "donor@redlink.test", url: "/donor", file: "02-donor-home.png" },
  { email: "donor@redlink.test", url: "FIRST:a[href^='/donor/requests/']", file: "03-donor-request.png", back: "/donor" },
  { email: "hospital@redlink.test", url: "FIRST:a[href^='/hospital/requests/']:not([href$='/new'])", file: "04-hospital-request.png", back: "/hospital" },
  { email: "receiver@redlink.test", url: "/receiver", file: "05-receiver-search.png", search: true },
  { email: "emergency@redlink.test", url: "/emergency", file: "06-emergency-dashboard.png" },
  { email: "bloodbank@redlink.test", url: "/bloodbank", file: "07-bloodbank-inventory.png" },
  { email: "admin@redlink.test", url: "/admin", file: "08-admin-analytics.png", charts: true },
];
for (const s of shots) {
  const page = await session(s.email, "light", { width: 1280, height: 800 });
  if (s.url.startsWith("FIRST:")) {
    await page.goto(`${BASE}${s.back}`);
    await page.locator(s.url.slice(6)).first().click();
  } else await page.goto(`${BASE}${s.url}`);
  await settle(page);
  if (s.search) {
    await page.getByLabel("Patient's blood group").selectOption("B+");
    await page.getByRole("button", { name: "Search donors" }).click();
    await page.getByText(/compatible donor/i).first().waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000); // map tiles
  }
  if (s.charts) await page.waitForTimeout(1500); // let the bars finish animating
  await page.screenshot({ path: path.join(README, s.file) });
  await page.context().close();
}
for (const [email, url, file] of [
  ["donor@redlink.test", "/donor", "09-mobile-donor.png"],
  ["admin@redlink.test", "/admin", "10-mobile-admin-dark.png"],
]) {
  const page = await session(email, file.includes("dark") ? "dark" : "light", { width: 390, height: 844 });
  await page.goto(`${BASE}${url}`);
  await settle(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(README, file) });
  await page.context().close();
}

check(errors.length === 0, `no console errors${errors.length ? `:\n  ${[...new Set(errors)].join("\n  ")}` : ""}`);
await browser.close();
console.log(failures === 0 ? "\nSWEEP PASSED" : `\n${failures} SWEEP CHECK(S) FAILED`);
process.exitCode = failures ? 1 : 0;
