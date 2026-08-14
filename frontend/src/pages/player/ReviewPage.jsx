import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { apiSend, getUser } from "@/api/client";
import {
  formatBookingDate,
  formatTimeRange,
  getBooking,
  groupBookings,
  listBookings,
} from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import "./ReviewPage.css";

const RATING_ROWS = [
  { id: "overall", label: "Overall", primary: true },
  { id: "surface", label: "Surface" },
  { id: "lighting", label: "Lighting" },
  { id: "cleanliness", label: "Cleanliness" },
  { id: "amenities", label: "Amenities" },
  { id: "safety", label: "Safety" },
  { id: "youth", label: "Youth-friendliness" },
];

/** Nothing is pre-rated — a 0 renders every star "off" and is never sent. */
const INITIAL_RATINGS = Object.fromEntries(RATING_ROWS.map((row) => [row.id, 0]));

const SUB_RATING_IDS = RATING_ROWS.filter((row) => !row.primary).map((row) => row.id);

const STARS = [1, 2, 3, 4, 5];

/** Describes the match a review belongs to, from the booking itself. */
function matchLine(booking) {
  return [
    formatBookingDate(booking),
    formatTimeRange(booking?.startTime, booking?.endTime),
    booking?.pitchName,
  ]
    .filter((part) => part && part !== "\u2014")
    .join(" \u00b7 ");
}

/** Empty/loading/error/sign-in shells all share this frame. */
function ReviewShell({ children }) {
  return (
    <>
      <PageTitle title="Leave a review" />
      <main className="wrap-form" id="main" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {children}
      </main>
    </>
  );
}

