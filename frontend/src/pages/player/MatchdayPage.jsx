import { useState } from "react";
import { PageTitle } from "@/components/common/PageTitle";
import { QrCode } from "@/components/common/QrCode";
import { Button } from "@/components/buttons/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  bookingEnd,
  bookingStart,
  checkInBooking,
  formatBookingDate,
  formatTimeOfDay,
  formatTimeRange,
  getBooking,
  listBookings,
  nextUpcomingBooking,
} from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useQueryParam } from "@/hooks/useQueryParam";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";

function MatchdayShell({ children }) {
  return (
    <>
      <PageTitle title="Match day" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 28, paddingBottom: 80 }}
      >
        <h1 className="sr-only">Match day</h1>
        {children}
      </main>
    </>
  );
}

export default function MatchdayPage() {
  const [bookingId] = useQueryParam("bookingId");
  const { showToast } = useToast();
  const [checkingIn, setCheckingIn] = useState(false);

  // An explicit ?bookingId wins; otherwise show whatever is up next.
  const {
    data: booking,
    loading,
    error,
    reload,
  } = useApi(
    () =>
      bookingId
        ? getBooking(bookingId)
        : listBookings().then((items) => nextUpcomingBooking(items)),
    [bookingId],
  );

  const onCheckIn = async () => {
    setCheckingIn(true);
    try {
      await checkInBooking(booking.id);
      showToast("Checked in — enjoy the match 🏅");
      reload();
    } catch (checkInError) {
      showToast(checkInError.message || "Check-in failed — please try again");
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <MatchdayShell>
        <SkeletonList count={3} height={90} />
      </MatchdayShell>
    );
  }

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <MatchdayShell>
        <div className="card" style={{ padding: 20 }}>
          <b>
            {unauthorized
              ? "Sign in to open your match-day ticket"
              : "Could not load your ticket"}
          </b>
          <p className="subtle small" style={{ margin: "6px 0 12px" }}>
            {error.message}
          </p>
          {unauthorized ? (
            <Button variant="primary" size="sm" to={paths.auth}>
              Sign in
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          )}
        </div>
      </MatchdayShell>
    );
  }

  if (!booking) {
    return (
      <MatchdayShell>
        <EmptyState
          glyph="🎫"
          title="No upcoming booking"
          description="Your match-day ticket appears here once you have a confirmed slot ahead of you."
          action={
            <Button variant="primary" to={paths.player.explore}>
              Find a slot
            </Button>
          }
        />
      </MatchdayShell>
    );
  }

  const code = booking.bookingCode ?? `#${booking.id}`;
  const start = bookingStart(booking);
  const arriveBy = start
    ? formatTimeOfDay(new Date(start.getTime() - 10 * 60 * 1000))
    : "—";
  const isToday = start
    ? start.toDateString() === new Date().toDateString()
    : false;
  const checkedIn = Boolean(booking.checkedInAt);
  // Scanning the ticket opens this booking, so any phone camera is a valid reader.
  const ticketUrl = `${window.location.origin}${paths.player.bookingDetail(booking.id)}`;

  return (
    <>
      <PageTitle title="Match day" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 28, paddingBottom: 80 }}
      >
        <div className="center" style={{ marginBottom: 16 }}>
          <span className={isToday ? "badge green" : "badge blue"}>
            {isToday
              ? `It's match day! Kick-off ${formatTimeOfDay(start)}`
              : `Kick-off ${formatBookingDate(booking)}, ${formatTimeOfDay(start)}`}
          </span>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                {booking.venueName ?? "Your venue"}
              </b>
              {booking.pitchName ? (
                <span
                  className="badge nodot"
                  style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
                >
                  {booking.pitchName}
                </span>
              ) : null}
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>
              {[booking.venueArea, formatBookingDate(booking)]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          <div className="center" style={{ padding: 20 }}>
            <QrCode
              value={ticketUrl}
              label={`Check-in QR code for booking ${code}`}
            />
            <b
              className="num"
              style={{
                fontSize: 20,
                letterSpacing: ".08em",
                display: "block",
                marginTop: 12,
              }}
            >
              {code}
            </b>
            <span className="subtle small">Show at the gate to check in</span>
          </div>

          <div className="perf" />

          <div style={{ padding: "16px 20px" }}>
            <div className="grid3" style={{ gap: 10 }}>
              <div>
                <span className="tiny subtle">PLAY TIME</span>
                <br />
                <b className="num">
                  {formatTimeRange(booking.startTime, booking.endTime)}
                </b>
              </div>
              <div>
                <span className="tiny subtle">ARRIVE BY</span>
                <br />
                <b className="num">{arriveBy}</b>
              </div>
              <div>
                <span className="tiny subtle">CHECK-IN</span>
                <br />
                {checkedIn ? (
                  <span className="badge green">Checked in</span>
                ) : (
                  <span className="badge amber">Not yet</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {checkedIn ? (
            <div className="alert ok">
              <span className="ico">🏅</span>
              <div>
                <b>You are checked in</b>
                Checked in at {formatTimeOfDay(new Date(booking.checkedInAt))}.
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              block
              size="lg"
              onClick={onCheckIn}
              loading={checkingIn}
              disabled={checkingIn}
            >
              Check in now
            </Button>
          )}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h4>Handover instructions</h4>
          <ul
            className="small muted"
            style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.9 }}
          >
            <li>
              Arrive by <b>{arriveBy}</b> — 10 minutes before kick-off
            </li>
            <li>Staff scan your QR, then the pitch is yours for warm-up</li>
            <li>
              Play ends at <b>{formatTimeOfDay(bookingEnd(booking))}</b> — the
              next team takes over
            </li>
          </ul>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          <Button variant="secondary" block to={paths.player.bookingDetail(booking.id)}>
            Booking details
          </Button>
        </div>
      </main>
    </>
  );
}
