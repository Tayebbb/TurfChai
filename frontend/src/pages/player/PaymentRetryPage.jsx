import { useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { paths } from "@/routes/paths";

/**
 * There is no payment gateway behind TurfChai yet, so no payment can fail and
 * there is nothing to retry. This page only exists to catch old links: it
 * explains that, and hands the slot back to checkout when the link carried one.
 */
export default function PaymentRetryPage() {
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get("slotId");
  const venue = searchParams.get("venue");
  const date = searchParams.get("date");

  const checkoutHref = slotId
    ? `${paths.player.checkout}?slotId=${encodeURIComponent(slotId)}` +
      (venue ? `&venue=${encodeURIComponent(venue)}` : "") +
      (date ? `&date=${encodeURIComponent(date)}` : "")
    : null;

  return (
    <>
      <PageTitle title="Payment" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 48, paddingBottom: 64 }}
      >
        <div className="card center" style={{ padding: "32px 24px" }}>
          <span className="badge gray">No payment taken</span>
          <h1 style={{ fontSize: 22, marginTop: 10 }}>
            TurfChai doesn&apos;t process payments yet
          </h1>
          <p
            className="muted small"
            style={{ maxWidth: 380, margin: "0 auto 4px" }}
          >
            There is no card, bKash or Nagad charge anywhere in the booking flow, so there is no
            failed payment to retry. Confirming a slot books it in your name and records the
            amount — you settle it with the venue.
          </p>
          <p className="subtle small" style={{ maxWidth: 380, margin: "0 auto" }}>
            {slotId
              ? "The slot from your link is below. Slot holds last 5 minutes, so it may need re-locking."
              : "Pick a slot on a venue page to start a booking."}
          </p>
          <div className="stack-sm" style={{ marginTop: 20 }}>
            {checkoutHref ? (
              <Button variant="primary" size="lg" block to={checkoutHref}>
                Back to checkout
              </Button>
            ) : null}
            <Button variant="secondary" block to={paths.player.explore}>
              Browse venues
            </Button>
            <Button variant="tertiary" block to={paths.player.bookings}>
              My bookings
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