/** Lets the player pick which finished match they are reviewing. */
function PickBooking() {
  const { data, loading, error, reload } = useApi(() => listBookings(), []);

  if (loading) {
    return (
      <ReviewShell>
        <p className="subtle" role="status">
          Loading your matches…
        </p>
      </ReviewShell>
    );
  }

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <ReviewShell>
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>
            {unauthorized ? "Sign in to review a match" : "Could not load your matches"}
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
          </div>
        </div>
      </ReviewShell>
    );
  }

  const completed = groupBookings(data).completed;

  return (
    <ReviewShell>
      <div className="card">
        <h1 style={{ fontSize: 21, marginBottom: 4 }}>Which match are you reviewing?</h1>
        {completed.length === 0 ? (
          <>
            <p className="subtle small">
              You have no finished matches yet. Reviews unlock once you have played.
            </p>
            <Button variant="primary" to={paths.player.bookings} style={{ marginTop: 10 }}>
              My bookings
            </Button>
          </>
        ) : (
          <div style={{ marginTop: 10 }}>
            {completed.map((booking) => (
              <Link
                key={booking.id}
                className="member"
                to={`${paths.player.review}?bookingId=${booking.id}`}
                style={{ textDecoration: "none", color: "var(--text)" }}
              >
                <div style={{ flex: 1 }}>
                  <b className="small">{booking.venueName ?? "Venue"}</b>
                  <div className="tiny subtle">{matchLine(booking)}</div>
                </div>
                <span className="btn btn-sm btn-secondary">Review</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ReviewShell>
  );
}

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");

  if (!bookingId) return <PickBooking />;
  return <ReviewForm bookingId={bookingId} />;
}

function ReviewForm({ bookingId }) {
  const { showToast } = useToast();
  const published = useDisclosure(false);
  const [ratings, setRatings] = useState(INITIAL_RATINGS);
  const [body, setBody] = useState("");
  const [parentReview, setParentReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getUser();
  const { data: booking, loading, error, reload } = useApi(
    () => getBooking(bookingId),
    [bookingId],
  );

  /** Sets one category to the clicked star value. */
  const rate = (id, value) => setRatings((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!booking || !currentUser?.id || ratings.overall === 0) return;
    setIsSubmitting(true);

    const subRatings = Object.fromEntries(
      SUB_RATING_IDS.filter((id) => ratings[id] > 0).map((id) => [id, ratings[id]]),
    );

    try {
      await apiSend("POST", "/api/v1/reviews", {
        bookingId: booking.id,
        userId: currentUser.id,
        venueId: booking.venueId,
        overallRating: ratings.overall,
        subRatings,
        comment: body,
        parentReview,
      });
      published.open();
    } catch (submitError) {
      showToast(submitError.message || "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ReviewShell>
        <p className="subtle" role="status">
          Loading the match…
        </p>
      </ReviewShell>
    );
  }

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <ReviewShell>
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>
            {unauthorized ? "Sign in to review this match" : "Could not load this match"}
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
            <Button variant="tertiary" to={paths.player.bookings}>
              My bookings
            </Button>
          </div>
        </div>
      </ReviewShell>
    );
  }

  if (!currentUser?.id) {
    return (
      <ReviewShell>
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>Sign in to leave a review</h1>
          <p className="subtle">Reviews are tied to the account that made the booking.</p>
          <Button variant="primary" to={paths.auth} style={{ marginTop: 12 }}>
            Sign in
          </Button>
        </div>
      </ReviewShell>
    );
  }

  return (
    <>
      <PageTitle title="Leave a review" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 32, paddingBottom: 64 }}
      >
        <div className="glass glass-card center" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 30 }}>⚽</span>
          <h1 style={{ fontSize: 21, marginTop: 6 }}>
            How was {booking.venueName ?? "your match"}?
          </h1>
          <p className="subtle small">
            {matchLine(booking)} · your review is labelled <b>Verified booking</b>
          </p>
          <div
            className="row"
            style={{ justifyContent: "center", marginTop: 8 }}
          >
            <Button variant="tertiary" to={paths.player.bookings}>
              Not now
            </Button>
            <a className="btn btn-primary" href="#form">
              Leave a review
            </a>
          </div>
        </div>

        <div className="card" id="form">
          <h3>Rate the venue</h3>
          <div style={{ marginTop: 6 }}>
            {RATING_ROWS.map((row) => (
              <div className="rate-row" key={row.id}>
                {row.primary ? (
                  <b className="small">{row.label}</b>
                ) : (
                  <span className="small muted">{row.label}</span>
                )}
                <div
                  className="starpick"
                  role="radiogroup"
                  aria-label={`${row.label} rating`}
                >
                  {STARS.map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={star > ratings[row.id] ? "off" : undefined}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      aria-checked={ratings[row.id] === star}
                      role="radio"
                      onClick={() => rate(row.id, star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="rev">Your review</label>
            <textarea
              className="input"
              id="rev"
              placeholder="How was the pitch, the lights, the staff?"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <label className="checkline" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={parentReview}
              onChange={(event) => setParentReview(event.target.checked)}
            />
            <span>
              🧒 Mark as a <b>parent review</b> — I brought children to this
              venue
            </span>
          </label>

          <Button
            variant="primary"
            size="lg"
            block
            onClick={handleSubmit}
            disabled={isSubmitting || ratings.overall === 0}
          >
            {isSubmitting ? "Submitting…" : "Submit review"}
          </Button>
          {ratings.overall === 0 ? (
            <p className="tiny subtle" style={{ margin: "8px 0 0" }}>
              Give an overall rating to submit.
            </p>
          ) : null}
        </div>
      </main>

      <Overlay
        isOpen={published.isOpen}
        onClose={published.close}
        hideHeader
        title="Review published"
      >
        <div className="center">
          <div className="check-anim" aria-hidden="true">
            🏅
          </div>
          <h3>Review published</h3>
          <p className="muted small">
            Thanks — your verified review of {booking.venueName ?? "this venue"} helps the next team
            book with confidence.
          </p>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            {booking.venueSlug ? (
              <Button variant="primary" block to={paths.player.venue(booking.venueSlug)}>
                See the venue page
              </Button>
            ) : null}
            <Button variant="secondary" block to={paths.player.bookings}>
              My bookings
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
