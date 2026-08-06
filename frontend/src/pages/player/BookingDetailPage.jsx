import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import {
  cancelBooking,
  formatBookingDate,
  formatTimeRange,
  formatTimestamp,
  getBooking,
} from "@/api/bookings";
import { getUser } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import { formatBdt } from "@/utils/format";
import "./BookingDetailPage.css";

/** Statuses that still hold a live slot. */
const CANCELLABLE = ["CONFIRMED", "PENDING"];

const STATUS_BADGE = {
  CONFIRMED: { label: "Confirmed", className: "badge green" },
  PENDING: { label: "Pending", className: "badge amber" },
  COMPLETED: { label: "Completed", className: "badge green" },
  CANCELLED: { label: "Cancelled", className: "badge gray" },
};

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const { showToast } = useToast();
  const [cancelling, setCancelling] = useState(false);

  const { data: booking, loading, error, reload } = useApi(
    () => getBooking(bookingId),
    [bookingId],
  );

  const currentUser = getUser();
  const isOwner =
    booking &&
    currentUser &&
    Number(booking.userId) === Number(currentUser.id);

  const badge = STATUS_BADGE[booking?.status] ?? STATUS_BADGE.CONFIRMED;

  const onCancel = async () => {
    setCancelling(true);
    try {
      await cancelBooking(bookingId);
      showToast("Booking cancelled — your slot has been released");
      reload();
    } catch (cancelError) {
      showToast(cancelError.message || "Could not cancel this booking");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageTitle title="Booking" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <p className="subtle" role="status">
            Loading booking…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <>
        <PageTitle title="Booking" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>
              {unauthorized
                ? "Sign in to view this booking"
                : "Could not load this booking"}
            </h1>
            <p className="subtle">{error.message}</p>
            <div className="row" style={{ marginTop: 12 }}>
              {unauthorized ? (
                <Button variant="primary" to={paths.auth}>
                  Sign in
                </Button>
              ) : (
                <Button variant="secondary" onClick={reload}>
                  Try again
                </Button>
              )}
              <Button variant="tertiary" to={paths.player.bookings}>
                My bookings
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const status = String(booking?.status ?? "").toUpperCase();
  const code = booking?.bookingCode || `#${booking?.id ?? ""}`;
  const title =
    [booking?.venueName, booking?.pitchName].filter(Boolean).join(" · ") ||
    "Booking";
  const timeRange = formatTimeRange(booking?.startTime, booking?.endTime);
  const bookedAt = formatTimestamp(booking?.createdAt);
  const checkedInAt = formatTimestamp(booking?.checkedInAt);
  const updatedAt = formatTimestamp(booking?.updatedAt);

  const facts = [
    { id: "date", label: "DATE", value: formatBookingDate(booking) },
    { id: "play", label: "PLAY TIME", value: timeRange, num: true },
    { id: "pitch", label: "PITCH", value: booking?.pitchName ?? "—" },
    { id: "venue", label: "VENUE", value: booking?.venueName ?? "—" },
    { id: "area", label: "AREA", value: booking?.venueArea ?? "—" },
    { id: "code", label: "BOOKING CODE", value: code, num: true },
  ];

  // Only events the backend actually records get a timeline entry.
  const timeline = [
    bookedAt && { id: "created", title: "Booking created", when: bookedAt },
    checkedInAt && {
      id: "checkin",
      title: "Checked in at the gate",
      when: checkedInAt,
    },
    status === "CANCELLED" &&
      updatedAt && {
        id: "cancelled",
        title: "Booking cancelled · slot released",
        when: updatedAt,
      },
  ].filter(Boolean);

  return (
    <>
      <PageTitle title={`Booking ${code}`} />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 20, maxWidth: 1000 }}
      >
        <Breadcrumbs
          items={[
            { label: "My bookings", to: paths.player.bookings },
            { label: code },
          ]}
        />

        <div
          className="between"
          style={{ flexWrap: "wrap", gap: 10, marginBottom: 16 }}
        >
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>{title}</h1>
            <span className="subtle">
              Booking <b className="num">{code}</b>
              {bookedAt ? ` · booked ${bookedAt}` : ""}
            </span>
          </div>
          <div className="row-wrap">
            <span className={badge.className}>{badge.label}</span>
          </div>
        </div>

        <div className="bd-grid">
          <div className="stack">
            {/* Single source of truth */}
            <section className="card">
              <h3>Match details</h3>
              <div className="grid3" style={{ marginTop: 8, gap: 10 }}>
                {facts.map((fact) => (
                  <div className="panel" key={fact.id}>
                    <span className="tiny subtle">{fact.label}</span>
                    <br />
                    <b className={fact.num ? "num" : undefined}>{fact.value}</b>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button
                  size="sm"
                  variant="primary"
                  to={paths.player.matchdayFor(booking.id)}
                >
                  Open match-day ticket
                </Button>
                {booking?.venueSlug ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    to={paths.player.venue(booking.venueSlug)}
                  >
                    View venue
                  </Button>
                ) : null}
              </div>
            </section>

            {/* Timeline */}
            {timeline.length ? (
              <section className="card">
                <h3>Timeline</h3>
                <ul className="tline" style={{ marginTop: 10 }}>
                  {timeline.map((entry) => (
                    <li key={entry.id}>
                      <b className="small">{entry.title}</b>
                      <div className="when">{entry.when}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="stack">
            <div className="glass glass-card">
              <h4>Payment summary</h4>
              <div className="pricerow total">
                <span>Slot amount</span>
                <span className="num">{formatBdt(booking?.amount)}</span>
              </div>
              <p className="subtle tiny" style={{ margin: "8px 0 0" }}>
                The slot price recorded on this booking. No payment breakdown is
                stored for it.
              </p>
            </div>
            <div className="card">
              <h4>Check-in</h4>
              <p className="small muted" style={{ margin: "4px 0 10px" }}>
                {checkedInAt
                  ? `Checked in ${checkedInAt}.`
                  : "Not checked in yet — show your QR code at the gate."}
              </p>
              <Button
                size="sm"
                variant="secondary"
                block
                to={paths.player.matchdayFor(booking.id)}
              >
                Open ticket
              </Button>
            </div>
            <div className="card">
              <h4>Manage booking</h4>
              <div className="stack-sm">
                {isOwner && CANCELLABLE.includes(status) ? (
                  <Button
                    size="sm"
                    variant="ghostDanger"
                    block
                    onClick={onCancel}
                    loading={cancelling}
                    disabled={cancelling}
                  >
                    Cancel booking
                  </Button>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    {status === "CANCELLED"
                      ? "This booking is cancelled and its slot has been released."
                      : "This booking can no longer be changed."}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
