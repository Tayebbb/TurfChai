import { useLocation, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { QrCode } from "@/components/common/QrCode";
import { Button } from "@/components/buttons/Button";
import { getBooking } from "@/api/bookings";
import { getPaymentsForBooking } from "@/api/payments";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString("en-IN")}`;

/** '18:00:00' -> '6:00 PM' */
function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function BookingSuccessPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  // Points earned this booking is an event, not a booking-level fact — the
  // checkout call already returned it, so it rides along via navigation
  // state instead of a dedicated endpoint. Falls back gracefully (no badge)
  // if this page is reached directly (e.g. a reload or a bookmarked link).
  const location = useLocation();
  const pointsEarned = location.state?.pointsEarned;

  const {
    data: booking,
    loading,
    error,
  } = useApi(
    () =>
      bookingId
        ? getBooking(bookingId)
        : Promise.reject(new Error("No booking reference")),
    [bookingId],
  );

  const paymentsApi = useApi(
    () => (bookingId ? getPaymentsForBooking(bookingId) : Promise.resolve([])),
    [bookingId],
  );
  const successfulPayment = (paymentsApi.data ?? []).find((p) => p.status === "SUCCESS");

  if (!bookingId) {
    return (
      <>
        <PageTitle title="Booking confirmed" />
        <main
          className="wrap-form"
          id="main"
          style={{ paddingTop: 40, paddingBottom: 64 }}
        >
          <div className="center" style={{ marginBottom: 20 }}>
            <span className="badge green">Booking confirmed</span>
            <h1 style={{ fontSize: 24, marginTop: 10 }}>Booking created 🎉</h1>
            <p className="subtle">
              Your booking reference will appear here shortly.
            </p>
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            <Button variant="primary" to={paths.player.bookings}>
              My bookings
            </Button>
          </div>
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageTitle title="Booking confirmed" />
        <main
          className="wrap-form"
          id="main"
          style={{ paddingTop: 40, paddingBottom: 64 }}
        >
          <p className="subtle" role="status">
            Loading your booking…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Booking confirmed" />
        <main
          className="wrap-form"
          id="main"
          style={{ paddingTop: 40, paddingBottom: 64 }}
        >
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>
              Could not load your booking
            </h1>
            <p className="subtle">{error.message}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" to={paths.player.bookings}>
                My bookings
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const status = booking?.status === "CANCELLED" ? "Cancelled" : "Confirmed";
  const code = booking?.bookingCode || "—";
  const ticketUrl = `${window.location.origin}${paths.player.bookingDetail(bookingId)}`;
  const playTime =
    booking?.startTime && booking?.endTime
      ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
      : "—";
  const paymentSummary = successfulPayment
    ? `Payment of ${bdt(successfulPayment.amount)} received via ${successfulPayment.method}.`
    : "Payment received.";

  return (
    <>
      <PageTitle title="Booking confirmed" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 40, paddingBottom: 64 }}
      >
        <div className="center" style={{ marginBottom: 20 }}>
          <div className="check-anim" aria-hidden="true">
            ✓
          </div>
          <span className="badge green">Booking {status}</span>
          <h1 style={{ fontSize: 24, marginTop: 10 }}>
            You&apos;re all set! 🎉
          </h1>
          <p className="subtle">{paymentSummary} The venue can see your booking &amp; payment.</p>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                Booking {code}
              </b>
            </div>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div className="grid3" style={{ gap: 12 }}>
              <div>
                <span className="tiny subtle">DATE</span>
                <br />
                <b>{formatDate(booking?.bookingDate) || "—"}</b>
              </div>
              <div>
                <span className="tiny subtle">PLAY TIME</span>
                <br />
                <b className="num">{playTime}</b>
              </div>
              <div>
                <span className="tiny subtle">ARRIVE BY</span>
                <br />
                <b className="num">10 min early</b>
              </div>
            </div>
          </div>
          <div className="perf" />
          <div style={{ padding: "16px 20px" }} className="between">
            <div>
              <span className="tiny subtle">BOOKING REF</span>
              <br />
              <b
                className="num"
                style={{ fontSize: 17, letterSpacing: ".06em" }}
              >
                {code}
              </b>
              <div className="row-wrap" style={{ marginTop: 6 }}>
                <span className="badge green">Paid in full</span>
              </div>
            </div>
            <QrCode
              value={ticketUrl}
              style={{ width: 88, height: 88 }}
              label={`Booking QR code for ${code}`}
            />
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 16, gap: 10 }}>
          <Button variant="primary" to={paths.player.splitPayment}>
            👥 Split with team
          </Button>
          <Button variant="secondary" to={paths.player.splitPayment}>
            Invite teammates
          </Button>
          <Button
            variant="secondary"
            onClick={() => showToast("Added to your calendar 📅")}
          >
            Add to calendar
          </Button>
          <Button
            variant="secondary"
            onClick={() => showToast("Opening directions 🗺️")}
          >
            Directions
          </Button>
        </div>
        <div
          className="row"
          style={{ marginTop: 10, justifyContent: "center" }}
        >
          <Button
            variant="tertiary"
            to={
              booking?.id
                ? paths.player.bookingDetail(booking.id)
                : paths.player.bookings
            }
          >
            View booking
          </Button>
          <Button
            variant="tertiary"
            onClick={() => showToast("Contact the venue from My Bookings 📞")}
          >
            Contact venue
          </Button>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>Arrival &amp; handover</h4>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Show your QR or reference <b>{code}</b> at the gate. Arrive 10 minutes
            early for handover.
          </p>
        </div>

        {pointsEarned ? (
          <div className="alert ok" style={{ marginTop: 12 }}>
            <span className="ico">🏅</span>
            <div>
              <b>You earned {pointsEarned} points for this booking</b> — check your
              balance on the Rewards page.
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
