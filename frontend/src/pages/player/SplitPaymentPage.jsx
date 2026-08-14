import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { getBooking } from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import "./SplitPaymentPage.css";

const STEPPER_BTN = { width: 30, height: 30 };

export default function SplitPaymentPage() {
  const { showToast } = useToast();
  const bookingApi = useApi(() => getBooking('TC-48291'), []);
  const booking = bookingApi.data;
  const splitRoster = booking?.members || [];

  return (
    <>
      <PageTitle title="Team split payment" />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 24, maxWidth: 860 }}
      >
        <Button variant="tertiary" size="sm" to={paths.player.bookingSuccess}>
          ← Back
        </Button>

        <div
          className="between"
          style={{ marginTop: 8, flexWrap: "wrap", gap: 10 }}
        >
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>
              Team split · Friday&apos;s match
            </h1>
            <span className="subtle">
              Kick Off Arena · Fri 8 Aug, 7:30–9:00 PM · Ref TC-48291
            </span>
          </div>
          <span className="badge amber">6 of 10 paid</span>
        </div>

        <div className="grid2" style={{ marginTop: 20, alignItems: "start" }}>
          {/* Collection progress */}
          <div className="glass glass-card">
            <div className="row">
              <div
                className="ring"
                role="img"
                aria-label="60 percent collected"
              >
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle className="track" cx="48" cy="48" r="40" />
                  <circle
                    className="bar"
                    cx="48"
                    cy="48"
                    r="40"
                    strokeDasharray="251"
                    strokeDashoffset="100"
                  />
                </svg>
                <div className="mid">
                  60%<span>collected</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="pricerow" style={{ padding: "2px 0" }}>
                  <span className="muted small">Total</span>
                  <b className="num">৳2,550</b>
                </div>
                <div className="pricerow" style={{ padding: "2px 0" }}>
                  <span className="muted small">Collected</span>
                  <b className="num" style={{ color: "var(--brand-600)" }}>
                    ৳1,530
                  </b>
                </div>
                <div className="pricerow" style={{ padding: "2px 0" }}>
                  <span className="muted small">Remaining</span>
                  <b className="num" style={{ color: "var(--warn)" }}>
                    ৳1,020
                  </b>
                </div>
              </div>
            </div>
            <hr />
            <div className="between small">
              <span className="muted">⏳ Split deadline</span>
              <b>Thu 7 Aug, 9:00 PM</b>
            </div>
            <p className="subtle tiny" style={{ margin: "6px 0 0" }}>
              You already paid the venue in full — teammates repay you through
              TurfChai. Unpaid shares stay your responsibility.
            </p>
            <div className="grid2" style={{ gap: 8, marginTop: 12 }}>
              <Button
                variant="primary"
                onClick={() =>
                  showToast("Invite link copied — share on WhatsApp 📲")
                }
              >
                Share invite link
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  showToast("Reminder sent to 4 unpaid teammates 🔔")
                }
              >
                Remind unpaid (4)
              </Button>
            </div>
          </div>

          {/* Shares */}
          <div className="card">
            <div className="between">
              <h3 style={{ margin: 0 }}>Shares</h3>
              <div className="seg" role="group" aria-label="Split mode">
                <button type="button" className="on">
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    showToast("Custom shares: edit any amount inline")
                  }
                >
                  Custom
                </button>
              </div>
            </div>

            <div className="between small" style={{ margin: "10px 0 4px" }}>
              <span className="muted">Players</span>
              <span className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="icon-btn"
                  style={STEPPER_BTN}
                  aria-label="Remove a player"
                  onClick={() => showToast("9 players · ৳284 each")}
                >
                  −
                </button>
                <b className="num">10</b>
                <button
                  type="button"
                  className="icon-btn"
                  style={STEPPER_BTN}
                  aria-label="Add a player"
                  onClick={() => showToast("11 players · ৳232 each")}
                >
                  +
                </button>
              </span>
            </div>

            <div className="panel between">
              <span className="small muted">Each player pays</span>
              <b className="num" style={{ fontSize: 18 }}>
                ৳255
              </b>
            </div>

            <div style={{ marginTop: 12 }}>
              {splitRoster.map((member) => (
                <div className="member" key={member.id}>
                  <span
                    className={member.tone ? `avatar ${member.tone}` : "avatar"}
                  >
                    {member.initials}
                  </span>
                  <div style={{ flex: 1 }}>
                    <b className="small">{member.name}</b>
                    <div className="tiny subtle">{member.note}</div>
                  </div>
                  {member.paid ? (
                    <span className="badge green">Paid ৳255</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => showToast(member.toast)}
                    >
                      {member.action}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              block
              style={{ marginTop: 12 }}
              onClick={() =>
                showToast("You paid the remaining ৳1,020 — split closed ✓")
              }
            >
              Pay remaining ৳1,020 myself
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
