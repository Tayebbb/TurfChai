import { useState } from "react";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import "./ReviewPage.css";

const RATING_ROWS = [
  { id: "overall", label: "Overall", primary: true, initial: 5 },
  { id: "surface", label: "Surface", initial: 5 },
  { id: "lighting", label: "Lighting", initial: 4 },
  { id: "cleanliness", label: "Cleanliness", initial: 4 },
  { id: "amenities", label: "Amenities", initial: 3 },
  { id: "safety", label: "Safety", initial: 5 },
  { id: "youth", label: "Youth-friendliness", initial: 4 },
];

const INITIAL_RATINGS = Object.fromEntries(
  RATING_ROWS.map((row) => [row.id, row.initial]),
);

const STARS = [1, 2, 3, 4, 5];

const DEFAULT_REVIEW =
  "Grass is fresh and fast, floodlights excellent. Handover was exactly on time. Changing room a bit small for 10 people.";

export default function ReviewPage() {
  const { showToast } = useToast();
  const published = useDisclosure(false);
  const [ratings, setRatings] = useState(INITIAL_RATINGS);
  const [body, setBody] = useState(DEFAULT_REVIEW);
  const [parentReview, setParentReview] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Sets one category to the clicked star value. */
  const rate = (id, value) => setRatings((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      bookingId: 1, // Mocked booking ID
      userId: 1,    // Mocked user ID
      venueId: 1,   // Mocked venue ID
      overallRating: ratings.overall,
      subRatings: {
        surface: ratings.surface,
        lighting: ratings.lighting,
        cleanliness: ratings.cleanliness,
        amenities: ratings.amenities,
        safety: ratings.safety,
        youth: ratings.youth
      },
      comment: body,
      parentReview: parentReview
    };

    try {
      const response = await fetch("http://localhost:8080/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        published.open();
      } else {
        showToast("Failed to submit review.");
      }
    } catch {
      showToast("Network error. Could not submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Great game at Kick Off Arena?
          </h1>
          <p className="subtle small">
            Fri 8 Aug · 7:30–9:00 PM · your review is labelled{" "}
            <b>Verified booking</b>
          </p>
          <div
            className="row"
            style={{ justifyContent: "center", marginTop: 8 }}
          >
            <Button variant="tertiary" to={paths.player.home}>
              Not now
            </Button>
            <a className="btn btn-primary" href="#form">
              Leave a review
            </a>
          </div>
          <div
            className="alert ok"
            style={{ marginTop: 14, textAlign: "left" }}
          >
            <span className="ico">🏅</span>
            <div>
              <b>+250 points already credited</b> for completing this match —
              Silver → 1,490 pts. Reviews earn +25 more.
            </div>
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

          <div className="field">
            <label>Photos (optional)</label>
            <div className="row">
              <button
                type="button"
                className="icon-btn"
                style={{ width: 64, height: 64, fontSize: 22 }}
                aria-label="Add a photo"
                onClick={() => showToast("Camera opened 📷")}
              >
                +
              </button>
              <div
                className="photo"
                style={{ width: 64, height: 64, fontSize: 20 }}
              >
                ⚽
              </div>
            </div>
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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit review"}
          </Button>
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
          <h3>Review published — +25 points</h3>
          <p className="muted small">
            Thanks Rafi! Your verified review helps the next team book with
            confidence.
          </p>
          <div className="panel between" style={{ margin: "12px 0" }}>
            <span className="small muted">Rewards balance</span>
            <b className="num">1,515 pts · Silver</b>
          </div>
          <div className="progress" style={{ marginBottom: 6 }}>
            <i style={{ width: "76%" }} />
          </div>
          <p className="subtle tiny">485 points to Gold</p>
          <Button
            variant="primary"
            block
            to={paths.player.home}
            style={{ marginTop: 8 }}
          >
            Done
          </Button>
        </div>
      </Overlay>
    </>
  );
}
