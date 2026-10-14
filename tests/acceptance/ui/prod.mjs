// Production-mode checks on the single-port build: health, manifest, PWA installability, login limiter.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4100";
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};

const health = await fetch(`${BASE}/api/health`);
check(health.status === 200 && (await health.json()).ok === true, `GET /api/health → 200 { ok: true }`);

const man = await fetch(`${BASE}/manifest.webmanifest`);
check(man.ok && /manifest\+json|json/.test(man.headers.get("content-type") ?? ""), `manifest served (${man.headers.get("content-type")})`);
const manifest = await man.json();
for (const icon of manifest.icons) {
  const r = await fetch(`${BASE}${icon.src}`);
  check(r.ok && /image/.test(r.headers.get("content-type") ?? ""), `icon ${icon.src} (${icon.sizes}, ${icon.purpose}) served`);
}
check((await fetch(`${BASE}/apple-touch-icon.png`)).ok, `apple-touch-icon served`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE);
await page.getByRole("heading", { name: /found in seconds/ }).waitFor();
const cdp = await page.context().newCDPSession(page);
const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
check(installabilityErrors.length === 0, `Chrome reports the app as installable${installabilityErrors.length ? `: ${JSON.stringify(installabilityErrors)}` : ""}`);
const { url, errors } = await cdp.send("Page.getAppManifest");
check(url.endsWith("/manifest.webmanifest") && errors.length === 0, `Chrome parsed the manifest without errors`);
await page.goto(`${BASE}/admin/flags`);
await page.waitForURL(/\/login/);
check(true, `deep link to a protected page in production redirects to login (SPA fallback works)`);
await browser.close();

// Login limiter: 10 wrong passwords, then 429 even for the right one; other emails unaffected.
const login = (email, password) =>
  fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
const statuses = [];
for (let i = 0; i < 10; i++) statuses.push((await login("receiver@redlink.test", "wrong-password")).status);
check(statuses.every((s) => s === 401), `10 wrong passwords → 401 each`);
const blocked = await login("receiver@redlink.test", "demo1234");
check(blocked.status === 429 && /Too many wrong passwords/.test((await blocked.json()).error), `11th attempt (even correct) → 429 with a wait message`);
check((await login("donor@redlink.test", "demo1234")).status === 200, `other accounts unaffected`);

console.log(failures === 0 ? "\nALL PRODUCTION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures ? 1 : 0;
