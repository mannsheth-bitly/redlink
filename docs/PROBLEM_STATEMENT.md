# Problem Statement

## 1. Background

When a patient needs blood urgently (after an accident, during surgery, for a dengue patient with low platelets, or for regular thalassemia transfusions), the family or hospital usually has to find donors through slow, informal channels:

- phone calls to relatives and friends,
- forwarded WhatsApp and social-media messages, often out of date or with the wrong blood group,
- walking in to blood banks one by one to ask about stock.

These channels have three problems:

1. **They are slow.** Each message reaches people one at a time, and nobody knows who has already replied.
2. **They are untargeted.** A message reaches many people who can't help: the wrong blood group, too far away, or not allowed to donate yet because they donated recently.
3. **They expose personal data.** Donor phone numbers are passed around publicly and keep circulating long after the need is over.

## 2. Problem

> There is no single, trusted place where a hospital, emergency service, blood bank or patient's family can broadcast an urgent blood need and have it reach **only the donors who can actually help**: compatible, nearby, available and medically eligible. They also can't track how the request is progressing, and donor privacy isn't protected.

## 3. Proposed solution: Red Link

Red Link is a role-based, mobile-first web application:

- A requester raises a request (blood group, units, urgency, hospital, needed-by time).
- The system immediately finds **compatible, eligible, nearby** donors using the blood-group compatibility table, the donation eligibility rules and the distance from the hospital. It ranks them and notifies the best 50.
- Donors accept or decline in one tap. The requester sees a live, ranked list. A donor's phone number is shown only after that donor accepts.
- The hospital records each donation. This **verifies** the donor's blood group and starts their 90-day rest period automatically.
- Requests are tracked from **Open** to **Partly fulfilled**, **Fulfilled**, **Cancelled** or **Expired**. Donors still waiting are told when they are no longer needed.
- Urgent cases widen their search: **URGENT** requests can be expanded by hand, and **CRITICAL** requests expand automatically when too few donors accept within 10 minutes.
- Blood banks can offer units from their stock against open requests.

## 4. Objectives

1. Match a blood request to suitable donors **automatically and within seconds**, using compatibility, eligibility, distance and verification status.
2. **Shorten the time** between a request being raised and a donor accepting it, and measure that time (admin analytics: *average time to first acceptance*).
3. **Protect donor privacy:** masked names, approximate distances and grid-snapped map positions; phone numbers only after the donor agrees.
4. Make every request **traceable** to fulfilment, with notifications to everyone involved at each step.
5. Build **trust**: institutions are verified by an admin, donor blood groups are verified when a donation is recorded, and users can report misuse.
6. Work on **phones and laptops**, be installable on a phone's home screen, and run **offline on a local network** for demonstration.

## 5. Scope

### In scope (built)

| Area | Included |
|---|---|
| Roles | Donor, Receiver (patient's family), Hospital, Emergency Service, Blood Bank, Admin |
| Accounts | Sign-up with a map location picker and address search; login; admin verification of institutions; suspension |
| Matching | Compatibility (8 × 8), eligibility (age, weight, 90-day rest, availability), Haversine distance with a bounding-box prefilter, scoring, top 50 |
| Requests | Create, broadcast, accept / decline / withdraw, record donation, cancel, expire, manual and automatic radius expansion |
| Receivers | Masked donor search (list + map), contact requests, raising a request at a verified hospital |
| Blood banks | Inventory per blood group with low-stock warnings, supply offers, walk-in donations, donation camps |
| Admin | Analytics with charts, verification queue, user management, flags (reports), read-only view of all requests |
| Notifications | In-app (polled every 10 s, 5 s when urgent), urgent red banner + sound, optional email for URGENT/CRITICAL |
| Platform | Responsive web app, dark mode, installable (PWA manifest) |

### Out of scope (see [FUTURE_SCOPE.md](FUTURE_SCOPE.md))

Real SMS / WhatsApp / push notifications, native mobile apps, payments, document uploads, real-time chat, multiple languages, and integration with government blood-bank databases.

## 6. Target users

| User | Need | What Red Link gives them |
|---|---|---|
| **Donor** | Help when it matters, without being spammed or exposing their number | Alerts only for requests they can donate to; one-tap accept; history and "lives impacted"; contact requests they can accept or decline |
| **Receiver** (patient's family) | Find blood fast without knowing whom to call | Masked search of compatible donors nearby; contact requests; raise a request at the hospital where the patient is admitted |
| **Hospital** | Fill blood requests for patients quickly | Broadcast to ranked donors; live list with accepted donors' phones; record donations; see blood bank offers |
| **Emergency service** | Get blood for trauma cases in minutes | One-tap **CRITICAL BROADCAST** with automatic search widening |
| **Blood bank** | Keep stock moving to where it's needed | Inventory with low-stock warnings; offer units to nearby requests; walk-in donations; camps |
| **Admin** | Keep the platform trustworthy | Verify institutions, suspend misuse, review reports, monitor performance |
