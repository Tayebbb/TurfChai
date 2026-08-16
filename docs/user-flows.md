# TurfChai — User Flows

The workflows the product actually supports, as implemented.

---

## 1. Player booking journey

```mermaid
sequenceDiagram
    participant P as Player
    participant UI as React SPA
    participant API as Spring Boot
    participant DB as Database

    P->>UI: browse /player/explore
    UI->>API: GET /venues?filters
    P->>UI: open a venue
    UI->>API: GET /venues/{slug} + /venues/{id}/slots?date
    Note over UI,API: SSE /slots/stream keeps the grid live
    P->>UI: pick a slot
    UI->>API: POST /bookings/hold-slot
    API->>DB: SELECT … FOR UPDATE, set HELD + 5-min expiry
    P->>UI: choose method, apply promo, apply wallet
    UI->>API: POST /promotions/validate-code (quote only)
    P->>UI: Confirm
    UI->>API: POST /payments/checkout {slotId, method, applyWalletAmount, promoCode}
    API->>DB: one transaction — booking, discount, payment rows,<br/>wallet debit, slot BOOKED, points, notification
    API-->>UI: bookingId, bookingCode, points earned
    UI->>P: /player/booking-success — QR ticket
```

**What is guaranteed**

- The hold is exclusive; a second player is refused with 409.
- The discount is priced from the server's slot price. A client sending its own
  discount amount gets the server's figure.
- The whole checkout is one transaction — a failure writes nothing.
- The cancellation policy is snapshotted onto the booking.

---

## 2. Cancellation and refund journey

```mermaid
flowchart LR
    A["/player/bookings/:id"] --> B["Cancel booking → /player/cancel?bookingId="]
    B --> C["GET /payments/refund-preview/:id<br/>shows % and amount first"]
    C --> D["POST /payments/cancel/:id"]
    D --> E["booking CANCELLED"]
    D --> F["refund rows written per tender"]
    D --> G["slot released if nothing else holds it"]
    D --> H["promo redemption returned"]
    D --> I["points clawed back"]
    D --> J["BOOKING_CANCELLED + REFUND_ISSUED notifications"]
```

Cancellation has exactly one entry point — the confirmation screen — so the
destructive action always shows the refund first. Refunds return gateway money
to the gateway leg and wallet credit to the wallet. A second cancel is refused.

---

## 3. Review journey

```mermaid
flowchart LR
    A["Booking played"] --> B["/player/review?bookingId="]
    B --> C["POST /reviews"]
    C --> D{"eligible?"}
    D -->|"not your booking"| E["403 — you can only review your own booking"]
    D -->|"not started"| F["400 — review once the match has started"]
    D -->|"already reviewed"| G["400 — review already exists"]
    D -->|"yes"| H["review saved"]
    H --> I["venue rating_avg + review_count recomputed"]
    I --> J["public venue page, search results, owner console all agree"]
    H --> K["owner sees it in /owner/reviews, needsResponse = true"]
    K --> L["owner replies → shown publicly under the review"]
```

---

## 4. Promotion journey

```mermaid
flowchart LR
    O["Owner creates code at /owner/promotions"] --> A["active immediately"]
    A --> P["Player types the code at checkout"]
    P --> Q["POST /promotions/validate-code → quote"]
    Q --> R["POST /payments/checkout with the code"]
    R --> S["server re-prices the discount"]
    S --> T["usage taken under a row lock in the same transaction"]
    T --> U["usage limit reached → promotion deactivates"]
    R --> V["cancel later → redemption returned, code reactivates"]
```

Verified live: 12 concurrent redemptions of a limit-3 code grant exactly three.
A code is scoped to its venue, so it will not apply at another venue.

---

## 5. Owner journey

```mermaid
flowchart LR
    L["Sign in"] --> D["/owner — dashboard KPIs"]
    D --> V["/owner/venue-setup"]
    V --> V1["identity, location, photos, hours"]
    V --> V2["amenities + house rules"]
    V --> V3["pitches"]
    V --> V4["pricing rules"]
    V --> V5["generate slots"]
    V --> V6["publish → visible to players"]
    D --> C["/owner/calendar — grid, manual booking, block slot"]
    D --> B["/owner/bookings — approve / cancel / refund"]
    D --> CU["/owner/customers — derived from real bookings"]
    D --> PR["/owner/promotions"]
    D --> PY["/owner/payments — gross, 6% fee, refunds, net"]
    D --> RV["/owner/reviews — reply publicly"]
```

A new owner starts at `/owner/onboarding`, submits the venue for verification,
and sees a pending-approval state until an admin approves the request.

---

## 6. Tournament journey

```mermaid
flowchart LR
    H["Host creates tournament"] --> R["Reserve slots across pitches<br/>conflict-checked, server-priced"]
    R --> D["Pay deposit"]
    D --> P["Publish"]
    P --> REG["Players register a team<br/>entry fee recorded as DUE"]
    REG --> T["Host marks fees paid → player notified"]
    T --> B["Generate knockout bracket"]
    B --> BAL["Host settles the balance"]
```

One entry per player per tournament. Withdrawal is allowed while the fee is
unpaid. Every amount is computed server-side.

---

## 7. Open game journey

```mermaid
flowchart LR
    A["Player posts a game"] --> B["organiser takes spot 1"]
    B --> C["Game appears in /solo/open-games"]
    C --> D["Others join"]
    D --> E{"capacity?"}
    E -->|"spots left"| F["ALMOST_FULL"]
    E -->|"last spot"| G["FULL — later joiners refused"]
    D --> H["Ticket at /solo/ticket"]
```

Reliability bars are enforced with the reason returned; joining twice is refused.

---

## 8. Admin journey

```mermaid
flowchart LR
    A["/admin/login — password"] --> B["one-time code challenge"]
    B --> C["verify → JWT"]
    C --> D["/admin — platform overview"]
    D --> E["/admin/turf-requests — approve venues"]
    D --> F["/admin/turfs — moderate, suspend, archive"]
    D --> G["/admin/users — suspend, reinstate, export"]
    D --> H["/admin/payouts — settle / flag, owner notified"]
    D --> I["/admin/admins — appoint, permissions"]
    D --> J["/admin/activity — audit trail"]
```

Challenges are single-use and throttled to 5 per user per 15 minutes.

---

## 9. Notification journey

```mermaid
flowchart LR
    T["state transition in a service"] --> N["notification written in the same transaction"]
    N --> U["unread count increases"]
    U --> BELL["bell shows a dot"]
    BELL --> DR["drawer / dashboard section"]
    DR --> O["open one → marked read → navigates to its subject"]
    O --> R["refresh: still read (server state, not client state)"]
```

A checkout that fails writes its notification in a **separate** transaction, so
the record survives the rollback of the thing that failed.
