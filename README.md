# Red Link

A blood donation platform that connects donors with patients, hospitals, emergency services and blood banks, and matches them automatically using **blood group compatibility, distance, availability and donation eligibility**.

**Stack:** React (Vite) + Express + Node.js + MongoDB, all in TypeScript. Mobile-first and installable on phones (PWA).

**Live demo:** https://red-link-1hq1.onrender.com (free hosting: the first visit after ~15 minutes idle can take up to a minute to wake up). Demo logins are listed on the login page; password `demo1234`.

- Full specification: [`RED_LINK_BUILD_SPEC.md`](RED_LINK_BUILD_SPEC.md)
- Decisions made during the build: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Academic documents (architecture, ER diagram, DFDs, use cases, sequence diagrams, matching algorithm, feasibility, non-functional requirements, test plan, future scope): [`docs/`](docs/README.md)

![Red Link landing page](docs/screenshots/01-landing.png)

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: data model, domain logic + tests, auth, role layouts, landing page, seed | ✅ Done |
| 2 | Donor + request broadcast (core loop) | ✅ Done |
| 3 | Receiver search & contact | ✅ Done |
| 4 | Emergency, escalation & lifecycle | ✅ Done |
| 5 | Blood bank | ✅ Done |
| 6 | Admin: analytics + charts, verification queue, users (suspend/reactivate), flags, all requests | ✅ Done |
| 7 | Polish & docs: 375 px / dark-mode QA, PWA, security hardening, academic docs, screenshots, deployment config | ✅ Done |

## Screenshots

| | |
|---|---|
| ![Donor home](docs/screenshots/02-donor-home.png) **Donor home**: availability, eligibility, matched requests, nearby camps | ![Donor request](docs/screenshots/03-donor-request.png) **Request detail**: compatibility note, Accept / Decline |
| ![Hospital request](docs/screenshots/04-hospital-request.png) **Hospital request page**: live ranked donors, phone after acceptance, Record donation | ![Receiver search](docs/screenshots/05-receiver-search.png) **Receiver search**: masked results, list or map |
| ![Emergency dashboard](docs/screenshots/06-emergency-dashboard.png) **Emergency dashboard**: CRITICAL BROADCAST | ![Blood bank inventory](docs/screenshots/07-bloodbank-inventory.png) **Blood bank inventory**: low stock in red |
| ![Admin analytics](docs/screenshots/08-admin-analytics.png) **Admin analytics**: totals, fulfilment rate, time to first acceptance, charts | ![Mobile](docs/screenshots/09-mobile-donor.png) ![Mobile dark](docs/screenshots/10-mobile-admin-dark.png) **On a phone**, light and dark |

## Project structure

```
shared/            Domain rules (compatibility, eligibility, matching, geo, requests, inventory,
                   analytics, moderation), zod validators and API response types — used by BOTH
                   server and client. shared/tests = Vitest unit tests (187).
server/            Express API + Mongoose models, auth, services, notifications (in-app + email),
                   seed (src/seed.ts) and matching benchmark (src/bench-matching.ts).
client/            React app (Vite, React Router, Tailwind, shadcn/ui, Leaflet maps, Recharts).
                   client/public = PWA manifest and icons.
tests/acceptance/  API checks per phase (api/p1–p6) and browser checks (ui/) — see docs/TEST_PLAN.md.
docs/              Academic documents, decisions log, screenshots.
render.yaml        One-click deployment config for Render (+ MongoDB Atlas).
```

## Requirements

- **Node.js** 22.9+ (built with Node.js 24 LTS)
- **MongoDB** 7+ running as a **replica set** (needed for transactions). A single-node replica set on your own PC is enough. See below.

### MongoDB as a single-node replica set (Windows)

1. Install MongoDB Community Server and MongoDB Shell (e.g. `winget install MongoDB.Server MongoDB.Shell`).
2. As administrator, edit `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg` and add:
   ```yaml
   replication:
     replSetName: rs0
   ```
3. Restart the service (`Restart-Service MongoDB` in an admin PowerShell).
4. Once only: `mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"`

## Setup

```bash
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# Edit .env: set JWT_SECRET to a long random string
npm run db:seed               # load the Mumbai demo data
npm run dev                   # API on :4000 + React app on :5173
```

Open **http://localhost:5173**.

### Single-port demo mode (for the presentation)

```bash
npm run build                 # typecheck everything + build the React app
npm start                     # Express serves the API AND the app on http://localhost:4000
```

