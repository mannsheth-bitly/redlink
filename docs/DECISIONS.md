# Decisions Log

Decisions made while building Red Link, in addition to the **Locked Decisions** in `RED_LINK_BUILD_SPEC.md` Section 2.
Items marked **(owner)** were confirmed by the project owner. Items marked **(to confirm)** are small choices made during
the build that the owner should review.

## Confirmed by the owner

| # | Decision |
|---|---|
| 1 | **(owner, after Phase 5)** **Stack changed to React + Express + Node.js + MongoDB**, in TypeScript. Phases 1–5 were rebuilt on it with identical behaviour and re-verified with the same acceptance scenarios. (The original Next.js + SQLite build is kept in `C:\Projects\red-link` for reference.) |
| 1a | **(owner)** MongoDB runs **locally** (works offline for the presentation), as a single-node replica set so transactions work. |
| 1b | **(owner)** Added **address search** (OpenStreetMap Nominatim, free, no key) to every location picker. |
| 1c | **(owner)** Added **email notifications** (Nodemailer, e.g. Gmail app password) for URGENT/CRITICAL alerts. Off until SMTP settings are put in `.env`. |
| 2 | **(owner)** No existing mockup: the UI is designed fresh following spec Section 11. |
| 3 | **(owner)** Code lives in `C:\Projects\red-link-mern` (outside OneDrive so `node_modules` isn't synced). |
| 4 | **(owner)** No presentation demo script (`DEMO_SCRIPT.md` / spec Section 17 removed). |
| 5 | **(owner)** When something is unclear, ask instead of assuming. |
| 6 | **(owner, Phase 2)** After accepting, a donor sees the **hospital name and address only**, not the requester's phone. The requester calls the donor. |
| 7 | **(owner, Phase 2)** A donor can **withdraw after accepting**, until their donation is recorded. The requester is notified. (A donor who declined can also switch to accept while the request is open.) |
| 8 | **(owner, Phase 2)** When recording a donation, staff choose **1 or 2 units** per donor, capped at the units still needed. |
| 9 | **(owner, Phase 2)** Donors can edit **every profile field**. Changing the blood group removes the Verified badge and withdraws the donor from open requests they are no longer compatible with (the requester is told if the donor had accepted). |
| 11 | **(owner, Phase 3)** A receiver-raised request names a **verified hospital** where the patient is admitted. Donors go there; that hospital sees the request on its dashboard and **records the donations** (giving the Verified badge). Schema addition: `BloodRequest.recordingHospitalId`. |
| 12 | **(owner, Phase 3)** Hospitals and Emergency services also get a masked **Find donors** page (no contact button; contact requests stay receiver-only). |
| 13 | **(owner, Phase 3)** Map pins are **snapped to a ~1 km grid** (0.01°) on the server; donors in the same square share one pin with a count. |
| 14 | **(owner, Phase 3)** Search shows **only donors who can donate now** (available + eligible). The "available now" filter is therefore always on. |
| 15 | **(owner, Phase 3)** A donor whose blood group differs from the patient's sees why they were matched ("Your O+ blood is compatible with A+ patients"). |
| 16 | **(owner, Phase 4)** When a request is **cancelled or expires**, donors still notified or accepted are marked "No longer needed" and told (spec only required this for fulfilment). |
| 17 | **(owner, Phase 4)** A request can be cancelled by its **creator** or, for a receiver's request, by the **chosen hospital**. |
| 18 | **(owner, Phase 4)** **Receivers can also expand** the radius of their own URGENT requests. |
| 19 | **(owner, Phase 4)** Cancelling takes an **optional reason** (max 200 characters), shown to donors if given. |
| 20 | **(owner, Phase 5)** A blood bank may offer **any compatible group** it has in stock; the group is stored on the offer (schema addition `SupplyOffer.bloodGroup`) and that group's stock goes down on acceptance. |
| 21 | **(owner, Phase 5)** A **walk-in donation adds the units** to the bank's stock for the donor's group. |
| 22 | **(owner, Phase 5)** Walk-ins are **blocked if the donor is ineligible** (reason shown). The "available" toggle is ignored for walk-ins. |
| 23 | **(owner, Phase 5)** On a receiver's request, the **receiver or the chosen hospital** can accept/decline supply offers. |
| 24 | **(owner, Phase 6)** **Report buttons** sit on request pages (donor's request page, the chosen hospital's view of a receiver request, the blood bank's nearby-request list) and on people cards (accepted/donated donors on a requester's request page, both sides of a contact request). A report names what was seen (request, match or contact request); the server works out the person and checks the reporter really dealt with them. |
| 25 | **(owner, Phase 6)** **Suspension cleans up and blocks.** The account is blocked at once (existing sessions too). Donor: withdrawn from requests they were alerted for or accepted (requesters told), pending contact requests declined. Receiver / hospital / emergency: open requests cancelled (donors told). Blood bank: pending offers withdrawn (requesters told), camps hidden. Reactivating restores access only. |
| 26 | **(owner, Phase 6)** Flags page actions: **Resolve**, **Dismiss**, **Suspend user & resolve**, each with an optional note; the **reporter is notified** of the outcome. Schema additions: `Flag.resolvedAt`, `resolvedById`, `resolutionNote`. |
| 27 | **(owner, Phase 6)** Admin also gets a masked **Find donors** page and a read-only **All requests** page (each request opens the full ranked view with accepted donors' phones, per spec Section 4). |
| 28 | **(owner, Phase 6)** Seed: **7 of the 40 donors are verified and past their cooldown** (an earlier walk-in at the blood bank 100–200 days ago), so the "Verified only" filter has results. The donor count stays 40 (+ the main demo donor). |
| 29 | **(owner, Phase 7)** **Deploy online** on **Render + MongoDB Atlas** free tiers (instead of the spec's Vercel + Neon, which suited the old Next.js + Postgres stack). Config in `render.yaml`; steps in README. The owner creates the accounts. |
| 30 | **(owner, Phase 7)** `NON_FUNCTIONAL.md` gives a **MongoDB-based** scaling path (2dsphere + `$geoNear`, Atlas sharding, job queue, WebSockets) instead of the spec's Postgres + PostGIS. |
| 31 | **(owner, Phase 7)** No college template: the documents follow spec Section 16's list exactly. |
| 32 | **(owner, Phase 7)** PWA is **installable only** (manifest + icons). No service-worker caching, so a demo never shows stale code or data. |
| 10 | **(owner, Phase 2)** Spec conflict resolved: **Emergency services record donations on their own requests** (spec Section 4 table updated to match Sections 7/8). |

## MERN build: technical choices

| # | Choice | Why |
|---|---|---|
| M1 | npm workspaces: `shared/` (domain rules, zod validators, API response types), `server/`, `client/` | The same matching/eligibility code and the same validation run on both sides; the server's functions are typed with the shared API types, so a mismatch fails the typecheck. |
| M2 | `DonorProfile` and `Institution` are **embedded** in the `User` document | One-to-one data that is always read with the user; the natural MongoDB shape. Every other spec entity is its own collection with the spec's field names. |
| M3 | Writes that touch several documents run in **MongoDB transactions** (`mongoose.connection.transaction` with async-local-storage), and state changes use **conditional updates** (e.g. "only if still OPEN") | Prevents double-counting units, double escalation or double expiry when two people/polls act at once. Verified with simultaneous requests. |
| M4 | Emails are sent only **after** the transaction commits, and never to reserved demo domains (`.test`, `example.com`) | No email for an action that was rolled back; demo accounts don't bounce. |
| M5 | `GET /api/auth/me` returns `{ user: null }` (200) when logged out; walk-in lookup returns `{ donor: null }` when not found | Being logged out / not finding someone isn't an error, so the browser console stays clean during a demo. Protected endpoints still return 401/403. |
| M6 | Development: Vite on :5173 forwards `/api` to Express on :4000. Demo/production: `npm run build && npm start` serves the app and API from one port (:4000) | One command to run for the presentation. |
| M7 | Own small theme provider instead of `next-themes` | `next-themes` is built for Next.js and logs a React warning in a plain React app. |
| M8 | Linter is **oxlint** (Vite template default) | Fast; it reports only warnings on the current code (Fast Refresh hints and the standard load-on-mount pattern). |
| M10 | The shadcn **CLI package was removed**; its one stylesheet (`shadcn/tailwind.css`, MIT) is copied to `client/src/shadcn-tailwind.css` | The CLI is a code generator that the app doesn't need at runtime, and it pulled in 7 high-severity advisories. `npm audit` is now clean. |
| M11 | Files mixing components with hooks/constants were split (auth/refresh/theme contexts in `lib/`, providers in `components/shared/`, `button-variants.ts`); `useApi` ignores out-of-date responses | Fast Refresh works everywhere; lint has 0 warnings; a slow old response can no longer overwrite a newer one. |
| M9 | Address search is proxied through the server (`GET /api/geocode`), limited to India, rate-limited to 1 request/second and cached for 24 h | Required by the OpenStreetMap Nominatim usage policy. |

## Technical changes forced by library versions (original Next.js build)

| # | Spec said | What we did | Why |
|---|---|---|---|
| T1 | `src/middleware.ts` | `src/proxy.ts` | Next.js 16 deprecated `middleware.ts` and renamed it to `proxy.ts`. Behaviour is identical. |
| T2 | `datasource db { url = env("DATABASE_URL") }` in `schema.prisma` | URL moved to `prisma.config.ts`; app connects through `@prisma/adapter-better-sqlite3` | Prisma 7 no longer allows `url` in the schema file. The 12 models are unchanged. |
| T3 | `prisma@latest` | Pinned `prisma` and `@prisma/client` to **7.10.0** | npm's `latest` tag for `prisma` pointed at a release candidate (8.0.0-rc) that didn't match `@prisma/client`. |
| T4 | Next.js default `cacheComponents: true` | Set to `false` | Every page is per-user and reads cookies/DB at request time; classic dynamic rendering is simpler and more reliable for a live demo. |
| T5 | Google-hosted Geist font (template default) | System font stack | Keeps the app working fully offline (spec Section 0). |
| T6 | `db:reset` = push with force-reset | `prisma db push && prisma generate && tsx prisma/seed.ts` | Prisma blocks `--force-reset` when run by an AI agent. The seed already deletes all rows itself, so the result is the same. If a future schema change can't be applied without dropping data, run `npx prisma db push --force-reset` yourself (development database only). |
| T7 | shadcn/ui | shadcn "base-nova" preset (Base UI primitives) | Current shadcn default. Components are used the same way; links styled as buttons use `buttonVariants`. |

## Spec corrections

| # | Spec said | Correction |
|---|---|---|
| C1 | Haversine test: "CSMT → Ghatkopar ≈ 12–13 km" | The straight-line distance is **≈ 18.0 km** (CSMT 18.9398 N 72.8355 E → Ghatkopar station 19.0863 N 72.9081 E). The test asserts 17.5–18.5 km. |

## Small choices made during the build (to confirm)

| # | Choice |
|---|---|
| S1 | **Age 18–65 is inclusive** (a donor on their 65th birthday through the day before their 66th is eligible). |
| S2 | **90-day cooldown is measured to the millisecond**: eligible again exactly 90 × 24 h after `lastDonationAt`. |
| S3 | **CRITICAL auto-escalation happens once** (50 km → 100 km). |
| S4 | **Phone numbers** must be 10-digit Indian mobiles (starting 6–9); `+91` / `0` prefixes are stripped before saving. |
| S5 | **Location is required at signup** for every role, since all roles use distance. |
| S6 | **Suspended users cannot log in.** Rejected institutions can log in, but only see the rejection screen with the admin's note. |
| S7 | Landing page **live stats**: registered donors, donors ready to donate now (eligible + available), requests fulfilled, units donated. |
| S8 | Distances under 0.25 km display as "< 0.5 km" instead of "~0 km". |
| S9 | Matching ties (same score) are broken by nearer distance, then donor id, so the order is stable. |
| S10 | Session lasts **7 days**. |
| S12 | **Schema addition:** `BloodRequest.hospitalAddress` (optional) so donors know where to go (needed for decision 6). |
| S13 | Units per request: 1–20. "Needed by" defaults to 24 h from now and must be in the future. |
| S14 | Donor feed shows the donor's NOTIFIED/ACCEPTED matches on open requests whose "needed by" hasn't passed. A donor in cooldown still sees them but can't accept (with the reason shown). |
| S15 | "Nearby upcoming camps" on the donor home page = camps within **25 km** that haven't ended. |
| S16 | Notifications: the requester is notified when a donor accepts or withdraws (not on a plain decline, to avoid noise). The donor gets a "Thank you" notification when their donation is recorded. |
| S17 | For an Emergency request, "Hospital name/address" starts empty (the emergency service names the receiving hospital); for a Hospital it defaults to the hospital itself. |
| S18 | The urgent alert sound is generated with the Web Audio API (no audio file). Browsers may block sound until the user has clicked on the page once; the red banner always shows. |
| S19 | A receiver can't send a second contact request to a donor while one is pending or already accepted; after a decline they may ask again. Messages are 5–300 characters. |
| S20 | Before accepting, a donor sees the receiver's full name and message (not their phone). |
| S21 | For a receiver's request, the receiver and the chosen hospital are both notified when a donor accepts or withdraws; the receiver is notified when the hospital records a donation. The chosen hospital sees accepted donors' names and phones. |
| S22 | Search results are ranked with the matching score (exact group, then nearer, then verified) and capped at 50. |
| S23 | Native `<select>` elements use one shared `NativeSelect` component with explicit colours, and the page declares `color-scheme`, so dropdown lists are readable in dark mode. |
| S24 | Lazy expiry + CRITICAL escalation run on every notifications poll and whenever a request/dashboard/feed is viewed, for **all** active requests (cheap at this scale). Each change is a conditional update, so simultaneous polls can't escalate or expire a request twice. |
| S25 | CRITICAL auto-escalation counts donors who **accepted or already donated** toward the "3 accepted" threshold, and happens **once** (50 → 100 km). The creator (and chosen hospital) get a CRITICAL notification saying how many more donors were alerted. |
| S26 | Manual expand records the time in `lastEscalatedAt` too. Only the creator can expand. |
| S27 | An expired request notifies its creator (and chosen hospital) with the units reached, e.g. "1/2 units". |
| S28 | Low stock = units **at or below** the threshold (default 5). Quick adjust buttons are −1, +1, +5; stock never goes below 0. |
| S29 | Stock is only taken when an offer is **accepted** (spec 7.D). If the bank no longer has enough at that moment, acceptance fails with a clear message and nothing changes. If the request needs fewer units by then, only the remainder is applied and deducted. |
| S30 | One pending offer per bank per request. When a request is fulfilled, cancelled or expires, its pending offers are declined automatically and the banks are told. |
| S31 | Walk-in donor lookup is by exact email or phone (`+91`/`0` prefixes allowed). |
| S32 | **Fulfilment rate** = fulfilled ÷ *closed* requests (fulfilled + cancelled + expired). Open requests are left out because their outcome isn't known yet. |
| S33 | **Average time to first acceptance** = for each request, the earliest acceptance (matches now ACCEPTED or DONATED) minus creation time, averaged. A donor who accepted and later withdrew no longer counts. |
| S34 | "Fulfilled this month" and the 14-day chart use **India Standard Time** calendar days. "Total donors" and "Available now" match the landing page (active donors; available + eligible). |
| S35 | Only **ACTIVE** non-admin accounts can be suspended; pending institutions go through the verification queue. An admin can't change their own account. |
| S36 | Suspending a **hospital** also cancels open **patient requests that chose it** (nobody else could record those donations); the receiver is told to raise a new request with another hospital. |
| S37 | A suspended receiver's pending contact requests are marked **declined** (there is no "withdrawn" status); donors aren't notified about it. |
| S38 | A **reject** in the verification queue needs a note (shown to the applicant). Approving sets `verifiedAt` and `verifiedById`. |
| S39 | One open report per reporter per person/request; reasons are 10–500 characters; admins are notified of each new report. Admins can't file reports (spec Section 4). |
| S40 | The users list shows the newest 100 matches; search covers name, email, organisation and phone. |
| S41 | **Login limiter:** 10 wrong passwords per email + IP in 15 minutes → 429 with the wait time (also blocks the correct password until then). In memory, which is enough for one server process. |
| S42 | **Sign-up limiter:** 20 per IP per hour, **production only** (local tests create many accounts). |
| S43 | The PWA manifest is `client/public/manifest.webmanifest` (spec said `public/manifest.json`; `.webmanifest` is the standard extension and gets the right content type). Icons are rendered from the logo: 192, 512, maskable 512, and an Apple touch icon. |
| S44 | `GET /api/health` returns 200 `{ ok: true }` only while the database is connected; used by Render's health check. |
| S45 | The acceptance scripts used to verify each phase are kept in `tests/acceptance` (`npm run test:api`, `npm run test:ui`), and the matching benchmark in `server/src/bench-matching.ts` (`npm run bench`), so the results in `TEST_PLAN.md` and `NON_FUNCTIONAL.md` can be reproduced. |
| S46 | Production start/seed use `--env-file-if-exists`, so hosts that set environment variables directly don't need a `.env` file. Shell variables override `.env`, which is how `npm run db:seed` targets Atlas. Node.js 22.9+ required. |
| S11 | Seed: all organisation, people and phone numbers are **fictional** (phones use the `90000xxxxx` block; extra emails use the reserved `example.com` domain). Donors are placed at real Mumbai/Thane/Navi Mumbai locality coordinates (up to ~27 km from the centre) instead of random points, so none land in the sea. |
