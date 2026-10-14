# Data Flow Diagrams

Notation: rectangles are **external entities**, rounded boxes are **processes**, and cylinders are **data stores** (MongoDB collections). Arrow labels name the data that flows.

## Level 0: Context diagram

The whole system is one process. It exchanges data with six user roles and three optional external services.

```mermaid
flowchart LR
  DONOR["Donor"]
  RECEIVER["Receiver<br/>(patient's family)"]
  HOSP["Hospital"]
  EMS["Emergency service"]
  BANK["Blood bank"]
  ADMIN["Admin"]
  MAPS["OpenStreetMap<br/>(tiles, address search)"]
  MAIL["Email server<br/>(SMTP)"]

  SYS(("0<br/>Red Link<br/>system"))

  DONOR -- "profile, availability,<br/>accept / decline, contact replies, reports" --> SYS
  SYS -- "matched requests, alerts,<br/>eligibility, history, camps" --> DONOR

  RECEIVER -- "search criteria, contact requests,<br/>blood requests, reports" --> SYS
  SYS -- "masked donor results,<br/>shared phone numbers, request status" --> RECEIVER

  HOSP -- "blood requests, recorded donations,<br/>cancel / expand, offer decisions" --> SYS
  SYS -- "ranked donor list, accepted donors' phones,<br/>supply offers, alerts" --> HOSP

  EMS -- "CRITICAL broadcasts, recorded donations" --> SYS
  SYS -- "ranked donors, escalation alerts" --> EMS

  BANK -- "stock changes, supply offers,<br/>walk-in donations, camps" --> SYS
  SYS -- "nearby open requests, offer outcomes,<br/>low-stock warnings" --> BANK

  ADMIN -- "verification decisions, suspensions,<br/>flag reviews" --> SYS
  SYS -- "analytics, verification queue,<br/>users, flags, all requests" --> ADMIN

  SYS -- "address query" --> MAPS
  MAPS -- "coordinates, map tiles" --> SYS
  SYS -- "URGENT / CRITICAL alert emails" --> MAIL
```

## Level 1: Main processes

```mermaid
flowchart TB
  DONOR["Donor"]
  RECEIVER["Receiver"]
  REQ["Hospital / Emergency"]
  BANK["Blood bank"]
  ADMIN["Admin"]

  P1(["1.0<br/>Manage accounts<br/>& authentication"])
  P2(["2.0<br/>Raise & broadcast<br/>requests (matching)"])
  P3(["3.0<br/>Respond to requests<br/>& record donations"])
  P4(["4.0<br/>Search donors &<br/>contact requests"])
  P5(["5.0<br/>Manage inventory,<br/>supply & camps"])
  P6(["6.0<br/>Request lifecycle<br/>(expire, escalate, cancel)"])
  P7(["7.0<br/>Notify users"])
  P8(["8.0<br/>Administer &<br/>moderate"])

  D1[("D1 Users<br/>(+ donor profile,<br/>institution)")]
  D2[("D2 Blood requests")]
  D3[("D3 Request matches")]
  D4[("D4 Donation records")]
  D5[("D5 Contact requests")]
  D6[("D6 Notifications")]
  D7[("D7 Inventory &<br/>supply offers")]
  D8[("D8 Camps")]
  D9[("D9 Flags")]

  DONOR & RECEIVER & REQ & BANK -- "sign-up / login details" --> P1
  P1 -- "new account, status" --> D1
  D1 -- "credentials, role, status" --> P1
  P1 -- "session cookie" --> DONOR & RECEIVER & REQ & BANK

  REQ & RECEIVER -- "request details" --> P2
  D1 -- "eligible donors in bounding box" --> P2
  P2 -- "request" --> D2
  P2 -- "top-50 ranked matches" --> D3
  P2 -- "match alerts" --> P7

  DONOR -- "accept / decline / withdraw" --> P3
  REQ -- "record donation (units)" --> P3
  D3 -- "match status" --> P3
  P3 -- "updated match" --> D3
  P3 -- "donation" --> D4
  P3 -- "lastDonationAt, verified" --> D1
  P3 -- "units fulfilled, status" --> D2
  P3 -- "accept / thank-you / fulfilled updates" --> P7
  D3 -- "ranked list, accepted phones" --> REQ

  RECEIVER -- "group, location, radius" --> P4
  D1 -- "eligible donors" --> P4
  P4 -- "masked results" --> RECEIVER
  RECEIVER -- "contact message" --> P4
  DONOR -- "share / decline" --> P4
  P4 -- "contact request" --> D5
  P4 -- "contact alerts" --> P7

  BANK -- "stock changes, offers, walk-ins, camps" --> P5
  D2 -- "nearby open requests" --> P5
  P5 -- "stock, offers" --> D7
  P5 -- "camps" --> D8
  P5 -- "walk-in donation" --> D4
  REQ & RECEIVER -- "accept / decline offer" --> P5
  P5 -- "units supplied" --> D2
  P5 -- "offer alerts" --> P7
  D8 -- "nearby camps" --> DONOR

  D2 -- "overdue / CRITICAL requests" --> P6
  REQ & RECEIVER -- "cancel, expand radius" --> P6
  P6 -- "status, radius" --> D2
  P6 -- "new matches, no-longer-needed" --> D3
  P6 -- "cancel / expiry / escalation alerts" --> P7

  P7 -- "notifications" --> D6
  D6 -- "bell, urgent banner (polled)" --> DONOR & RECEIVER & REQ & BANK & ADMIN

  DONOR & RECEIVER & REQ & BANK -- "reports" --> P8
  P8 -- "flags" --> D9
  ADMIN -- "approve / reject, suspend / reactivate, review flags" --> P8
  P8 -- "status changes, clean-up" --> D1
  D1 & D2 & D3 & D9 -- "analytics, queues, lists" --> P8
  P8 -- "analytics, queues" --> ADMIN
  P8 -- "verification / outcome alerts" --> P7
```

## Process descriptions

| No. | Process | Input | Output | Data stores |
|---|---|---|---|---|
| 1.0 | Manage accounts & authentication | Sign-up form (with map location), login | Session cookie (JWT), account status | D1 |
| 2.0 | Raise & broadcast requests | Blood group, units, urgency, needed-by, hospital, location | Ranked matches (≤ 50), donor alerts | D1, D2, D3 |
| 3.0 | Respond & record donations | Accept / decline / withdraw; record donation (1–2 units) | Updated match, donation record, verified badge, cooldown, fulfilled units | D1–D4 |
| 4.0 | Search & contact | Patient's group, location, radius, verified-only; contact message | Masked results (name initial, ~distance, ~1 km map pin); phones after acceptance | D1, D5 |
| 5.0 | Inventory, supply & camps | Stock changes, offers, walk-ins, camps | Stock levels, offers, units supplied, camp listings | D2, D4, D7, D8 |
| 6.0 | Request lifecycle | Time passing (checked lazily), cancel, expand | Expired / cancelled requests, widened radius, new matches | D2, D3 |
| 7.0 | Notify users | Events from processes 2.0–8.0 | In-app notifications; email for URGENT / CRITICAL | D6 |
| 8.0 | Administer & moderate | Verification decisions, suspensions, flag reviews, reports | Status changes and clean-up, analytics | D1, D2, D3, D9 |