This works with no internet connection. Only the map images and address search need it, and the app keeps working without them.

### Install on a phone

Open the site in Chrome (Android) or Safari (iPhone), then choose **Install app** / **Add to Home Screen**. It opens full-screen with the Red Link icon. For a phone on the same Wi-Fi as the laptop, use the laptop's IP address, e.g. `http://192.168.1.5:4000`. Browsers only offer installation on `https://` sites or `localhost`, so to *install* on a phone use the deployed site (below).

### Optional: email alerts

URGENT and CRITICAL alerts can also be sent by email (in-app notifications always work).
In `.env`, set `SMTP_USER` and `SMTP_PASS` (for Gmail, use an App Password: Google Account → Security → 2-Step Verification → App passwords). Emails are never sent to the demo accounts' reserved domains (`.test`, `example.com`).

### Optional: address search

Location pickers have an address search powered by OpenStreetMap Nominatim (free, no key). It needs internet; "Use my location" and clicking the map work offline.

## Demo accounts

All passwords are `demo1234`. They're also listed on the login page when `VITE_DEMO_MODE=true`.

| Role | Email |
|---|---|
| Admin | admin@redlink.test |
| Hospital (verified) | hospital@redlink.test |
| Emergency (verified) | emergency@redlink.test |
| Blood Bank (verified) | bloodbank@redlink.test |
| Hospital (pending verification) | newhospital@redlink.test |
| Receiver | receiver@redlink.test |
| Donor (O−, available, eligible) | donor@redlink.test |

All people, phone numbers and organisations in the demo data are fictional.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API (watch mode) + React dev server |
| `npm run build` | Typecheck shared, server and client; build the React app |
| `npm start` | Run the API and serve the built app on one port |
| `npm run lint` | oxlint (0 warnings) |
| `npm test` | Vitest unit tests for the domain logic (187) |
| `npm run test:api` | API acceptance checks for Phases 1–6 (307). Needs the app running; re-seeds the database. |
| `npm run test:ui` | Browser checks (149). Needs the app running; first time: `npx playwright install chromium` |
| `npm run bench` | Matching benchmark with 10,000 synthetic donors (uses a separate database) |
| `npm run db:seed` / `npm run db:reset` | Drop the database and load the demo data |

## Deploying online (Render + MongoDB Atlas, free tiers)

1. **Database:** create a free **MongoDB Atlas** M0 cluster.
   - Add a database user.
   - Under *Network Access*, allow `0.0.0.0/0` (Render's free tier has no fixed IP).
   - Copy the connection string and add the database name: `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/redlink?retryWrites=true&w=majority`.
   - Atlas is a replica set, so transactions work.
2. **Code:** push this folder to a GitHub repository. `.env` is git-ignored and is never uploaded.
3. **Web service:** on **Render**, choose *New → Blueprint* and pick the repository. `render.yaml` sets up everything:
   - build command `npm ci --include=dev && npm run build`, start command `npm start`;
   - health check `/api/health`;
   - a generated `JWT_SECRET`.
   
   When asked, paste:
   - `MONGODB_URI`: the Atlas string from step 1;
   - `APP_URL`: your Render URL, e.g. `https://red-link.onrender.com`;
   - `GEOCODER_CONTACT`: an email address for the address-search usage policy;
   - optionally `SMTP_USER` / `SMTP_PASS`.
4. **Demo data:** load it into Atlas once, from your PC:
   ```powershell
   $env:MONGODB_URI = "mongodb+srv://...atlas string.../redlink?retryWrites=true&w=majority"; npm run db:seed
   ```
   (`MONGODB_URI` set in the shell takes priority over `.env`.) Run it again any time to reset the public demo.

Notes:
- Render's free tier sleeps after about 15 minutes without visitors, so the first page load after that can take up to a minute. Open the site a few minutes before presenting.
- The public demo shows the demo accounts on the login page, so anyone can log in and change the demo data. Re-seed to reset it.

## API

All endpoints are under `/api` and return JSON. Errors are `{ "error": "message" }` with a matching status code. See spec Section 9, plus these additions:

- `GET /api/donor/camps`, `PATCH /api/donor/profile`
- `GET /api/donations`, `GET /api/hospitals`
- `GET /api/bloodbank/donors/lookup`, `GET /api/geocode`
- `GET /api/admin/requests`, `GET /api/health`

`POST /api/flags` takes `{ kind: "REQUEST", requestId }`, `{ kind: "MATCH", matchId }` or `{ kind: "CONTACT", contactRequestId }` plus a `reason`.
