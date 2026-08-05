import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { useCountdown } from "@/hooks/useCountdown";
import { paths } from "@/routes/paths";

const CONSEQUENCES = [
  {
    id: "released",
    state: "fail",
    title: "Held slot released",
    body: "The 7:30 PM slot returns to live availability for everyone.",
  },
  {
    id: "no-charge",
    state: "pending",
    title: "No charge, no booking",
    body: "Nothing is recorded against your account or reliability score.",
  },
  {
    id: "rebook",
    title: "We'll help you rebook",
    body: "You'll be returned to search with the nearest alternative slots highlighted.",
  },
];

export default function PaymentRetryPage() {
  const { label } = useCountdown(147);

  return (
    <>
      <PageTitle title="Payment failed" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 48, paddingBottom: 64 }}
      >
        <div className="center" style={{ marginBottom: 14 }}>
          <span
            className="lock-timer"
            role="timer"
            aria-label="Slot hold expires in"
          >
            🔒 Hold expires in <span>{label}</span>
          </span>
        </div>

        <div className="card center" style={{ padding: "32px 24px" }}>
          <div className="fail-anim" aria-hidden="true">
            ✕
          </div>
          <span className="badge red">Payment failed</span>
          <h1 style={{ fontSize: 22, marginTop: 10 }}>
            Your bKash payment didn&apos;t go through
          </h1>
          <p
            className="muted small"
            style={{ maxWidth: 340, margin: "0 auto 4px" }}
          >
            bKash reported <b>insufficient balance</b> for ৳2,550. You have not
            been charged.
          </p>
          <p
            className="subtle small"
            style={{ maxWidth: 340, margin: "0 auto" }}
          >
            Your slot — <b>Kick Off Arena, Fri 8 Aug, 7:30 PM</b> — is still
            held. If you don&apos;t retry before the timer ends, the hold is
            released and the slot becomes available to others.
          </p>
          <div className="stack-sm" style={{ marginTop: 20 }}>
            <Button
              variant="primary"
              size="lg"
              block
              to={paths.player.checkout}
            >
              Retry payment
            </Button>
            <Button variant="secondary" block to={paths.player.checkout}>
              Choose another payment method
            </Button>
            <Button variant="tertiary" block to={paths.player.explore}>
              Give up the slot &amp; see alternatives
            </Button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>If the hold expires</h4>
          <ul className="tline" style={{ marginTop: 10 }}>
            {CONSEQUENCES.map((item) => (
              <li className={item.state} key={item.id}>
                <b className="small">{item.title}</b>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
