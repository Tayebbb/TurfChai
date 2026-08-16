# Dead & Fake Control Remediation

**Scope of the mandate:** every control whose implementation was effectively `showToast(...)` — a
button that told the user something happened when nothing did.

**Rule applied to every control:**

> It performs the real operation against the real backend, **or** it is `disabled` with a `title`
> that says why. Nothing in between. No button claims a success that did not happen.

**Result:** 389 backend tests (was 377), 52 frontend tests (was 35), ESLint 0, production build
clean, route-path check clean, and every wired control verified in a real browser against the
running server — request → server response → persisted state → UI state.

---

## 1. Controls now backed by real work

### Player

| Control | Was | Now |
| --- | --- | --- |
| Booking detail → Directions | toast | Opens Google Maps at the venue's coordinates (falls back to name + address). Disabled with a reason when the venue has neither. |
| Booking detail → Contact venue | toast | `tel:` the venue's real phone. Disabled when no number is on file. |
| Booking success → Add to calendar | toast | Downloads a real `.ics` built from the booking's date and times. |
| Booking success → Directions / Call | toast | Same real device actions as above. |
| Venue page → Share | toast | Native share sheet where available, clipboard otherwise; the toast reports **which one actually happened**. |
| Venue page → Reviews | A hardcoded review from an invented player ("Tanvir Ahmed") | Real paged reviews from a **new** public endpoint, with loading / error / empty / populated states and a "Show more" that fetches more. Owner replies render underneath. |

### Owner

| Control | Was | Now |
| --- | --- | --- |
| Bookings → Approve / Cancel / Refund | toast per row | Real `POST /owner/bookings/{id}/{action}`, single-flight guard, list reloaded from the server afterwards. |
| Bookings → pagination | toast | Real client-side pagination over the filtered set. |
| Bookings → Manual booking | toast | Links to the calendar, where manual booking actually lives. |
| Calendar → Check in | toast | Real `POST /matchday/checkin`. The button then reads "Checked in" and is disabled — read back from the server, not from local state. |
| Calendar → Call | toast | `tel:` the booking's real customer. |
| Calendar → Cancel booking | toast | Real cancellation; the slot is released and the grid refreshes. |
| Payments → Export CSV | opened a URL that does not exist | Real CSV of the loaded ledger; the toast reports the row count. |
| Payments → Monthly report | toast | Real CSV of the KPIs, method split and sport breakdown. |
| Reviews → Publish response | toast | Real `POST /owner/reviews/{id}/response`, per-review draft state, busy state, and the reply is then shown publicly on the venue page. |
| Topbar → Notifications | toast claiming "3 new notifications" | Real unread count and a drawer of real notifications with "Mark all read". |

### Admin

| Control | Was | Now |
| --- | --- | --- |
| Activity → Export CSV | toast | Real CSV of the audit rows on screen. |
| Users → Export Roster | toast | Real CSV of the filtered roster. |
| Dashboard → Export Report | toast claiming a PDF | Real CSV of the loaded platform figures (no PDF generator exists, so it no longer claims one). |
| Turf details → Approve & Make Live | toast | Real venue-status change to LIVE, with a busy state and an error path. |

### Host

| Control | Was | Now |
| --- | --- | --- |
| Tournament → Pay balance | toast | Real `POST /{code}/balance` at the **server-computed** amount; refuses before the deposit and refuses twice. |
| Tournament → Save notes | toast | Real `PATCH /{code}/settings`; notes persist and reload. |
| Tournament → Privacy toggle | local state + toast | Real `PATCH /{code}/settings`. |
| Tournament → Regenerate link | toast | Real `POST /{code}/invite-code`; the old link stops working. |
| Tournament → Edit schedule | toast about a drag-and-drop editor that does not exist | "Generate/Regenerate fixtures", wired to the real bracket generator. |
| Tournament → Venue contact | Hardcoded name, venue and phone number | The real venue owner from the API; Call dials their real number. |
| Multi-pitch → grid before data loads | A fabricated interactive grid with fake toasts | A loading/empty state. |

---

## 2. Controls made honestly unavailable

These have no backend and inventing one would have been guessing at product decisions. Each is
`disabled` with a `title` explaining why, so nothing pretends.

- Owner: close shift, download digital invoice, reschedule a booking, add customer, customer notes.
- Admin: change password, revoke sessions, view flag reason, self-service password reset.
- Host: in-app chat, cancel a tournament reservation, emailed/SMS receipts.
- Player: find replacement player; account recovery on the sign-in screen is now a plain sentence
  pointing at support instead of a link that claimed to send a reset email.

---

