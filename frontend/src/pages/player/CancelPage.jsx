import { useState } from "react";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  cancelBooking,
  formatBookingDate,
  formatTimeRange,
  getBooking,
} from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useQueryParam } from "@/hooks/useQueryParam";
import { paths } from "@/routes/paths";
import { formatBdt } from "@/utils/format";

/** Only a live booking can be released back to availability. */
const CANCELLABLE = ["CONFIRMED", "PENDING"];

function CancelShell({ children }) {
  return (
    <>
      <PageTitle title="Cancel booking" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 32, paddingBottom: 64 }}
      >
        {children}
      </main>
    </>
  );
}

export default function CancelPage() {
  const [bookingId] = useQueryParam("bookingId");
  const cancelled = useDisclosure(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null);

  const {
    data: booking,
    loading,
    error,
    reload,
  } = useApi(
    () => (bookingId ? getBooking(bookingId) : Promise.resolve(null)),
    [bookingId],
  );

  const onCancel = async () => {
    setSubmitting(true);
    setFailure(null);
    try {
      await cancelBooking(booking.id);
      cancelled.open();
      reload();
    } catch (cancelError) {
      setFailure(cancelError);
    } finally {
      setSubmitting(false);
    }
  };

  const label = booking?.bookingCode ?? (booking ? `#${booking.id}` : "");
  const venueLine = booking
    ? [booking.venueName, booking.pitchName].filter(Boolean).join(" · ")
    : "";
  const timeLine = booking
    ? `${formatBookingDate(booking)}, ${formatTimeRange(booking.startTime, booking.endTime)}`
    : "";

  let content;
  if (!bookingId) {
    content = (
      <EmptyState
        glyph="🗓️"
        title="Pick a booking to cancel"
        description="Open the booking you want to cancel from your bookings list, then choose Cancel."
        action={
          <Button variant="primary" to={paths.player.bookings}>
            My bookings
          </Button>
        }
      />
    );
  } else if (loading) {
    content = <SkeletonList count={3} height={80} />;
  } else if (error) {
    const unauthorized = error.status === 401;
    content = (
      <div className="card" style={{ padding: 20 }}>
        <b>
          {unauthorized
            ? "Sign in to manage this booking"
            : "Could not load this booking"}
        </b>
        <p className="subtle small" style={{ margin: "6px 0 12px" }}>
          {error.message}
        </p>
        <div className="row-wrap">
          {unauthorized ? (
            <Button variant="primary" size="sm" to={paths.auth}>
              Sign in
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          )}
          <Button variant="tertiary" size="sm" to={paths.player.bookings}>
            My bookings
          </Button>
        </div>
      </div>
    );
  } else if (!booking) {
    content = (
      <EmptyState
        glyph="🗓️"
        title="Booking not found"
        description="This booking is no longer available on your account."
        action={
          <Button variant="primary" to={paths.player.bookings}>
            My bookings
          </Button>
        }
      />
    );
  } else if (!CANCELLABLE.includes(String(booking.status).toUpperCase())) {
    content = (
      <>
        <h1 style={{ fontSize: 22 }}>Booking {label}</h1>
        <p className="subtle" style={{ marginBottom: 16 }}>
          {venueLine} · {timeLine}
        </p>
        <div className="card" style={{ padding: 20 }}>
          <b>This booking cannot be cancelled</b>
          <p className="subtle small" style={{ margin: "6px 0 12px" }}>
            Its status is {String(booking.status).toLowerCase()}, so there is no
            live slot left to release.
          </p>
          <Button
            variant="secondary"
            size="sm"
            to={paths.player.bookingDetail(booking.id)}
          >
            View booking
          </Button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <h1 style={{ fontSize: 22 }}>Cancel booking {label}?</h1>
        <p className="subtle" style={{ marginBottom: 16 }}>
          {venueLine} · {timeLine}
        </p>

        <div className="card">
          <div className="panel">
            <b className="small">Booking summary</b>
            <div className="pricerow">
              <span>Venue</span>
              <span>{booking.venueName ?? "—"}</span>
            </div>
            <div className="pricerow">
              <span>Pitch</span>
              <span>{booking.pitchName ?? "—"}</span>
            </div>
            <div className="pricerow">
              <span>Date</span>
              <span>{formatBookingDate(booking)}</span>
            </div>
            <div className="pricerow">
              <span>Play time</span>
              <span className="num">
                {formatTimeRange(booking.startTime, booking.endTime)}
              </span>
            </div>
            <div className="pricerow total">
              <span>Slot amount</span>
              <span className="num">{formatBdt(booking.amount)}</span>
            </div>
          </div>

          <p className="subtle tiny" style={{ margin: "8px 0 0" }}>
            Cancelling releases the slot straight away. Any money already paid is
            settled with the venue — TurfChai does not issue the refund from this
            screen.
          </p>
        </div>

        <div className="alert warn" style={{ marginTop: 14 }}>
          <span className="ico">⚠️</span>
          <div>
            <b>This releases your slot</b>
            {timeLine} at {booking.venueName ?? "this venue"} returns to live
            availability and anyone can book it.
          </div>
        </div>

        {failure ? (
          <div className="alert warn" style={{ marginTop: 12 }} role="alert">
            <span className="ico">⚠️</span>
            <div>{failure.message}</div>
          </div>
        ) : null}

        <div className="stack-sm" style={{ marginTop: 16 }}>
          <Button
            variant="danger"
            size="lg"
            block
            onClick={onCancel}
            loading={submitting}
            disabled={submitting}
          >
            Cancel this booking
          </Button>
          <Button
            variant="secondary"
            block
            to={paths.player.bookingDetail(booking.id)}
          >
            Keep my booking
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <CancelShell>{content}</CancelShell>

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
            {label ? <b className="num">{label}</b> : "Your booking"} at{" "}
            {booking?.venueName ?? "the venue"} is cancelled and the slot is back
            in live availability.
          </p>
          <div className="stack-sm" style={{ marginTop: 14 }}>
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
