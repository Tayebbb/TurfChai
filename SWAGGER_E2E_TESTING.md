# E2E Testing Bookings via Swagger UI

> App must be running: `./mvnw spring-boot:run` (default profile, Postgres).  
> Swagger UI: **http://localhost:8080/swagger-ui.html** → redirects to `/swagger-ui/index.html`  
> OpenAPI JSON: **http://localhost:8080/v3/api-docs**

---

## 1. Get a JWT (required for all booking endpoints)

**Endpoint:** `POST /api/v1/auth/login`  
**Body:**
```json
{
  "email": "rafi@turfchai.com",
  "password": "TurfChai@123"
}
```
**Response:** `{ "token": "eyJhbGciOiJIUzI1NiJ9..." }`  
Copy the `token` value.

---

## 2. Authorize in Swagger UI

1. Click **Authorize** (🔒) at top-right of Swagger UI.
2. Paste: `Bearer <your-token>` (include the word `Bearer` + space).
3. Click **Authorize** → **Close**.

All subsequent "Try it out" calls will include the header.

---

## 3. Create a test slot (one-time setup)

Booking endpoints need an **available slot** (`slotId`). The demo seed doesn't create slots.

**Option A: H2 dev profile (easiest for dev)**
```bash
# stop the default-profile app first
SPRING_PROFILES_ACTIVE=dev \
spring.datasource.url='jdbc:h2:file:/tmp/opencode/turfchai_swagger;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;AUTO_SERVER=TRUE' \
./mvnw spring-boot:run
```
Then in another terminal:
```bash
java -cp ~/.m2/repository/com/h2database/h2/2.3.232/h2-2.3.232.jar org.h2.tools.Shell \
  -url 'jdbc:h2:/tmp/opencode/turfchai_swagger;AUTO_SERVER=TRUE' -user sa -sql "
INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status, version, created_at, updated_at)
SELECT v.id, p.id, CURRENT_DATE, '18:00:00', '19:00:00', 1500.00, 'AVAILABLE', 0, now(), now()
FROM venues v JOIN pitches p ON p.venue_id = v.id LIMIT 1;
"
```
Note the returned `id` (likely `1`).

**Option B: Postgres (current profile)**
```bash
export PGPASSWORD=turfchai_dev
psql -U turfchai -h localhost -d turfchai -c "
INSERT INTO slots (venue_id, pitch_id, slot_date, start_time, end_time, price, status, version, created_at, updated_at)
SELECT v.id, p.id, CURRENT_DATE, '18:00:00', '19:00:00', 1500.00, 'AVAILABLE', 0, now(), now()
FROM venues v JOIN pitches p ON p.venue_id = v.id LIMIT 1
RETURNING id;
"
```
Use the returned `id` as `slotId` below.

---

## 4. Happy-path flow

| Step | Endpoint | Method | Body / Params | Expected |
|------|----------|--------|---------------|----------|
| 1. Hold slot | `/api/v1/bookings/hold-slot` | POST | `{ "slotId": 1 }` | **200** – returns `holdId` (e.g., `"holdId": 42`) |
| 2. Create booking | `/api/v1/bookings` | POST | `{ "holdId": 42 }` | **200** – returns `BookingResponse` with `bookingCode` (e.g., `TC-A1B2C3`), `status: "CONFIRMED"` |
| 3. Get booking | `/api/v1/bookings/{id}` | GET | path `id` = booking `id` from step 2 | **200** – same booking |
| 4. List bookings | `/api/v1/bookings` | GET | (no body) | **200** – array including your booking |
| 5. Cancel booking | `/api/v1/bookings/{id}/cancel` | POST | path `id` = booking `id` | **200** – cancelled; slot status back to `AVAILABLE` |

---

## 5. Negative tests (verify error docs)

| Scenario | Endpoint | Input | Expected |
|----------|----------|-------|----------|
| Unauthenticated | any booking endpoint | (remove Authorization) | **401** |
| Bad slotId (not found / unavailable) | `hold-slot` | `{ "slotId": 99999 }` | **409** `SlotUnavailableException` |
| Double-hold same slot | `hold-slot` twice with same `slotId` | `{ "slotId": 1 }` | 1st **200**, 2nd **409** |
| Cancel without access | `cancel` | another user's booking `id` | **403** `AccessDeniedException` |
| Invalid UUID format | `GET /bookings/{id}` | `id=not-a-uuid` | **400** |
| Missing required field | `hold-slot` | `{}` | **400** validation |

---

## 6. Inspect schemas

- In Swagger UI, scroll to **Schemas** → `HoldSlotRequest`, `BookingResponse`.
- Each field shows `description`, `example` (e.g., `slotId: 1`, `bookingCode: "TC-A1B2C3"`).

---

## 7. Quick curl cheat-sheet (if you prefer CLI)

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rafi@turfchai.com","password":"TurfChai@123"}' | jq -r .token)

HOLD=$(curl -s -X POST http://localhost:8080/api/v1/bookings/hold-slot \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"slotId":1}')
HOLD_ID=$(echo $HOLD | jq -r .holdId)

BOOKING=$(curl -s -X POST http://localhost:8080/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"holdId\":$HOLD_ID}")
BOOKING_ID=$(echo $BOOKING | jq -r .id)

curl -s http://localhost:8080/api/v1/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

curl -s -X POST http://localhost:8080/api/v1/bookings/$BOOKING_ID/cancel \
  -H "Authorization: Bearer $TOKEN" | jq .
```