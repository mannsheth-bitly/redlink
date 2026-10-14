# Red Link: Build Specification for Claude Code

> **How to use this file**
> 1. Create a new empty folder (for example `red-link`) and put this file in it.
> 2. Open that folder in Claude Code.
> 3. Say: **"Read RED_LINK_BUILD_SPEC.md and build Phase 1. Stop when Phase 1's acceptance checks pass."**
> 4. Repeat for each phase ("Now build Phase 2", and so on). Building phase by phase gives you a working app at every step, so you always have something to demo.
>
> Every open question from the original concept doc has been answered in **Section 2 (Locked Decisions)**. To change a decision, edit this file *before* building that phase.

---

## 0. Instructions to Claude Code

- This spec is the source of truth. If it's ambiguous or something isn't covered, **ask the project owner instead of assuming**. Record each answer in `docs/DECISIONS.md`.
- Build one phase at a time (Section 14). After each phase, run `npm run build`, `npm run lint` and `npm test`. Fix all errors, then summarize what was built and how to try it.
- Keep it simple. This is an academic project that will be demoed live. Reliability matters more than cleverness. Don't add features outside this spec.
- Use TypeScript everywhere, with strict mode on. Don't use `any` unless there's no reasonable alternative.
- Put all domain logic (blood compatibility, eligibility, matching, scoring) in pure functions under `src/lib/domain/`, and unit-test them.
- Never commit `.env`. Provide `.env.example`.
- The app must run fully offline after `npm install` (no paid APIs, no API keys needed), because the college network during the presentation may be unreliable. The only exception is map tiles, and the app must still work if they fail to load.

---

## 1. Project Summary

**Red Link** is a blood donation platform. It connects willing donors with patients, hospitals, emergency services and blood banks, and it does the matching automatically using **blood group compatibility, distance, availability and donation eligibility**.

**Problem:** Urgent blood requests usually travel through slow, informal channels like phone calls, WhatsApp forwards and walk-ins, and that costs critical time.
**Solution:** A role-based web app. Requesters broadcast a need, the system immediately finds compatible, eligible, nearby donors, notifies them, and tracks each request until it's fulfilled.

---

## 2. Locked Decisions (answers to the open questions)

