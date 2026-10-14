# Sequence Diagrams

The three key flows from spec Section 16. Participant names match the code: `api` routes in `server/src/routes`, services in `server/src/services`, and domain rules in `shared/src/domain`.

## 1. Emergency broadcast (CRITICAL), with automatic escalation

```mermaid
sequenceDiagram
  autonumber
  actor EMS as Emergency service
  participant UI as React app
  participant API as Express /api
  participant SVC as requests / matching services
  participant DOM as shared domain rules
  participant DB as MongoDB
  actor D as Donors
  actor H as Receiving hospital

  EMS->>UI: Tap "CRITICAL BROADCAST", fill in group, units, hospital
  UI->>API: POST /api/requests {urgency: CRITICAL, ...}
  API->>API: Check session + role (EMERGENCY may use CRITICAL), validate (zod)
  API->>SVC: createRequest()
  activate SVC
  Note over SVC,DB: One transaction
  SVC->>DB: Insert BloodRequest (radius 50 km)
  SVC->>DB: Find ACTIVE, available donors of compatible groups inside the bounding box
  DB-->>SVC: Candidate donors
  SVC->>DOM: findMatches(): eligibility, Haversine ≤ 50 km, score, top 50
  DOM-->>SVC: Ranked matches
  SVC->>DB: Insert RequestMatch rows (NOTIFIED) + CRITICAL notifications
  SVC-->>API: {id, matchedCount}
  deactivate SVC
  Note over SVC: After commit: email CRITICAL alert (if SMTP is configured)
  API-->>UI: 201 → open the request page

  loop Every 5–10 s
    D->>API: GET /api/notifications
    API-->>D: Unread CRITICAL alert → red banner + sound
  end

  D->>API: POST /api/matches/:id/respond {ACCEPT}
  API->>SVC: respondToMatch(): eligible? compatible? status unchanged?
  SVC->>DB: Match → ACCEPTED (conditional update), notify requester
  EMS->>API: GET /api/requests/:id (page refreshes every 10 s)
  API-->>EMS: Ranked list, accepted donor shown with name + phone

  Note over API,DB: 10 minutes after creation, fewer than 3 donors accepted
  D->>API: GET /api/notifications (any user's poll)
  API->>SVC: runLazyMaintenance() → autoEscalate()
  SVC->>DB: Set radius 100 km only if lastEscalatedAt is still null (runs once)
  SVC->>DOM: findMatches() at 100 km, skipping donors already matched
  SVC->>DB: New matches + alerts, CRITICAL notice to the requester
  
  EMS->>API: POST /api/requests/:id/donations {donorId, units}
  API->>SVC: recordDonation()
  SVC->>DB: DonationRecord, match DONATED, donor lastDonationAt = now, verified = true, unitsFulfilled += units
  alt Request now fulfilled
    SVC->>DB: Other NOTIFIED / ACCEPTED matches → NO_LONGER_NEEDED, pending offers declined
    SVC-->>D: "No longer needed, thank you!"
  end
  SVC-->>D: "Thank you for donating!"
```

## 2. Contact request (receiver ↔ donor)

```mermaid
sequenceDiagram
  autonumber
  actor R as Receiver
  participant API as Express /api
  participant SVC as search / contacts services
  participant DB as MongoDB
  actor D as Donor

  R->>API: GET /api/donors/search?bloodGroup=B+&lat&lng&radiusKm=10&verifiedOnly
  API->>SVC: searchDonors()
  SVC->>DB: Compatible, available, active donors in the bounding box
  SVC->>SVC: Eligible now? within 10 km? score and rank (max 50)
  SVC-->>API: Masked: "Rahul S.", group, "~3.5 km", Verified, map pin snapped to ~1 km grid
  Note right of SVC: No phone number and no exact location ever leave the server here
  API-->>R: Results (list + map)

  R->>API: POST /api/contact-requests {donorId, message}
  API->>SVC: createContactRequest(): donor active? no pending / accepted request already?
  SVC->>DB: ContactRequest (PENDING) + notification to donor
  API-->>R: 201

  D->>API: GET /api/contact-requests
  API-->>D: Receiver's full name + message (no phone yet)
  alt Donor shares number
    D->>API: POST /api/contact-requests/:id/respond {ACCEPT}
    SVC->>DB: PENDING → ACCEPTED (only if still PENDING)
    SVC-->>R: Notification "A donor shared their number"
    R->>API: GET /api/contact-requests
    API-->>R: Donor's full name + phone
    D->>API: GET /api/contact-requests
    API-->>D: Receiver's phone
  else Donor declines
    D->>API: POST /api/contact-requests/:id/respond {DECLINE}
    SVC->>DB: PENDING → DECLINED
    SVC-->>R: Polite notification, donor stays masked
  end
```

## 3. Institution verification

```mermaid
sequenceDiagram
  autonumber
  actor I as New hospital
  participant UI as React app
  participant API as Express /api
  participant DB as MongoDB
  actor A as Admin

  I->>UI: Sign up as Hospital (organisation, licence number, location)
  UI->>API: POST /api/auth/signup
  API->>DB: User {role: HOSPITAL, status: PENDING_VERIFICATION, institution}
  API-->>UI: Session cookie
  UI-->>I: "Awaiting verification" screen (other pages blocked)
  I->>API: GET /api/requests
  API-->>I: 403 Your account is not active

  A->>API: GET /api/admin/verifications
  API-->>A: Pending queue (licence, contact, address)
  alt Approve
    A->>API: POST /api/admin/verifications/:userId {APPROVE}
    API->>DB: status ACTIVE, verifiedAt, verifiedById (only if still pending)
    API->>DB: Notification "Organisation verified"
    I->>API: Next request (same session)
    API->>DB: attachUser reloads the user → now ACTIVE
    API-->>I: Dashboard works immediately, requests show "Verified institution"
  else Reject (note required)
    A->>API: POST /api/admin/verifications/:userId {REJECT, note}
    API->>DB: status REJECTED, rejectionNote
    API->>DB: Notification "Verification not approved"
    UI-->>I: Rejection screen showing the admin's note
  end
```
