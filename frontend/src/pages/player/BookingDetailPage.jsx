import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { fridayBooking } from "@/data/bookings";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import "./BookingDetailPage.css";

const MATCH_FACTS = [
  { id: "date", label: "DATE", value: fridayBooking.date },
  {
    id: "play",
    label: "PLAY TIME",
    value: fridayBooking.playTimeSpaced,
    num: true,
  },
  { id: "handover", label: "HANDOVER", value: "7:20 PM · 10 min" },
  { id: "pitch", label: "PITCH", value: "Pitch 2 · 7-a-side" },
  { id: "surface", label: "SURFACE", value: "Artificial grass" },
  {
    id: "contact",
    label: "VENUE CONTACT",
    value: fridayBooking.phone,
    num: true,
  },
];

const TIMELINE = [
  {
    id: "confirmed",
    title: "Booking confirmed · payment visible to venue",
    when: "Mon 4 Aug, 8:14 PM",
  },
  {
    id: "paid",
    title: "bKash payment received — ৳2,550",
    when: "Mon 4 Aug, 8:14 PM · TXN 8H2K19",
  },
  {
    id: "locked",
    title: "Slot locked during checkout",
    when: "Mon 4 Aug, 8:09 PM",
  },
  {
    id: "reminder",
    title: "Reminder scheduled",
    when: "Will send Fri 8 Aug, 5:30 PM",
    state: "pending",
  },
];

const TRANSACTIONS = [
  {
    id: "captain",
    date: "4 Aug",
    detail: "Booking payment (captain)",
    method: "bKash",
    amount: "৳2,550",
  },
  {
    id: "tanvir",
    date: "4 Aug",
    detail: "Split repayment · Tanvir",
    method: "bKash",
    amount: "৳255",
  },
  {
    id: "sabbir",
    date: "3 Aug",
    detail: "Split repayment · Sabbir",
    method: "Nagad",
    amount: "৳255",
  },
];

const PAID_AVATARS = [
  { id: "rk", initials: "RK" },
  { id: "ta", initials: "TA", tone: "b" },
  { id: "sm", initials: "SM", tone: "c" },
  { id: "nh", initials: "NH", tone: "d" },
  { id: "ju", initials: "JU" },
  { id: "ar", initials: "AR", tone: "b" },
];

export default function BookingDetailPage() {
  const { showToast } = useToast();

  return (
    <>
      <PageTitle title="Booking TC-48291" />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 20, maxWidth: 1000 }}
      >
        <Breadcrumbs
          items={[
            { label: "My bookings", to: paths.player.bookings },
            { label: fridayBooking.ref },
          ]}
        />

        <div
          className="between"
          style={{ flexWrap: "wrap", gap: 10, marginBottom: 16 }}
        >
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>
              Kick Off Arena · Pitch 2
            </h1>
            <span className="subtle">
              Booking <b className="num">{fridayBooking.ref}</b> · booked Mon 4
              Aug, 8:14 PM
            </span>
          </div>
          <div className="row-wrap">
            <span className="badge green">Confirmed</span>
            <span className="badge amber">Partially paid · 6/10</span>
          </div>
        </div>

        <div className="bd-grid">
          <div className="stack">
            {/* Single source of truth */}
            <section className="card">
              <h3>Match details</h3>
              <div className="grid3" style={{ marginTop: 8, gap: 10 }}>
                {MATCH_FACTS.map((fact) => (
                  <div className="panel" key={fact.id}>
                    <span className="tiny subtle">{fact.label}</span>
                    <br />
                    <b className={fact.num ? "num" : undefined}>{fact.value}</b>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button size="sm" variant="primary" to={paths.player.matchday}>
                  Open match-day ticket
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => showToast("Directions opened 🗺️")}
                >
                  Directions
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => showToast("Calling venue 📞")}
                >
                  Contact venue
                </Button>
              </div>
            </section>

            {/* Team */}
            <section className="card">
              <div className="between">
                <h3 style={{ margin: 0 }}>Team &amp; contributions</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  to={paths.player.splitPayment}
                >
                  Manage split
                </Button>
              </div>
              <div className="progress" style={{ margin: "12px 0 6px" }}>
                <i style={{ width: "60%" }} />
              </div>
              <div className="between subtle small">
                <span>৳1,530 of ৳2,550 collected</span>
                <span>6 of 10 paid · deadline Thu 9 PM</span>
              </div>
              <div className="row-wrap" style={{ marginTop: 10 }}>
                {PAID_AVATARS.map((person) => (
                  <span
                    className={person.tone ? `avatar ${person.tone}` : "avatar"}
                    key={person.id}
                  >
                    {person.initials}
                  </span>
                ))}
                <span className="subtle small">+ 4 unpaid</span>
              </div>
            </section>

            {/* Timeline */}
            <section className="card">
              <h3>Timeline</h3>
              <ul className="tline" style={{ marginTop: 10 }}>
                {TIMELINE.map((entry) => (
                  <li className={entry.state} key={entry.id}>
                    <b className="small">{entry.title}</b>
                    <div className="when">{entry.when}</div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Transactions */}
            <section className="card">
              <h3>Transactions</h3>
              <div
                className="table-wrap"
                style={{ marginTop: 8, border: "none" }}
              >
                <table className="table" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Detail</th>
                      <th>Method</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRANSACTIONS.map((row) => (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td>{row.detail}</td>
                        <td>{row.method}</td>
                        <td className="num">{row.amount}</td>
                        <td>
                          <span className="badge green">Paid</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="stack">
            <div className="glass glass-card">
              <h4>Payment summary</h4>
              <div className="pricerow">
                <span>Slot (90 min)</span>
                <span className="num">৳2,500</span>
              </div>
              <div className="pricerow">
                <span>Service fee</span>
                <span className="num">৳150</span>
              </div>
              <div className="pricerow">
                <span className="neg">Rewards applied</span>
                <span className="num neg">−৳100</span>
              </div>
              <div className="pricerow total">
                <span>Total paid</span>
                <span className="num">{fridayBooking.total}</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                block
                style={{ marginTop: 10 }}
                onClick={() => showToast("Receipt downloaded 🧾")}
              >
                Download receipt
              </Button>
            </div>
            <div className="card">
              <h4>Cancellation policy</h4>
              <p className="small muted" style={{ margin: "4px 0 10px" }}>
                Free until <b>Thu 7 Aug, 7:30 PM</b> · 50% refund until Fri 1:30
                PM · none after.
              </p>
              <div className="stack-sm">
                <Button
                  size="sm"
                  variant="secondary"
                  block
                  onClick={() =>
                    showToast("Replacement request posted to Open Games 📣")
                  }
                >
                  Find replacement player
                </Button>
                <Button
                  size="sm"
                  variant="ghostDanger"
                  block
                  to={paths.player.cancel}
                >
                  Cancel booking
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
