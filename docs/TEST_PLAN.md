# Test Plan

## 1. Strategy

| Level | Tool | What it covers | How to run | Result (14 Oct 2026) |
|---|---|---|---|---|
| **Unit** | Vitest | Domain rules in `shared/src/domain`: compatibility, eligibility, distance, scoring, request status, inventory, analytics, moderation | `npm test` | **187 / 187 passed** |
| **API acceptance** | Node scripts + MongoDB driver | Each phase's acceptance criteria through the real API, checking both responses and what was stored | `npm run test:api` (app running) | **307 / 307 checks passed** |
| **Browser (UI)** | Playwright (headless Chromium) | Real screens for every role, 375 px phone width, dark mode, console errors | `npm run test:ui` (app running) | **149 / 149 checks passed** |
| **Production build** | Playwright + fetch | Single-port build: health check, PWA installability, SPA deep links, login limiter | `node tests/acceptance/ui/prod.mjs http://localhost:<port>` against `npm start` | **13 / 13 passed** |
| **Performance** | `npm run bench` | Matching 10,000 donors (see [NON_FUNCTIONAL.md](NON_FUNCTIONAL.md)) | `npm run bench` | Max 154.5 ms (target < 1 s) |
| **Static checks** | TypeScript (strict), oxlint, npm audit | Types across all workspaces, lint, dependency vulnerabilities | `npm run build`, `npm run lint`, `npm audit` | 0 errors, 0 warnings, 0 vulnerabilities |
| **Manual** | Checklist below | One scripted scenario per role, for the report and the live demo | By hand, on freshly seeded data | Fill in the Result column when you run it |

The API and browser suites re-seed the database before each script (`npm run db:seed`), so every run starts from the same demo data.

### 1.1 Unit tests by file

| File | Tests | Highlights |
|---|---|---|
| `compatibility.test.ts` | 77 | All **64** donor → recipient pairs against the spec table; universal donor / recipient |
| `phase2-domain.test.ts` | 20 | Donor responses (accept / withdraw / re-accept), units per donation, feed order |
| `admin.test.ts` | 18 | IST day / month boundaries, fulfilment rate, average first acceptance, 14-day series, verification / suspension / flag rules |
| `eligibility.test.ts` | 17 | Age 17 / 18 / 65 / 66 boundaries, weight 49.9 / 50 kg, cooldown at **89 vs 90 days** (to the millisecond), reasons, next eligible date |
| `requests.test.ts` | 14 | Status transitions, `statusForUnits`, expiry, URGENT expand (25 → 50 → 75, stop), CRITICAL auto-escalation conditions |
| `inventory.test.ts` | 12 | Never below 0, low stock at threshold, compatible offer groups, units applied on acceptance, walk-in eligibility |
| `matching.test.ts` | 12 | Score formula, sort order (score → distance → id), radius edge, creator excluded, already-matched skipped, 50 limit |
| `geo.test.ts` | 11 | Haversine known distance (CSMT → Ghatkopar ≈ 18 km), bounding box contains the circle, 0.5 km rounding |
| `phase3-domain.test.ts` | 6 | Name masking, ~1 km grid snapping, contact-request rules |

### 1.2 Acceptance suites

| Script | Checks | Covers |
|---|---|---|
| `api/p1.mjs` | 45 | All 7 demo logins and redirects, httpOnly cookie, no password hash in responses, sign-up for each role and validation, pending institution blocked, role guards, stale sessions after reseed |
| `api/p2.mjs` | 40 | **Phase 2 acceptance:** hospital creates an O+ URGENT request → only compatible donors within 25 km alerted → donor accepts → hospital sees phone → records donation → donor history, Verified badge, 90-day cooldown; units, fulfilment, "no longer needed"; double-clicks |
| `api/p3.mjs` | 40 | **Phase 3 acceptance:** a phone number never appears in any receiver response before the donor accepts; masked names and distances, 1 km grid, filters, contact flow, receiver requests at a verified hospital |
| `api/p4.mjs` | 30 | CRITICAL only for emergency services, manual expand (URGENT, creator only), CRITICAL auto-escalation after 10 min exactly once (even with simultaneous polls), expiry, cancellation with reason, notifications |
| `api/p5.mjs` | 44 | Inventory, compatible offers only, stock taken only on acceptance, stock dropped before acceptance, auto-decline on fulfilment, walk-ins (eligible only; adds stock), camps on donors' home pages |
| `api/p6.mjs` | 108 | Analytics figures recomputed independently, verification queue (simultaneous approvals), user search and filters, suspension clean-up per role, reactivation, reporting rules, flag review outcomes, admin read-only request view |
| `ui/smoke.mjs` | 38 | Main flow for each role in the browser, logout, dark-mode dropdowns, 375 px |
| `ui/admin6.mjs` | 34 | Reporting from the donor and hospital screens; every admin page; 375 px and dark mode |
| `ui/sweep.mjs` | 77 | 38 pages × light and dark at 375 px: no sideways scrolling; no console errors; README screenshots |

## 2. Manual test checklist

Before starting: `npm run db:seed`, then open the app. All demo passwords are `demo1234`. Use a second browser (or a private window) when two roles are needed at once.