## 3. Backend added to support real behaviour

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/venues/{slug}/reviews` | Public, paged venue reviews. Returns `PublicReviewResponse` — display name and initials only, never author identifiers, because the endpoint is public. 404 for an unknown venue. |
| `POST /api/v1/owner/reviews/{id}/response` | The owner's public reply. A review belonging to another owner's venue is reported as **not found**, so review ids cannot be probed. |
| `POST /api/v1/host/tournaments/{code}/balance` | Settles the remainder after the deposit, priced server-side. |
| `PATCH /api/v1/host/tournaments/{code}/settings` | Listing privacy and private event-day notes. |
| `POST /api/v1/host/tournaments/{code}/invite-code` | Rotates the invite code. |
| `POST /api/v1/owner/bookings/{id}/refund` | Cancel-and-refund per the venue's policy. |

Migrations: `V28__review_owner_response.sql`, `V29__tournament_balance_and_notes.sql`.

The owner calendar payload now carries the real booking behind each occupied cell
(`bookingId`, `bookingCode`, `customerName`, `customerPhone`, `checkedIn`), which is what makes the
drawer's actions possible at all.

---

## 4. Removed rather than kept

- **`POST /api/v1/owner/payments/close-shift`** was a documented mock: it returned `200 OK` and did
  nothing, and the UI reported "Shift closed successfully. Ledger balanced ✓" — including from its
  `catch` block, so it claimed success even on failure. The endpoint and its client are deleted and
  the button is honestly disabled.
- **`getInvoiceUrl()` / `getCsvExportUrl()`** pointed at routes that were never implemented, and
  were called through `window.open`, which cannot send the bearer token even if they had been.

---

## 5. Defects found while verifying, and fixed

1. **Empty success bodies were treated as failures.** `apiGet`/`apiSend`/`apiUpload` called
   `response.json()` on every 2xx, but several endpoints answer `200` with an empty body. Cancelling
   a booking succeeded on the server and then showed the user
   `Failed to execute 'json' on 'Response'`. A `readBody()` helper now handles empty, non-JSON and
   `204` responses. Regression tests in `src/api/client.test.js`.
2. **Raw browser exceptions reached the screen.** `toUserMessage` only sanitised errors that carried
   an HTTP status; a `TypeError` fell through verbatim. Errors with no status now always use the
   caller's fallback wording.
3. **"Approve & Make Live" was unreachable.** It was gated on a status of `PENDING`, but the platform
   stores an unapproved venue as `DRAFT` — so no venue could ever be approved from that screen.
4. **`PATCH /admin/venues/{id}/status` accepted any string**, letting a client write a status outside
   the lifecycle. It now validates against `DRAFT | LIVE | SUSPENDED | ARCHIVED`.
5. **A toast printed `undefined`.** The owner customer note button rendered `showToast(row.note)`,
   and the API never sends `note`.

---

## 6. Verification

**Automated**

- Backend: `mvnw -o test` → **389 passed**. New coverage for the owner review response (stores,
  refuses another owner's review, rejects a blank reply), tournament balance/settings/invite, the
  public reviews contract, and proof the close-shift mock is gone.
- Frontend: `npm test` → **52 passed**, including the device actions (CSV quoting, `.ics` escaping,
  coordinate preference, share-vs-copy reporting), the owner reviews page (cannot submit empty,
  posts the typed text, reports failure instead of success), and the API body handling.
- `npx eslint .` → 0. `npm run build` → clean. `npm run check:paths` → clean.

**Live, in a browser against the running server**

| What was exercised | Evidence |
| --- | --- |
| Owner check-in | Toast "Checked in ✓"; reopening the slot shows "Checked in", disabled — read back from the server. |
| Owner cancel | Slot returned to Available in the grid on reload. |
| Owner refund | Row flipped to Cancelled, and `GET /owner/bookings` independently reports Cancelled. |
| Admin approve venue | Draft venue → server status `LIVE`; the approve button disappears and the live-venue actions replace it. |
| Admin status validation | `{"status":"BANANA"}` → 400. |
| Admin CSV exports | Captured blob contents: 6 real audit rows, 847 real users, correct headers. |
| Owner payments CSV | "Exported 1 transaction ✓" matching the one real ledger row. |
| Host notes | Toast "Notes saved ✓"; `GET /host/tournaments/{code}` returns the saved text. |
| Host invite rotation | `t/ramadan-cup-0091` → `t/ramadan-cup-2027-7636`. |
| Host balance | Server records `PAID`, amount 24,192 computed server-side, method, reference, timestamp; button becomes "Balance paid ✓", disabled. |
| Venue reviews | The invented review is gone; the page shows the endpoint's real (currently empty) result. |
| Owner notifications | Bell reports the real unread count; drawer lists real notifications. |

**Standing guard**

`qa\scan-fake-handlers.ps1` lists any click handler whose whole body is a toast, and any toast
inside a `catch` that reads like a success. It currently reports only two intentional cases: a
button that displays a real rejection reason, and one that displays a real reservation's price.
