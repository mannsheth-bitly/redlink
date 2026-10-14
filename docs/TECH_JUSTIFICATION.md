# Feasibility Study and Technology Justification

## 1. Feasibility

### 1.1 Technical feasibility

| Question | Answer |
|---|---|
| Can the core problem be solved with standard web technology? | Yes. Matching is a filter-and-sort over donor records: compatibility table, eligibility rules, Haversine distance, a score. It needs no specialised hardware or AI. |
| Is it fast enough? | Yes. Measured on an ordinary laptop with 10,000 donors, matching takes 7–100 ms and a full broadcast (match + save + notify 50 donors) about 47 ms. The target is under 1 s. See [NON_FUNCTIONAL.md](NON_FUNCTIONAL.md). |
| Does it need skills beyond a typical final-year team? | No. JavaScript/TypeScript, React, Express and MongoDB are widely taught and documented. |
| Is location handled without paid services? | Yes. Browser GPS, a Leaflet map with free OpenStreetMap tiles, free Nominatim address search, and distance computed in code. |
| Is it reliable when two people act at once? | Yes. MongoDB transactions plus conditional updates, tested with simultaneous requests. |
| Can it run without internet (e.g. at a college demo)? | Yes. Everything runs on one laptop with local MongoDB. Only map tiles and address search need internet, and the app keeps working without them. |

### 1.2 Economic feasibility

Every component used is free and open source, or on a free tier.

| Item | Cost |
|---|---|
| Development tools (Node.js, VS Code, MongoDB Community Server, Git) | Free |
| Libraries (React, Express, Mongoose, Tailwind, shadcn/ui, Leaflet, Recharts, zod…) | Free (MIT / BSD / Apache licences) |
| Maps and address search (OpenStreetMap, Nominatim) | Free, with fair-use limits that the server respects |
| Email (Gmail SMTP with an app password) | Free for low volume |
| Hosting for a public demo (Render free web service + MongoDB Atlas M0) | Free tier |
| **Total for development and demo** | **₹0** |

For real production use, the main costs would be paid hosting (always-on server and a larger database), an SMS gateway, and a self-hosted map tile and geocoding service at scale. These are listed in [FUTURE_SCOPE.md](FUTURE_SCOPE.md).

### 1.3 Operational feasibility

- **Users already own the device.** It is a web app that works in any modern phone browser. There is nothing to download from an app store, and it can be added to the home screen (PWA).
- **Low training needed.** Each role sees only its own menu (4–6 items), with large buttons for the key actions: Accept, Record donation, CRITICAL BROADCAST.
- **It fits existing practice.** Hospitals still call donors and still test blood. Red Link replaces only the slow part: finding and reaching willing, eligible donors.
- **It can be governed.** An admin verifies institutions, suspends misuse and reviews reports, and analytics show whether it is working (fulfilment rate, time to first acceptance).
- **Privacy is acceptable to donors.** Their phone number is shared only when they choose to help.

## 2. Why each technology was chosen

| Layer | Technology | Why it was chosen | Alternatives considered |
|---|---|---|---|
| Language | **TypeScript** (front and back end) | One language everywhere. Types catch mistakes before runtime, and the shared API types make the server and browser agree. | Plain JavaScript (no type safety) |
| Front end | **React 19 + Vite + React Router** | The most widely used UI library. Vite gives instant dev reloads and small production bundles. Each page is a lazily loaded chunk. | Angular (heavier framework), Vue (equally suitable; React has the larger ecosystem and was part of the chosen MERN stack) |
| Styling | **Tailwind CSS + shadcn/ui** (Base UI primitives) | Fast, consistent styling. Accessible components (dialogs, tabs, menus) with keyboard support. Dark mode with CSS variables. | Bootstrap (dated look), Material UI (heavy) |
| Forms & validation | **react-hook-form + zod** | One zod schema validates both the form and the API, so the rules can't diverge | Hand-written validation in two places |
| Maps | **Leaflet + OpenStreetMap** | Free, no API key, works offline except for tiles | Google Maps (needs billing account and key) |
| Charts | **Recharts** | Simple React charts for the admin dashboard | Chart.js (imperative API) |
| Back end | **Node.js + Express 5** | The standard MERN back end. Simple REST routing. Express 5 handles errors from async handlers. | NestJS (more structure than needed), Django (second language) |
| Database | **MongoDB + Mongoose** | Flexible documents (donor profile and institution embedded in the user). Free local server and free Atlas tier. Supports transactions as a replica set. | PostgreSQL (also a good fit; the owner chose MongoDB for the MERN stack) |
| Auth | **bcryptjs + jose (JWT) in an httpOnly cookie** | Transparent and easy to explain. Passwords are hashed with salt. The token can't be read by page scripts. | Third-party auth (needs internet and accounts) |
| Notifications | **In-app polling + Nodemailer email** | Polling every 10 s is simple and works behind any network. Email covers URGENT / CRITICAL alerts. A `NotificationChannel` interface leaves room for SMS and push. | WebSockets (more moving parts), paid SMS |
| Address search | **OpenStreetMap Nominatim** (proxied by the server) | Free. The server enforces the usage policy (1 request/s, caching, India only, identifying header). | Google Places (paid) |
| Testing | **Vitest** (unit) + scripted **API checks** + **Playwright** (browser) | Fast unit tests for the domain rules. End-to-end checks of every phase's acceptance criteria. | Jest (slower with ESM/TypeScript) |
| Linting | **oxlint** | Very fast. Ships with the Vite React template. | ESLint |
| Packaging | **npm workspaces** (`shared`, `server`, `client`) | One repository with shared code, without publishing packages | Separate repositories (code duplication) |
