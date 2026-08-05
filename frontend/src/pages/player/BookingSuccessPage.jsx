import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { fridayBooking } from "@/data/bookings";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";

export default function BookingSuccessPage() {
  const { showToast } = useToast();

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
          <span className="badge green">Booking confirmed</span>
          <h1 style={{ fontSize: 24, marginTop: 10 }}>
            You&apos;re playing Friday! 🎉
          </h1>
          <p className="subtle">
            Payment of ৳2,550 received via bKash · Kick Off Arena has been
            notified and can see your booking &amp; payment.
          </p>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                Kick Off Arena · Pitch 2
              </b>
              <span
                className="badge nodot"
                style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
              >
                7-a-side
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>
              {fridayBooking.address}
            </div>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div className="grid3" style={{ gap: 12 }}>
              <div>
                <span className="tiny subtle">DATE</span>
                <br />
                <b>{fridayBooking.date}</b>
              </div>
              <div>
                <span className="tiny subtle">PLAY TIME</span>
                <br />
                <b className="num">{fridayBooking.playTime}</b>
              </div>
              <div>
                <span className="tiny subtle">ARRIVE BY</span>
                <br />
                <b className="num">{fridayBooking.arriveBy}</b>
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
                {fridayBooking.ref}
              </b>
              <div className="row-wrap" style={{ marginTop: 6 }}>
                <span className="badge green">Paid in full</span>
              </div>
            </div>
            <div
              className="qr"
              style={{ width: 88, height: 88 }}
              role="img"
              aria-label="Booking QR code"
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
            to={paths.player.bookingDetail(fridayBooking.ref)}
          >
            View booking
          </Button>
          <Button
            variant="tertiary"
            onClick={() =>
              showToast("Calling Kick Off Arena · 01811 223 344 📞")
            }
          >
            Contact venue
          </Button>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>Arrival &amp; handover</h4>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Show your QR or reference <b>{fridayBooking.ref}</b> at the gate.
            Previous match ends 7:20 PM — you get a 10-minute handover window to
            warm up. Play ends sharp at 9:00 PM.
          </p>
        </div>

        <div className="alert ok" style={{ marginTop: 12 }}>
          <span className="ico">🏅</span>
          <div>
            <b>You&apos;ll earn ~250 points for this match</b>Credited
            automatically after you play. 760 more to reach Gold.
          </div>
        </div>
      </main>
    </>
  );
}
