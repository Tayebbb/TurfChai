import { useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { QrCode } from "@/components/common/QrCode";
import { Button } from "@/components/buttons/Button";
import {
  bookingStart,
  formatBookingDate,
  formatTimeRange,
  getBooking,
} from "@/api/bookings";
import { getVenue } from "@/api/venues";
import { useApi } from "@/hooks/useApi";
import { paths } from "@/routes/paths";
import { formatBdt } from "@/utils/format";

const STATUS_BADGE = {
  CONFIRMED: { label: "Confirmed", className: "badge green" },
  PENDING: { label: "Pending", className: "badge amber" },
  COMPLETED: { label: "Completed", className: "badge green" },
  CANCELLED: { label: "Cancelled", className: "badge gray" },
};

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  const { data: booking, loading, error, reload } = useApi(
    () => (bookingId ? getBooking(bookingId) : Promise.reject(new Error("No booking reference"))),
    [bookingId],
  );

  // Only used for the map link — the booking itself has no coordinates.
  const venueSlug = booking?.venueSlug ?? null;
  const { data: venue } = useApi(
    () => (venueSlug ? getVenue(venueSlug) : Promise.resolve(null)),
    [venueSlug],
  );

  if (!bookingId) {
    return (
      <>
        <PageTitle title="Booking confirmed" />
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <div className="center" style={{ marginBottom: 20 }}>
            <span className="badge green">Booking confirmed</span>
            <h1 style={{ fontSize: 24, marginTop: 10 }}>Booking created 🎉</h1>
            <p className="subtle">Your booking reference will appear here shortly.</p>
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
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <p className="subtle" role="status">
            Loading your booking…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <>
        <PageTitle title="Booking confirmed" />
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>
              {unauthorized ? "Sign in to view this booking" : "Could not load your booking"}
            </h1>
            <p className="subtle">{error.message}</p>
            <div className="row" style={{ marginTop: 12 }}>
              {unauthorized ? (
                <Button variant="primary" to={paths.auth}>
                  Sign in
                </Button>
              ) : (
                <Button variant="primary" onClick={reload}>
                  Try again
                </Button>
              )}
              <Button variant="secondary" to={paths.player.bookings}>
                My bookings
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const badge = STATUS_BADGE[String(booking?.status ?? "").toUpperCase()] ?? STATUS_BADGE.CONFIRMED;
  const code = booking?.bookingCode || (booking?.id ? `#${booking.id}` : "—");
  const ticketUrl = `${window.location.origin}${paths.player.bookingDetail(bookingId)}`;
  const start = bookingStart(booking);
  const weekday = start ? start.toLocaleDateString("en-GB", { weekday: "long" }) : null;
  const timeRange = formatTimeRange(booking?.startTime, booking?.endTime);
  const title =
    [booking?.venueName, booking?.pitchName].filter(Boolean).join(" · ") || "Your booking";
  const amount = booking?.amount != null ? formatBdt(booking.amount) : null;
  const directionsUrl =
    venue?.lat != null && venue?.lng != null
      ? `https://www.openstreetmap.org/directions?to=${venue.lat}%2C${venue.lng}`
      : null;

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
          <span className={badge.className}>Booking {badge.label.toLowerCase()}</span>
          <h1 style={{ fontSize: 24, marginTop: 10 }}>
            {weekday ? `You're playing ${weekday}! 🎉` : "Your slot is booked 🎉"}
          </h1>
          <p className="subtle">
            {booking?.venueName ?? "The venue"} can see your booking.
            {amount ? ` The slot is ${amount} — nothing was charged online, settle it with the venue.` : ""}
          </p>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{title}</b>
            </div>
            {booking?.venueArea ? (
              <div className="muted small" style={{ marginTop: 2 }}>
                {booking.venueArea}
              </div>
            ) : null}
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div className="grid3" style={{ gap: 12 }}>
              <div>
                <span className="tiny subtle">DATE</span>
                <br />
                <b>{formatBookingDate(booking)}</b>
              </div>
              <div>
                <span className="tiny subtle">PLAY TIME</span>
                <br />
                <b className="num">{timeRange}</b>
              </div>
              <div>
                <span className="tiny subtle">AMOUNT</span>
                <br />
                <b className="num">{amount ?? "—"}</b>
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
                <span className={badge.className}>{badge.label}</span>
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
          <Button
            variant="primary"
            to={booking?.id ? paths.player.bookingDetail(booking.id) : paths.player.bookings}
          >
            View booking
          </Button>
          {directionsUrl ? (
            <Button variant="secondary" href={directionsUrl} target="_blank" rel="noopener noreferrer">
              Directions
            </Button>
          ) : (
            <Button variant="secondary" to={paths.player.bookings}>
              My bookings
            </Button>
          )}
        </div>
        <div
          className="row"
          style={{ marginTop: 10, justifyContent: "center" }}
        >
          <Button
            variant="tertiary"
            to={booking?.id ? `${paths.player.review}?bookingId=${booking.id}` : paths.player.review}
          >
            Leave a review after you play
          </Button>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>At the gate</h4>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Show your QR or the reference <b>{code}</b>
            {timeRange !== "—" ? (
              <>
                {" "}
                — your pitch is yours from <b>{timeRange}</b>
              </>
            ) : null}
            . Splitting the bill with your team is not available yet, so the booking stays in your
            name.
          </p>
        </div>
      </main>
    </>
  );
}