| # | Question | Decision |
|---|---|---|
| 1 | Roles 5 and 6 | **Blood Bank** and **Admin**. That gives 6 roles in total: Donor, Receiver, Hospital, Emergency Service, Blood Bank, Admin. |
| 2 | Mobile app, web app, or both? | A **responsive, mobile-first web app** with an installable PWA manifest. It's one codebase that works on phones and laptops and is easy to demo on a projector. |
| 3 | Donor contact privacy | **Masked by default.** Receivers see first name + last initial, blood group and approximate distance. A receiver sends a *contact request*. The donor's phone number is shown only after the donor accepts. Hospitals and emergency services see the phone number of donors who **accepted** their request. |
| 4 | Blood group verification | **Self-reported at signup.** It gets a **"Verified" badge** automatically once a hospital or blood bank records a donation by that donor, because the blood is tested at that point. |
| 5 | Blood bank inventory in the MVP? | **Yes, kept simple:** units per blood group, adjust up/down, a low-stock warning, and offering units against open requests. |
| 6 | Tech stack | **React + Express + Node.js + MongoDB** (TypeScript), owner decision after Phase 5. See Section 3. |
| 7 | Notifications | **In-app notifications** with polling every 10 s. Urgent and critical alerts show a red banner and play a sound. SMS and push are listed as future scope, and the code puts sending behind a `NotificationChannel` interface so they can be added later. |
| 8 | Location | Browser GPS ("Use my location") **or** picking a point on a Leaflet/OpenStreetMap map. Lat/lng and the city/pincode are stored. Distance is calculated with the Haversine formula in code. |
| 9 | Tech stack confirmed by owner? | **Changed by the owner:** React (Vite) + Express + Node.js + MongoDB, TypeScript, local MongoDB. Address search (OpenStreetMap Nominatim) and email alerts (Nodemailer) added. |
| 10 | Existing mockup to match? | **No.** Design fresh, following Section 11. |
| 11 | Where the code lives | `C:\Projects\red-link-mern` (outside OneDrive so `node_modules` isn't synced). The earlier Next.js build is kept in `C:\Projects\red-link` for reference. |

---

## 3. Tech Stack

| Layer | Choice | Why (use this for the "technology justification" section) |
|---|---|---|
| Frontend | **React + Vite + React Router + TypeScript** | Fast single-page app, widely taught, mobile-friendly |
| Backend | **Node.js + Express + TypeScript** | Simple REST API, the standard MERN back end |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible components |
| Database | **MongoDB through Mongoose**, run locally as a single-node replica set (needed for transactions); MongoDB Atlas free tier for a public deployment | Flexible documents (donor profile and institution embedded in the user); works offline for demos |
| Auth | Custom email + password: **bcryptjs** hashing, **jose** JWT in an httpOnly cookie, role checks in Express middleware | Simple, transparent and easy to explain |
| Validation | **zod** | Shared validation for forms and API |
| Forms | **react-hook-form** | |
| Maps | **Leaflet + react-leaflet + OpenStreetMap tiles** (lazy-loaded with `React.lazy`) | Free, no API key |
| Charts | **Recharts** | Admin analytics |
| Tests | **Vitest** | Unit tests for domain logic |
| Address search | **OpenStreetMap Nominatim** (free, no key; proxied and rate-limited by the server) | Owner decision |
| Email | **Nodemailer** (e.g. Gmail app password), URGENT/CRITICAL alerts only | Owner decision; optional |
| Hosting | Any Node host (e.g. Render) + **MongoDB Atlas** free tier | Optional, for a public demo URL |

Note: enum-like fields are stored as strings with Mongoose `enum` validation; the allowed values are TypeScript `const` arrays/unions in `shared/src/domain/constants.ts`, also validated with zod.

---

## 4. Roles & Permissions

| Capability | Donor | Receiver | Hospital | Emergency | Blood Bank | Admin |
|---|---|---|---|---|---|---|
| Needs admin verification before use | – | – | ✅ | ✅ | ✅ | – |
| Set availability / view matched request feed | ✅ | – | – | – | – | – |
| Accept / decline a request | ✅ | – | – | – | – | – |
| Search donors (masked) | – | ✅ | ✅ | ✅ | – | ✅ |
| Send contact request to a donor | – | ✅ | – | – | – | – |
| Create blood request, urgency NORMAL / URGENT | – | ✅ | ✅ | ✅ | – | – |
| Create blood request, urgency CRITICAL | – | – | – | ✅ | – | – |
| See phones of donors who accepted | – | own requests | own requests | own requests | – | ✅ |
| Record a donation (gives the Verified badge) | – | – | ✅ | ✅ own requests | ✅ | – |
| Manage inventory, post donation camps | – | – | – | – | ✅ | – |
| Offer units to an open request | – | – | – | – | ✅ | – |
| Verify institutions, suspend users, review flags, analytics | – | – | – | – | – | ✅ |
| Report (flag) a user or request | ✅ | ✅ | ✅ | ✅ | ✅ | – |

Requests created by Receivers show an **"Individual request"** badge. Requests from verified institutions show a **"Verified institution"** badge.

---

## 5. Domain Rules (implement as pure functions + unit tests)

### 5.1 Blood groups
`O-`, `O+`, `A-`, `A+`, `B-`, `B+`, `AB-`, `AB+`. Store them exactly as these strings.

### 5.2 Compatibility (red-cell transfusion): who a recipient can receive from

| Recipient | Compatible donors |
|---|---|
| O- | O- |
| O+ | O-, O+ |
| A- | O-, A- |
| A+ | O-, O+, A-, A+ |
| B- | O-, B- |
| B+ | O-, O+, B-, B+ |
| AB- | O-, A-, B-, AB- |
| AB+ | all eight |

Functions: `compatibleDonorGroups(recipient)` and `canDonateTo(donor, recipient)`.

### 5.3 Donor eligibility: `isEligible(donor, now)`
A donor is eligible only if **all** of these are true:
- `isAvailable === true`, and the account status is `ACTIVE`
- age is 18–65 (from `dateOfBirth`)
- weight ≥ 50 kg
- `lastDonationAt` is null **or** at least **90 days** ago (put this in a constant `DONATION_COOLDOWN_DAYS = 90`)

Also return `nextEligibleDate` and a reason string, so the UI can show something like "You can donate again on 12 Jan 2027".

### 5.4 Search radius by urgency
| Urgency | Initial radius | Escalation |
|---|---|---|
| NORMAL | 10 km | none |
| URGENT | 25 km | manual "Expand radius" button (+25 km, max 75 km) |
| CRITICAL | 50 km | **automatic**: if fewer than 3 donors have accepted after 10 minutes, expand to 100 km and notify the new matches. This is checked lazily whenever the request is viewed or the notifications endpoint is polled. |

### 5.5 Matching: `findMatches(request, donors)`
1. Filter: compatible blood group, eligible, distance ≤ radius, not the request creator, and not already matched to this request.
2. Score (0–100):
   - `+30` if the blood group is an **exact** match (this keeps universal O- donors free for cases that truly need them)
   - `+50 × (1 − distanceKm / radiusKm)` for proximity
   - `+20` if `bloodGroupVerified`
3. Sort by score, highest first. Notify at most **50** donors per request (or per escalation step).
4. Save a `RequestMatch` row for each one (status `NOTIFIED`) and create a notification.

### 5.6 Distance
`haversineKm(a, b)`. Before running Haversine, prefilter in the database with a lat/lng bounding box. Show distances to the public rounded to the nearest 0.5 km, and never expose a donor's exact coordinates to other users.

### 5.7 Request lifecycle
`OPEN → PARTIALLY_FULFILLED → FULFILLED`, or `CANCELLED`, or `EXPIRED` (when `neededBy` has passed; checked lazily on read).
- `unitsFulfilled` goes up when a donation is recorded or a blood-bank supply offer is accepted.
- When `unitsFulfilled >= unitsNeeded`: set status `FULFILLED`, and tell every matched donor who hasn't donated yet "No longer needed, thank you!".

---

## 6. Data Model

> **MERN build:** these entities are implemented as Mongoose models in `server/src/models.ts`. `DonorProfile` and `Institution` are embedded inside `User` (one-to-one, always read together); the rest are separate collections. Field names are unchanged. The Prisma schema below is kept as the reference definition.

Use this schema. Small additions are fine, but don't rename things.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"  url = env("DATABASE_URL") }

model User {
  id            String   @id @default(cuid())
  role          String   // DONOR | RECEIVER | HOSPITAL | EMERGENCY | BLOOD_BANK | ADMIN
  status        String   @default("ACTIVE") // PENDING_VERIFICATION | ACTIVE | SUSPENDED | REJECTED
  name          String
  email         String   @unique
  phone         String
  passwordHash  String
  lat           Float?
  lng           Float?
  address       String?
  city          String?
  pincode       String?
  createdAt     DateTime @default(now())

  donorProfile     DonorProfile?
  institution      Institution?
  requestsCreated  BloodRequest[]    @relation("RequestCreator")
  matches          RequestMatch[]
  donations        DonationRecord[]  @relation("DonorDonations")
  recordedDonations DonationRecord[] @relation("RecordedBy")
  notifications    Notification[]
  contactRequestsSent     ContactRequest[] @relation("ContactReceiver")
  contactRequestsReceived ContactRequest[] @relation("ContactDonor")
  inventory        InventoryItem[]
  camps            DonationCamp[]
  supplyOffers     SupplyOffer[]
  flagsRaised      Flag[] @relation("FlagReporter")
  flagsAgainst     Flag[] @relation("FlagTarget")
}

model DonorProfile {
  userId             String   @id
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bloodGroup         String
  dateOfBirth        DateTime
  gender             String   // MALE | FEMALE | OTHER
  weightKg           Float
  lastDonationAt     DateTime?
  isAvailable        Boolean  @default(true)
  bloodGroupVerified Boolean  @default(false)
}

model Institution {
  userId        String   @id
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          String   // HOSPITAL | EMERGENCY | BLOOD_BANK
  orgName       String
  licenseNumber String
  verifiedAt    DateTime?
  verifiedById  String?
  rejectionNote String?
}

model BloodRequest {
  id             String   @id @default(cuid())
  createdById    String
  createdBy      User     @relation("RequestCreator", fields: [createdById], references: [id])
  bloodGroup     String
  unitsNeeded    Int
  unitsFulfilled Int      @default(0)
  urgency        String   // NORMAL | URGENT | CRITICAL
  status         String   @default("OPEN")
  patientNote    String?  // e.g. "Accident case, ICU" (no patient identity needed)
  hospitalName   String   // where to donate
  lat            Float
  lng            Float
  radiusKm       Float
  neededBy       DateTime
  createdAt      DateTime @default(now())
  fulfilledAt    DateTime?
  lastEscalatedAt DateTime?

  matches        RequestMatch[]
  donations      DonationRecord[]
  supplyOffers   SupplyOffer[]
}

model RequestMatch {
  id          String   @id @default(cuid())
  requestId   String
  request     BloodRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  donorId     String
  donor       User     @relation(fields: [donorId], references: [id])
  distanceKm  Float
  score       Float
  status      String   @default("NOTIFIED") // NOTIFIED | ACCEPTED | DECLINED | DONATED | NO_LONGER_NEEDED
  notifiedAt  DateTime @default(now())
  respondedAt DateTime?
  @@unique([requestId, donorId])
}

model DonationRecord {
  id           String   @id @default(cuid())
  donorId      String
  donor        User     @relation("DonorDonations", fields: [donorId], references: [id])
  requestId    String?
  request      BloodRequest? @relation(fields: [requestId], references: [id])
  recordedById String
  recordedBy   User     @relation("RecordedBy", fields: [recordedById], references: [id])
  units        Int      @default(1)
  donatedAt    DateTime @default(now())
  location     String
}

model ContactRequest {
  id         String   @id @default(cuid())
  receiverId String
  receiver   User     @relation("ContactReceiver", fields: [receiverId], references: [id])
  donorId    String
  donor      User     @relation("ContactDonor", fields: [donorId], references: [id])
  message    String
  status     String   @default("PENDING") // PENDING | ACCEPTED | DECLINED
  createdAt  DateTime @default(now())
  respondedAt DateTime?
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // REQUEST_MATCH | REQUEST_UPDATE | CONTACT_REQUEST | CONTACT_RESPONSE | VERIFICATION | SUPPLY_OFFER | SYSTEM
  priority  String   @default("NORMAL") // NORMAL | URGENT | CRITICAL
  title     String
  body      String
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
}

model InventoryItem {
  id          String   @id @default(cuid())
  bloodBankId String
  bloodBank   User     @relation(fields: [bloodBankId], references: [id])
  bloodGroup  String
  units       Int      @default(0)
  lowStockThreshold Int @default(5)
  updatedAt   DateTime @updatedAt
  @@unique([bloodBankId, bloodGroup])
}

model SupplyOffer {
  id          String   @id @default(cuid())
  requestId   String
  request     BloodRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  bloodBankId String
  bloodBank   User     @relation(fields: [bloodBankId], references: [id])
  units       Int
  status      String   @default("PENDING") // PENDING | ACCEPTED | DECLINED
  createdAt   DateTime @default(now())
}

model DonationCamp {
  id          String   @id @default(cuid())
  bloodBankId String
  bloodBank   User     @relation(fields: [bloodBankId], references: [id])
  title       String
  description String
  startsAt    DateTime
  endsAt      DateTime
  address     String
  lat         Float
  lng         Float
}

model Flag {
  id           String   @id @default(cuid())
  reporterId   String
  reporter     User     @relation("FlagReporter", fields: [reporterId], references: [id])
  targetUserId String?
  targetUser   User?    @relation("FlagTarget", fields: [targetUserId], references: [id])
  requestId    String?
  reason       String
  status       String   @default("OPEN") // OPEN | RESOLVED | DISMISSED
  createdAt    DateTime @default(now())
}
```

---

## 7. Key Flows

**A. Hospital / Emergency broadcast (the core flow)**
1. The institution fills in: blood group, units, urgency, needed-by, note, and location (defaults to the institution's address).
2. The server validates the input, creates a `BloodRequest`, runs `findMatches`, and creates `RequestMatch` and `Notification` rows inside **one transaction**.
3. Donors see a banner or notification and open the request (blood group, units, hospital, distance, urgency) → **Accept** / **Decline**.
4. The institution's request page shows a live ranked list: accepted donors (with phone + "Record donation" button), then notified donors (masked), then declined donors.
5. "Record donation" creates a `DonationRecord`, sets the match to `DONATED`, sets donor `lastDonationAt = now`, sets `bloodGroupVerified = true`, and increases `unitsFulfilled` (see 5.7).

**B. Receiver search & contact**
1. The receiver searches by blood group (they enter the *patient's* group and results include compatible donors) with filters: radius (5/10/25/50 km), "available now", "verified only".
2. Results are masked cards: "Rahul S. · O+ · ~3.5 km · Verified".
3. "Request contact" sends a short message, which creates a `ContactRequest` and a notification to the donor.
4. If the donor accepts, the phone number is visible to the receiver and the receiver's number to the donor. If the donor declines, the receiver is told politely.
5. Alternatively, the receiver can "Raise a request" (same as Flow A, but NORMAL or URGENT only).

**C. Institution signup & verification**
1. Sign up as Hospital / Emergency / Blood Bank → status `PENDING_VERIFICATION`. After login they only see an "Awaiting verification" screen.
2. Admin → Verification queue → Approve (status `ACTIVE`, `verifiedAt` set) or Reject (with a note). The applicant gets a notification either way.

**D. Blood bank supply**
1. The blood bank sees open requests within 50 km where it has stock of a compatible group → "Offer N units".
2. The requester gets a notification and accepts the offer → inventory goes down and `unitsFulfilled` goes up.

---

## 8. Pages (App Router)

**Public:** `/` (landing page: problem, how it works, live stats, compatibility chart), `/login`, `/signup` (role picker → role-specific form with a map location picker), `/about`.

**Donor** (`/donor`)
- `/donor`: home with an availability toggle, eligibility card (eligible / next eligible date), matched open requests feed (sorted by urgency, then distance), and nearby upcoming camps
- `/donor/requests/[id]`: request detail + Accept/Decline
- `/donor/contacts`: incoming contact requests
- `/donor/history`: donation history + total lives impacted (units × 3)
- `/donor/profile`

**Receiver** (`/receiver`)
- `/receiver`: donor search + results (list view and map view)
- `/receiver/requests/new`, `/receiver/requests/[id]`
- `/receiver/contacts`: sent contact requests and their status

**Hospital** (`/hospital`) and **Emergency** (`/emergency`): these share components
- dashboard: open requests with progress bars (units fulfilled/needed), accepted-donor counts, quick "New request" button
- `/requests/new`, `/requests/[id]` (ranked donor list, record donation, expand radius, mark cancelled, supply offers)
- `/donations`: donations recorded by this institution
- The Emergency dashboard has a large red **"CRITICAL BROADCAST"** button that pre-fills urgency = CRITICAL

**Blood Bank** (`/bloodbank`)
- dashboard: an 8-tile inventory grid (low stock in red), quick adjust buttons
- `/bloodbank/requests`: nearby open requests it can supply
- `/bloodbank/camps`: create/list camps
- `/bloodbank/donations`: record a walk-in donation (search donor by email/phone)

**Admin** (`/admin`)
- `/admin`: analytics: total donors, available now, open requests, fulfilled this month, fulfilment rate, **average time to first acceptance**, chart of requests by blood group, chart of requests over the last 14 days
- `/admin/verifications`, `/admin/users` (search, suspend/reactivate), `/admin/flags`

**Shared:** notification bell + dropdown on every logged-in page, `/notifications` full list, and an urgent banner component.

---

## 9. API (Route Handlers under `src/app/api/`)

Every handler validates input with zod, checks the session and role, and returns JSON errors in the form `{ error: string }` with the right status codes.

```
POST   /api/auth/signup              POST /api/auth/login        POST /api/auth/logout     GET /api/auth/me
PATCH  /api/donor/availability       GET  /api/donor/feed        GET  /api/donor/history
POST   /api/matches/[id]/respond     { action: "ACCEPT" | "DECLINE" }
GET    /api/donors/search            ?bloodGroup&lat&lng&radiusKm&verifiedOnly
POST   /api/contact-requests         POST /api/contact-requests/[id]/respond   GET /api/contact-requests
POST   /api/requests                 GET  /api/requests (own)    GET /api/requests/[id]
POST   /api/requests/[id]/expand     POST /api/requests/[id]/cancel
POST   /api/requests/[id]/donations  { donorId, units }
GET    /api/notifications            (also runs lazy expiry + CRITICAL auto-escalation)
POST   /api/notifications/read       { ids | "all" }
GET/PATCH /api/bloodbank/inventory   GET/POST /api/bloodbank/camps   GET /api/bloodbank/open-requests
POST   /api/supply-offers            POST /api/supply-offers/[id]/respond
POST   /api/bloodbank/donations      (walk-in)
GET    /api/admin/stats              GET /api/admin/verifications   POST /api/admin/verifications/[userId]
GET    /api/admin/users              PATCH /api/admin/users/[id]    GET/PATCH /api/admin/flags
POST   /api/flags
GET    /api/public/stats             (landing page)
```

Server Actions are fine instead of route handlers, but stay consistent within a feature.

---

## 10. Notifications

- `src/lib/notify.ts` exports `notify(userIds, payload)`. It writes `Notification` rows and calls every registered `NotificationChannel` (only `InAppChannel` for now, with stubs for `SmsChannel` and `PushChannel` that just log).
- The client polls `GET /api/notifications` every **10 s** (every 5 s when there's an unread URGENT/CRITICAL notification).
- An unread CRITICAL or URGENT notification shows a sticky red banner at the top and plays a short sound once (`/public/alert.mp3`, or generate a beep with the Web Audio API).

---

## 11. UI / Design Guidelines

- **Mobile-first**, and it must look good at 375 px wide and on a laptop/projector.
- Brand: a deep blood-red primary (`#B91C1C`), white/neutral surfaces, one accent for "available/success" (green). Support dark mode.
- Logo: a blood drop with a chain link inside, as inline SVG. The wordmark is "Red Link".
- Urgency badges: NORMAL (grey), URGENT (amber), CRITICAL (red, pulsing).
- Blood group shown as a bold pill (e.g. **O−**) everywhere.
- Empty states, loading skeletons and toast messages for every action.
- Accessible: proper labels, keyboard navigation, colour is never the only signal.
- If the user provides their existing 3-screen mockup (Donor Home, Hospital/Emergency Broadcast, Receiver Search), match its layout and style for those screens.

---

## 12. Seed Data & Demo Accounts

`npm run db:seed` must reset the DB and create realistic **Mumbai** data (centred around Vidyavihar/Ghatkopar, about 19.07 N, 72.90 E):

| Role | Email | Password |
|---|---|---|
| Admin | admin@redlink.test | demo1234 |
| Hospital (verified) | hospital@redlink.test | demo1234 |
| Emergency (verified) | emergency@redlink.test | demo1234 |
| Blood Bank (verified) | bloodbank@redlink.test | demo1234 |
| Hospital (pending verification) | newhospital@redlink.test | demo1234 |
| Receiver | receiver@redlink.test | demo1234 |
| Donor (O−, available, eligible) | donor@redlink.test | demo1234 |

Plus:
- **40 donors** spread 0–30 km around the centre with realistic Indian names and a realistic blood-group distribution (O+ ~35%, B+ ~30%, A+ ~20%, AB+ ~7%, negatives ~8%). Some unavailable, some in cooldown, some verified.
- 2 more verified hospitals, 6 past fulfilled requests with donation records (so the analytics and history pages have data), 2 open requests, inventory for the blood bank (one group low on stock), 2 upcoming camps, and 1 open flag.
- Show the demo accounts on the login page in a collapsible "Demo accounts" box (only when `NEXT_PUBLIC_DEMO_MODE=true`).

---

## 13. Project Structure

```
red-link/
├─ shared/ (src/domain, src/validators.ts, src/api.ts, tests/)
├─ server/ (src: app.ts, models.ts, auth.ts, notify.ts, routes/, services/, seed.ts)
├─ client/ (src: pages/, components/, lib/)
├─ public/ (manifest.json, icons, alert.mp3)
├─ src/
│  ├─ app/ (route groups: (public), donor, receiver, hospital, emergency, bloodbank, admin, api)
│  ├─ components/ (ui/ from shadcn, shared/, map/, charts/)
│  ├─ lib/
│  │  ├─ domain/ (constants.ts, compatibility.ts, eligibility.ts, matching.ts, geo.ts, requests.ts)
│  │  ├─ auth.ts, db.ts, notify.ts, validators.ts
│  └─ middleware.ts (role-based route protection)
├─ tests/ (domain unit tests)
├─ docs/ (academic deliverables, see Section 16)
├─ .env.example, README.md, RED_LINK_BUILD_SPEC.md
```

Scripts: `dev`, `build`, `start`, `lint`, `test`, `db:push`, `db:seed`, `db:reset` (push + seed).

---

## 14. Build Phases (build one at a time)

**Phase 1: Foundation**
Set up Next.js + Tailwind + shadcn + Prisma (SQLite) and the full schema. Add the domain functions (Section 5) **with Vitest tests**, auth (signup/login/logout, JWT cookie, middleware role guards), the role-aware layout and navigation, the landing page and the seed script.
✅ Accept when: all 6 demo accounts can log in and are sent to their own dashboard (even if it's a placeholder), wrong-role URLs redirect, and the domain tests pass (compatibility table fully covered, cooldown edge cases, scoring order).

**Phase 2: Donor + Request broadcast (core loop)**
Donor home, availability toggle, eligibility card, profile with a map location picker. Hospital/Emergency request creation, matching, notifications (bell + polling + urgent banner), donor accept/decline, the institution's ranked donor list and "Record donation".
✅ Accept when: logging in as hospital and creating an O+ URGENT request makes it appear for compatible nearby donors only. A donor accepts, and the hospital sees their phone and records the donation. The donor's history updates, they get the Verified badge, and cooldown starts.

**Phase 3: Receiver**
Masked donor search (list + map), contact request flow, receiver-raised requests.
✅ Accept when: the phone number is never sent to the receiver's browser before the donor accepts (check the network responses).

**Phase 4: Emergency, escalation & lifecycle**
CRITICAL broadcast button, manual and automatic radius expansion, expiry, cancellation, "no longer needed" notifications.

**Phase 5: Blood Bank**
Inventory grid, camps (shown in the donor feed), supply offers, walk-in donations.

**Phase 6: Admin**
Verification queue, user management, flags, analytics dashboard with charts.

**Phase 7: Polish & docs**
Responsive QA at 375 px, dark mode, empty/loading states, PWA manifest, README with setup steps and screenshots, and every file in `docs/` (Section 16). Optional: deploy to Vercel + Neon and record the URL in the README.

---

## 15. Testing

- **Unit (Vitest):** compatibility (all 64 pairs), eligibility (age, weight, cooldown boundaries at 89/90 days), Haversine (known distance, e.g. CSMT → Ghatkopar ≈ 12–13 km), scoring and sort order, request status transitions.
- **Manual checklist** in `docs/TEST_PLAN.md`: one scripted scenario per role, written as a table with Test ID, Steps, Expected and Result, which you can include in the report.

---

## 16. Academic Deliverables (`docs/` folder)

Write these in Markdown, and draw the diagrams in **Mermaid** so they render on GitHub and can be exported as images:

1. `PROBLEM_STATEMENT.md`: problem, objectives, scope, target users
2. `ARCHITECTURE.md`: system architecture diagram (React client → Express API → domain services → Mongoose → MongoDB; notification channels; map tiles) + explanation
3. `ER_DIAGRAM.md`: Mermaid `erDiagram` generated from the Mongoose models
4. `DFD.md`: Level 0 (context) and Level 1 data flow diagrams
5. `USE_CASES.md`: use-case diagram + one use-case table per role
6. `SEQUENCE_DIAGRAMS.md`: emergency broadcast flow, contact-request flow, institution verification
7. `MATCHING_ALGORITHM.md`: the compatibility table, eligibility rules, scoring formula with a worked example, and pseudocode
8. `TECH_JUSTIFICATION.md`: feasibility (technical, economic, operational) + why each technology was chosen
9. `NON_FUNCTIONAL.md`: performance (matching runs in under 1 s for 10k donors with the bounding-box prefilter), security (bcrypt, httpOnly JWT, role guards, masked PII), privacy, scalability notes (Postgres + PostGIS, a queue for notifications, WebSockets)
10. `TEST_PLAN.md`
11. `FUTURE_SCOPE.md`: SMS/WhatsApp/push alerts, native app, AI-based demand forecasting per blood group, integration with e-RaktKosh / government blood bank databases, blood test report upload and OCR verification, gamification and donor rewards, multi-language support (Hindi/Marathi), platelet/plasma donation types

---

## 17. Out of Scope (MVP)

Real SMS/push/WhatsApp, native mobile apps, payments, document/file uploads, real-time chat, multi-language support, and integration with government databases. Mention these in Future Scope; don't build them.
