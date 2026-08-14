import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { paths } from "@/routes/paths";
import "./SplitPaymentPage.css";

/**
 * There is no split-payment API in this backend — no per-player shares, no
 * reminders, no collection. The page states that plainly instead of
 * simulating a roster.
 */
export default function SplitPaymentPage() {
  return (
    <>
      <PageTitle title="Team split payment" />
      <main className="wrap" id="main" style={{ paddingTop: 24, maxWidth: 860 }}>
        <Button variant="tertiary" size="sm" to={paths.player.bookings}>
          ← Back to bookings
        </Button>

        <div className="between" style={{ marginTop: 8, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>Team split payment</h1>
            <span className="subtle">Not available yet</span>
          </div>
          <span className="badge gray">Coming later</span>
        </div>

        <div className="glass glass-card" style={{ marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>Splitting a bill with your team isn&apos;t live yet</h3>
          <p className="subtle">
            TurfChai cannot collect money from your teammates, send them reminders, or track who has
            paid. A booking is made and paid for in one player&apos;s name, and settling up with the
            rest of the team happens outside the app for now.
          </p>
          <hr />
          <p className="subtle small" style={{ margin: 0 }}>
            This page will switch on once payments support per-player shares.
          </p>
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
            <Button variant="primary" to={paths.player.bookings}>
              View my bookings
            </Button>
            <Button to={paths.player.explore}>Find a turf</Button>
          </div>
        </div>
      </main>
    </>
  );
}
