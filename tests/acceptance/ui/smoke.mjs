// UI smoke test of the React client in headless Chromium (Playwright). Fresh seed expected.
// Usage: node tests/acceptance/ui/smoke.mjs http://localhost:5173
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
    // Map tile requests fail in a sandbox without internet; that's expected and handled by the UI.
    if (m.type() === "error" && !/tile\.openstreetmap|ERR_INTERNET_DISCONNECTED|net::ERR/i.test(m.text())) consoleErrors.push(`[console] ${page.url()} ${m.text()}`);
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

// ---- Landing ----
{
  const page = await newPage();
  await page.goto(BASE);
  await page.getByRole("heading", { name: /found in seconds/ }).waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes("—\n") || true);
  await page.waitForTimeout(800);
  const stats = await page.locator("dl dd").allInnerTexts();
  check(stats.length === 4 && stats.every((s) => /^\d+$/.test(s.trim())), `landing: live stats loaded (${stats.join(", ")})`);
  check((await page.locator("table caption").count()) === 1 && (await page.locator("tbody tr").count()) === 8, `landing: 8×8 compatibility chart`);
  await page.screenshot({ path: `${SHOTS}/landing.png`, fullPage: false });
  await page.context().close();
}

// ---- Login via demo accounts box, donor flow ----
{
  const page = await newPage();
  await page.goto(`${BASE}/login`);
  await page.getByText("Demo accounts").click();
  await page.getByRole("button", { name: /Donor \(O−/ }).click();
  check((await page.getByLabel("Email").inputValue()) === "donor@redlink.test", `login: demo account button fills the form`);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE}/donor`);
  await page.getByRole("heading", { name: /^Hi, Aarav/ }).waitFor();
  check(true, `donor: lands on /donor with greeting`);
  await page.getByRole("heading", { name: "Requests matched to you" }).waitFor();
  await page.locator('a[href^="/donor/requests/"]').first().waitFor();
  const feedCount = await page.locator('a[href^="/donor/requests/"]').count();
  check(feedCount === 2, `donor: feed shows 2 matched requests (${feedCount})`);
  check((await page.getByText(/blood is compatible with/).count()) === 2, `donor: compatibility notes shown`);
  check((await page.getByText("Vidyavihar Campus Blood Donation Drive").count()) === 1, `donor: nearby camp listed`);
  await page.screenshot({ path: `${SHOTS}/donor-home.png` });

  await page.goto(`${BASE}/admin`);
  await page.waitForURL(`${BASE}/donor`);
  check(true, `donor: /admin redirects to /donor`);

  await page.locator('a[href^="/donor/requests/"]').first().click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "I can no longer donate" }).waitFor();
  check((await page.getByText("You've accepted this request.").count()) === 1, `donor: accept works, address shown`);
  await page.screenshot({ path: `${SHOTS}/donor-accepted.png` });

  await page.goto(`${BASE}/donor/history`);
  await page.getByRole("heading", { name: "Donation history" }).waitFor();
  await page.goto(`${BASE}/donor/profile`);
  await page.getByLabel("Blood group").waitFor();
  check((await page.getByLabel("Blood group").inputValue()) === "O-", `donor: profile form prefilled`);
  await page.goto(`${BASE}/notifications`);
  await page.getByRole("heading", { name: "Notifications" }).waitFor();
  await page.locator("main ul li button").first().waitFor({ timeout: 10_000 });
  check((await page.locator("main ul li button").count()) > 0, `notifications page lists items`);

  // Log out
  await page.getByRole("button", { name: "Log out" }).first().click();
  await page.waitForURL(`${BASE}/login`);
  await page.goto(`${BASE}/donor`);
  await page.waitForURL(/\/login\?next=/);
  check(true, `logout: /donor now redirects to /login?next=`);
  await page.context().close();
}

// ---- Hospital: see accepted donor, record donation ----
{
  const page = await newPage();
  await login(page, "hospital@redlink.test");
  check(page.url() === `${BASE}/hospital`, `hospital: lands on /hospital`);
  await page.getByRole("heading", { name: /Open requests/ }).waitFor();
  await page.locator('a[href^="/hospital/requests/"]:not([href$="/new"])').first().click();
  await page.getByRole("heading", { name: /Matched donors/ }).waitFor();
  const phones = await page.locator('a[href^="tel:"]').count();
  check(phones >= 1, `hospital: accepted donors show phone links (${phones})`);
  await page.screenshot({ path: `${SHOTS}/hospital-request.png`, fullPage: true });
  const recordBtn = page.getByRole("button", { name: "Record donation" }).first();
  if (await recordBtn.count()) {
    await recordBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: "Record donation" }).click();
    await page.getByText(/Donation recorded/).first().waitFor();
    check(true, `hospital: record donation dialog works`);
  } else check(false, `hospital: Record donation button present`);
  await page.goto(`${BASE}/hospital/requests/new`);
  await page.getByLabel("Patient's blood group").waitFor();
  check((await page.locator('input[type="radio"][value="CRITICAL"]').count()) === 0, `hospital: no CRITICAL option`);
  await page.goto(`${BASE}/hospital/donations`);
  await page.getByRole("heading", { name: "Donations recorded" }).waitFor();
  check((await page.locator("tbody tr").count()) > 0, `hospital: donations table`);
  await page.context().close();
}

// ---- Emergency: CRITICAL broadcast prefill ----
{
  const page = await newPage();
  await login(page, "emergency@redlink.test");
  await page.getByText("CRITICAL BROADCAST").click();
  await page.waitForURL(/urgency=CRITICAL/);
  await page.getByLabel("Patient's blood group").waitFor();
  check(await page.locator('input[type="radio"][value="CRITICAL"]').isChecked(), `emergency: CRITICAL pre-selected`);
  await page.context().close();
}

// ---- Receiver: search, map view, contact dialog ----
{
  const page = await newPage();
  await login(page, "receiver@redlink.test");
  await page.getByLabel("Patient's blood group").selectOption("A+");
  await page.getByText("25 km").click();
  await page.getByRole("button", { name: "Search donors" }).click();
  await page.getByRole("heading", { name: /donors? for A\+ within 25 km/ }).waitFor();
  const results = await page.getByRole("button", { name: "Request contact" }).count();
  check(results > 0, `receiver: search results with contact buttons (${results})`);
  check(!(await page.content()).match(/90000\d{5}/), `receiver: no phone numbers anywhere in the page`);
  await page.getByRole("button", { name: "Map" }).click();
  await page.locator(".leaflet-container").waitFor();
  check((await page.locator(".leaflet-interactive").count()) > 1, `receiver: map view renders pins`);
  await page.screenshot({ path: `${SHOTS}/receiver-map.png` });
  await page.getByRole("button", { name: "List" }).click();
  await page.getByRole("button", { name: "Request contact" }).first().click();
  await page.getByLabel("Message").fill("Need A+ blood for my father tomorrow.");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByRole("button", { name: "Request sent" }).first().waitFor();
  check(true, `receiver: contact request sent`);
  await page.goto(`${BASE}/receiver/requests/new`);
  await page.getByLabel("Hospital where the patient is admitted").waitFor();
  check((await page.locator("#hospitalId option").count()) === 4, `receiver: hospital dropdown lists 3 verified hospitals`);
  await page.context().close();
}

// ---- Blood bank ----
{
  const page = await newPage();
  await login(page, "bloodbank@redlink.test");
  await page.getByRole("heading", { name: "Inventory" }).waitFor();
  await page.getByText("Total stock:").waitFor();
  check((await page.getByRole("button", { name: /^Add 1 unit of/ }).count()) === 8, `blood bank: 8 inventory tiles`);
  check((await page.getByText("Low stock:").count()) === 1, `blood bank: low-stock warning`);
  await page.getByRole("button", { name: "Add 5 units of AB-" }).click();
  await page.getByText(/AB−: 13 units/).first().waitFor();
  check(true, `blood bank: quick adjust works`);
  await page.goto(`${BASE}/bloodbank/requests`);
  await page.getByRole("heading", { name: /Open requests you can supply/ }).waitFor();
  check((await page.getByRole("button", { name: "Offer units" }).count()) >= 1, `blood bank: can offer units`);
  await page.goto(`${BASE}/bloodbank/donations`);
  await page.getByLabel("Donor's email or phone").fill("receiver@redlink.test");
  await page.getByRole("button", { name: "Find donor" }).click();
  await page.getByText("No donor found with that email or phone.").waitFor();
  check(true, `blood bank: walk-in lookup handles unknown donor`);
  await page.context().close();
}

// ---- Pending hospital ----
{
  const page = await newPage();
  await login(page, "newhospital@redlink.test");
  await page.getByText("Awaiting verification").waitFor();
  check(true, `pending hospital: "Awaiting verification" screen`);
  await page.context().close();
}

// ---- Signup dropdowns in dark mode ----
{
  const page = await newPage({ colorScheme: "dark" });
  await page.goto(`${BASE}/signup?role=DONOR`);
  await page.getByLabel("Blood group").waitFor();
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const style = await page.locator("#bloodGroup").evaluate((el) => {
    const s = getComputedStyle(el);
    const opt = getComputedStyle(el.querySelector("option"));
    return { scheme: s.colorScheme, bg: s.backgroundColor, color: s.color, optBg: opt.backgroundColor, optColor: opt.color };
  });
  check(isDark && style.scheme.includes("dark"), `dark mode: select uses color-scheme dark (${style.scheme})`);
  check(style.optBg !== style.optColor && !/rgba\(0, 0, 0, 0\)/.test(style.optBg), `dark mode: option colours readable (bg ${style.optBg}, text ${style.optColor})`);
  check((await page.locator("#bloodGroup option").count()) === 9 && (await page.locator("#gender option").count()) === 4, `signup: blood group + gender options present`);
  await page.screenshot({ path: `${SHOTS}/signup-dark.png` });
  await page.context().close();
}

// ---- Phone width (375 px): no horizontal scrolling ----
{
  const page = await newPage({ viewport: { width: 375, height: 800 } });
  for (const p of ["/", "/about", "/login", "/signup?role=DONOR"]) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(400);
    check(await noOverflow(page), `375px: no horizontal scroll on ${p}`);
  }
  await login(page, "donor@redlink.test");
  await page.getByRole("heading", { name: /^Hi, Aarav/ }).waitFor();
  check(await noOverflow(page), `375px: no horizontal scroll on /donor`);
  await page.screenshot({ path: `${SHOTS}/donor-mobile.png`, fullPage: true });
  await page.context().close();
}

check(consoleErrors.length === 0, `no console / page errors${consoleErrors.length ? ":\n    " + consoleErrors.slice(0, 8).join("\n    ") : ""}`);
await browser.close();
console.log(failures === 0 ? "\nALL UI CHECKS PASSED" : `\n${failures} UI CHECK(S) FAILED`);
process.exitCode = failures ? 1 : 0;