| Test ID | Role | Steps | Expected | Result |
|---|---|---|---|---|
| TC-01 | Visitor | Open `/`. Check the live stats and the compatibility chart. | 4 live numbers; 8 × 8 chart; works at phone width | |
| TC-02 | Visitor | Sign up as a donor aged 17. | Form allows it, but the home page shows "Donors must be at least 18 years old" and the donor is never matched | |
| TC-03 | Visitor | Sign up as a hospital. | "Awaiting verification" screen; other hospital pages blocked | |
| TC-04 | All | Log in as each demo account. Then open another role's URL (e.g. `/admin` as donor). | Each lands on its own dashboard; other roles' pages redirect back | |
| TC-05 | Hospital | `hospital@redlink.test` → New request → O+, 2 units, URGENT, needed in 24 h → Create. | Request page lists ranked donors (O+ and O− only, all within 25 km) | |
| TC-06 | Donor | `donor@redlink.test` (O−) → bell / red banner shows the new O+ request → open it → **Accept**. | Compatibility note "Your O− blood is compatible with O+ patients"; after accepting, hospital address shown | |
| TC-07 | Hospital | Refresh the request page (or wait 10 s). | Donor appears under **Accepted** with full name and phone | |
| TC-08 | Hospital | **Record donation** → 1 unit. | Progress 1/2. Donor's History shows the donation, **Verified** badge, "You can donate again on …" (90 days later) | |
| TC-09 | Donor | Open the O+ request again; try to accept a different request. | Can't accept: reason shows the next eligible date | |
| TC-10 | Receiver | `receiver@redlink.test` → Find donors → patient B+, 10 km → Search. Switch to Map. | Masked names ("Divya C."), "~5 km" style distances, Verified badges; no phone numbers; pins are approximate | |
| TC-11 | Receiver | **Request contact** on a donor → write a message. | "Waiting for reply" under Contacts | |
| TC-12 | Donor | As that donor (password `demo1234`; find the email on the admin Users page) → Contacts → **Share my number**. | Receiver's Contacts now shows the donor's phone; donor sees the receiver's phone | |
| TC-13 | Receiver | My requests → New → B+, URGENT, choose *Vidyavihar General Hospital* → create → **Expand radius**. | Radius 25 → 50 km and more donors alerted; the hospital sees it under "Patient requests at your hospital" | |
| TC-14 | Emergency | `emergency@redlink.test` → **CRITICAL BROADCAST** → create. | Urgency pre-set to Critical; donors get a red banner; note says the search widens to 100 km if fewer than 3 accept in 10 minutes | |
| TC-15 | Emergency | Wait 10 minutes with fewer than 3 acceptances, then refresh. | Radius 100 km; "Search widened automatically"; CRITICAL notification to the creator | |
| TC-16 | Hospital | Cancel an open request with a reason. | Status Cancelled; alerted donors see "No longer needed" with the reason | |
| TC-17 | Blood bank | `bloodbank@redlink.test` → Inventory. | 8 tiles; O− (2 units) in red as low stock; −1 / +1 / +5 work; never below 0 | |
| TC-18 | Blood bank | Requests → offer 1 unit to an open request. Then, as its requester, **Accept** the offer. | Stock drops only on acceptance; request units go up | |
| TC-19 | Blood bank | Walk-ins → look up `donor@redlink.test` after TC-08. | Blocked: "can donate again on …". An eligible donor can be recorded, and stock goes up. | |
| TC-20 | Blood bank | Camps → create a camp near Vidyavihar for next week. | Appears on the demo donor's home page under nearby camps | |
| TC-21 | Admin | `admin@redlink.test` → Analytics. | 6 figures and 2 charts; links show 1 pending verification and 1 open flag | |
| TC-22 | Admin | Verifications → Approve *New Life Hospital*. Log in as `newhospital@redlink.test`. | Hospital dashboard works; it got an "Organisation verified" notification | |
| TC-23 | Donor → Admin | As a donor, open a request → **Report** → reason. As admin → Flags → **Resolve** with a note. | Report listed; after resolving, the donor gets a notification with the note | |
| TC-24 | Admin | Users → search a donor who accepted a request → **Suspend**. Try logging in as them. | Login refused; the requester is told the donor withdrew. Reactivate → login works again | |
| TC-25 | Admin | Requests → open any request. | Read-only view; accepted donors' phones visible; no action buttons | |
| TC-26 | Any | On a phone: browser menu → *Install app* / *Add to Home screen*. | Red Link icon on the home screen; opens full-screen | |
| TC-27 | Any | Toggle dark mode on several pages. | All text, dropdowns and charts readable | |
| TC-28 | Any | Disconnect the internet (local setup) and use the app. | Everything works; the donor-search map says "Map images couldn't load (you may be offline)"; address search says "Address search needs an internet connection…" while GPS and map clicks still work | |

## 3. Defects found and fixed during testing

Selected examples from the build. Each was fixed and is now covered by an automated check.

| Found by | Defect | Fix |
|---|---|---|
| Owner (Phase 2) | The same donor was alerted for A+ and B+ requests, which looked wrong | It is correct (O donors can give to both), so a compatibility note now explains it to the donor |
| Owner (Phase 2) | Blood group and gender dropdowns were unreadable in dark mode | Shared `NativeSelect` with explicit colours + `color-scheme` |
| UI sweep | Landing page scrolled sideways at 375 px | Compatibility chart's scroll box made `relative` |
| UI test | After logout, the login page remembered the previous user's page | `loggedOut` flag in the auth context |
| UI test | First visit to the charts page went blank while the dev server re-optimised | Libraries pre-bundled; error boundary with "Reload" added |
| UI sweep | Unhandled error from the alert sound when leaving a page quickly | Audio promises handled |
| UI sweep | Accepted-donor card cramped at 375 px | Actions wrap below the donor's name |
| API test | Two admins approving at once could both succeed | Conditional update, so exactly one succeeds |
| `npm audit` | 7 high-severity advisories via the shadcn CLI | CLI removed; its stylesheet copied into the project |
