import { useState } from "react";
import { Link } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { getBooking } from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useDisclosure } from "@/hooks/useDisclosure";
import { paths } from "@/routes/paths";

const REASONS = [
  "Not enough players",
  "Weather concerns",
  "Found another venue",
  "Schedule conflict",
  "Other",
];

export default function CancelPage() {
  const cancelled = useDisclosure(false);
  const [reason, setReason] = useState(REASONS[0]);
  const bookingApi = useApi(() => getBooking("TC-48291"), []);
  const booking = bookingApi.data;

  return (
    <>
      <PageTitle title="Cancel booking" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 32, paddingBottom: 64 }}
      >
        <h1 style={{ fontSize: 22 }}>Cancel booking {booking?.bookingCode || "TC-48291"}?</h1>
        <p className="subtle" style={{ marginBottom: 16 }}>
          {booking?.venue || "Venue"} \u00b7 {booking?.date || "Date"}
        </p>

        <div className="card">
          <div className="field">
            <label htmlFor="reason">Why are you cancelling?</label>
            <select
              className="select"
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REASONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <span className="hint">
              Tip: post a{" "}
              <Link to={paths.solo.openGames}>replacement request</Link> instead
              — most vacancies fill within 2 hours.
            </span>
          </div>

          <div className="panel">
            <b className="small">Refund calculation</b>
            <div className="pricerow">
              <span>Amount paid</span>
              <span className="num">৳2,550</span>
            </div>
            <div className="pricerow">
              <span>Cancellation window</span>
              <span>
                <span className="badge green">Free — 24h+ before kickoff</span>
              </span>
            </div>
            <div className="pricerow">
              <span>Cancellation fee</span>
              <span className="num">−৳0</span>
            </div>
            <div className="pricerow total">
              <span>Refund to bKash ••• 678</span>
              <span className="num" style={{ color: "var(--brand-600)" }}>
                ৳2,550
              </span>
            </div>
          </div>

          <p className="subtle tiny" style={{ margin: "8px 0 0" }}>
            Refund is processed immediately and typically lands in 3–5 business
            days. Teammates who repaid you are refunded their shares
            automatically. If you cancel after Thu 7:30 PM, only 50% is
            refundable.
          </p>
        </div>

        <div className="alert warn" style={{ marginTop: 14 }}>
          <span className="ico">⚠️</span>
          <div>
            <b>This releases your slot</b>The Friday 7:30 PM slot returns to
            live availability and your 9 invited teammates are notified.
          </div>
        </div>

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button variant="danger" size="lg" block onClick={cancelled.open}>
            Cancel booking &amp; refund ৳2,550
          </Button>
          <Button
            variant="secondary"
            block
            to={paths.player.bookingDetail(booking?.bookingCode || "TC-48291")}
          >
            Keep my booking
          </Button>
        </div>
      </main>

      <Overlay
        isOpen={cancelled.isOpen}
        onClose={cancelled.close}
        hideHeader
        title="Booking cancelled"
      >
        <div className="center">
          <div
            className="check-anim"
            style={{ background: "var(--info)" }}
            aria-hidden="true"
          >
            ↩
          </div>
          <h3>Booking cancelled</h3>
          <p className="muted small">
            Refund of <b className="num">৳2,550</b> is on its way to bKash •••
            678.
          </p>
          <span className="badge blue" style={{ margin: "6px 0 14px" }}>
            Refund pending · 3–5 days
          </span>
          <div className="stack-sm">
            <Button variant="primary" block to={paths.player.explore}>
              Find another slot
            </Button>
            <Button variant="tertiary" block to={paths.player.bookings}>
              Back to my bookings
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
