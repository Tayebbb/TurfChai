import { useState } from "react";
import { Link } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { QrCode } from "@/components/common/QrCode";
import { Button } from "@/components/buttons/Button";
import { apiSend } from "@/api/client";
import { fridayBooking } from "@/data/bookings";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";

const TEAM_AVATARS = [
  { id: "rk", initials: "RK" },
  { id: "ta", initials: "TA", tone: "b" },
  { id: "sm", initials: "SM", tone: "c" },
  { id: "nh", initials: "NH", tone: "d" },
  { id: "ju", initials: "JU" },
  { id: "more", initials: "+5", tone: "b" },
];

export default function MatchdayPage() {
  const { showToast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Scanning the ticket opens this booking, so any phone camera is a valid reader.
  const ticketUrl = `${window.location.origin}${paths.player.bookingDetail(fridayBooking.ref)}`;

  const handleCheckIn = async () => {
    try {
      await apiSend('POST', '/api/v1/matchday/checkin?bookingId=1');
      setIsCheckedIn(true);
      showToast("Checked in successfully! 🏅");
    } catch {
      showToast("Check-in failed. Please try again.");
    }
  };

  return (
    <>
      <PageTitle title="Match day" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 28, paddingBottom: 80 }}
      >
        <div className="center" style={{ marginBottom: 16 }}>
          <span className="badge green">
            It&apos;s match day! Kickoff in 2h 10m
          </span>
        </div>

        <div className="ticket">
          <div className="head">
            <div className="between">
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                {fridayBooking.venue}
              </b>
              <span
                className="badge nodot"
                style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
              >
                Pitch 2
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>
              House 12, Road 27, Dhanmondi · Fri 8 Aug 2026
            </div>
          </div>

          <div className="center" style={{ padding: 20 }}>
            <QrCode
              value={ticketUrl}
              label={`Check-in QR code for booking ${fridayBooking.ref}`}
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
              {fridayBooking.ref}
            </b>
            <span className="subtle small">Show at the gate to check in</span>
          </div>

          <div className="perf" />

          <div style={{ padding: "16px 20px" }}>
            <div className="grid3" style={{ gap: 10 }}>
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
              <div>
                <span className="tiny subtle">CHECK-IN</span>
                <br />
                {isCheckedIn ? (
                  <span className="badge green">Checked in</span>
                ) : (
                  <span className="badge amber">Not yet</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 14, gap: 10 }}>
          <Button
            variant="primary"
            onClick={() =>
              showToast("Opening directions — 12 min from your location 🗺️")
            }
          >
            🗺️ Directions
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast("Calling Kick Off Arena · 01811 223 344 📞")
            }
          >
            📞 Contact venue
          </Button>
        </div>

        {!isCheckedIn && (
          <div style={{ marginTop: 14 }}>
            <Button variant="primary" block size="lg" onClick={handleCheckIn}>
              Simulate Check-In (Test API)
            </Button>
          </div>
        )}

        <div className="card" style={{ marginTop: 14 }}>
          <h4>Handover instructions</h4>
          <ul
            className="small muted"
            style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.9 }}
          >
            <li>
              Previous match ends <b>7:20 PM</b> — wait by the Pitch 2 gate
            </li>
            <li>Staff scans your QR, then the pitch is yours for warm-up</li>
            <li>
              Play ends <b>sharp at 9:00 PM</b> — next team takes over 9:10
            </li>
            <li>Bibs and match ball available at the front desk</li>
          </ul>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="between">
            <h4 style={{ margin: 0 }}>Team (10)</h4>
            <Button
              size="sm"
              variant="secondary"
              to={paths.player.splitPayment}
            >
              Roster
            </Button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="avatar-group">
              {TEAM_AVATARS.map((person) => (
                <span
                  className={person.tone ? `avatar ${person.tone}` : "avatar"}
                  key={person.id}
                >
                  {person.initials}
                </span>
              ))}
            </div>
            <span className="subtle small">6 paid · 4 pay cash to you</span>
          </div>
        </div>

        <div className="alert ok" style={{ marginTop: 14 }}>
          <span className="ico">🏅</span>
          <div>
            <b>After the final whistle</b>~250 points credit automatically, and
            we&apos;ll ask if you want to leave a quick review.{" "}
            <Link to={paths.player.review}>Preview the review flow →</Link>
          </div>
        </div>
      </main>
    </>
  );
}
