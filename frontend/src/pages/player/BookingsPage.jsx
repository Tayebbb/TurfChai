import { useState } from "react";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { DateStrip, SlotGrid } from "@/components/booking/SlotGrid";
import { TabPanel, Tabs } from "@/components/navigation/Tabs";
import { Photo } from "@/components/ui/Photo";
import { fridayBooking } from "@/data/bookings";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";

const TABS = [
  { id: "up", label: "Upcoming (2)" },
  { id: "pend", label: "Pending payment (1)" },
  { id: "done", label: "Completed" },
  { id: "canc", label: "Cancelled" },
];

const RESCHEDULE_DATES = [
  { id: "sun-10", weekday: "Sun", day: "10" },
  { id: "mon-11", weekday: "Mon", day: "11" },
  { id: "tue-12", weekday: "Tue", day: "12" },
  { id: "wed-13", weekday: "Wed", day: "13" },
];

const RESCHEDULE_SLOTS = [
  { id: "8pm", time: "8:00 PM", price: "৳600", status: "available" },
  { id: "9pm", time: "9:00 PM", price: "Booked", status: "booked" },
  { id: "10pm", time: "10:00 PM", price: "৳500", status: "available" },
];

const THUMB_STYLE = { width: 56, height: 56, fontSize: 22, flex: "none" };

export default function BookingsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("up");
  const [rescheduleDate, setRescheduleDate] = useState("sun-10");
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const reschedule = useDisclosure(false);

  return (
    <>
      <PageTitle title="My bookings" />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 24, maxWidth: 860 }}
      >
        <h1 style={{ fontSize: 24 }}>My bookings</h1>

        <Tabs
          items={TABS}
          value={tab}
          onChange={setTab}
          label="Booking status"
        />

        {/* UPCOMING */}
        <TabPanel id="up" value={tab}>
          <div className="stack">
            <div className="card">
              <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row">
                  <Photo style={THUMB_STYLE} glyph="⚽" />
                  <div>
                    <b>Kick Off Arena · Pitch 2</b>
                    <div className="subtle small">
                      Fri 8 Aug · 7:30–9:00 PM · Ref TC-48291
                    </div>
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      <span className="badge green">Confirmed</span>
                      <span className="badge amber">6/10 paid</span>
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <Button
                    size="sm"
                    variant="secondary"
                    to={paths.player.splitPayment}
                  >
                    Invite players
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
                    variant="primary"
                    to={paths.player.bookingDetail(fridayBooking.ref)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row">
                  <Photo variant="alt2" style={THUMB_STYLE} glyph="🏸" />
                  <div>
                    <b>ShuttleZone Lalmatia · Court 1</b>
                    <div className="subtle small">
                      Sun 10 Aug · 9:00–10:00 PM · Ref TC-48307
                    </div>
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      <span className="badge green">Confirmed</span>
                      <span className="badge green">Paid</span>
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={reschedule.open}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="ghostDanger"
                    to={paths.player.cancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    to={paths.player.bookingDetail("TC-48307")}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* PENDING */}
        <TabPanel id="pend" value={tab}>
          <div className="card">
            <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="row">
                <Photo variant="alt1" style={THUMB_STYLE} glyph="⚽" />
                <div>
                  <b>GreenTurf Mohammadpur · Pitch A</b>
                  <div className="subtle small">
                    Tue 12 Aug · 8:30–9:30 PM · Ref TC-48312
                  </div>
                  <div className="row-wrap" style={{ marginTop: 4 }}>
                    <span className="badge amber">Pending payment</span>
                    <span className="badge amber">
                      Deposit paid · ৳1,260 due
                    </span>
                  </div>
                </div>
              </div>
              <div className="row-wrap">
                <Button size="sm" variant="primary" to={paths.player.checkout}>
                  Pay balance ৳1,260
                </Button>
                <Button
                  size="sm"
                  variant="ghostDanger"
                  to={paths.player.cancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <div className="alert warn" style={{ marginTop: 12 }}>
              <span className="ico">⏳</span>
              <div>
                Balance due by <b>Tue 12 Aug, 2:30 PM</b> or the booking
                auto-cancels and the deposit is refunded per policy.
              </div>
            </div>
          </div>
        </TabPanel>

        {/* COMPLETED */}
        <TabPanel id="done" value={tab}>
          <div className="stack">
            <div className="card">
              <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row">
                  <Photo variant="alt1" style={THUMB_STYLE} glyph="⚽" />
                  <div>
                    <b>GreenTurf Mohammadpur · Pitch B</b>
                    <div className="subtle small">
                      Fri 1 Aug · 7:00–8:00 PM · Ref TC-47950
                    </div>
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      <span className="badge green">Completed</span>
                      <span className="badge blue nodot">+150 pts earned</span>
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => showToast("Receipt downloaded 🧾")}
                  >
                    Receipt
                  </Button>
                  <Button size="sm" variant="primary" to={paths.player.review}>
                    Leave review
                  </Button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row">
                  <Photo style={THUMB_STYLE} glyph="⚽" />
                  <div>
                    <b>Kick Off Arena · Pitch 1</b>
                    <div className="subtle small">
                      Fri 25 Jul · 9:10–10:40 PM · Ref TC-47701
                    </div>
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      <span className="badge green">Completed</span>
                      <span className="badge gray nodot">Reviewed ★5</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => showToast("Receipt downloaded 🧾")}
                >
                  Receipt
                </Button>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* CANCELLED */}
        <TabPanel id="canc" value={tab}>
          <div className="card">
            <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="row">
                <Photo variant="alt3" style={THUMB_STYLE} glyph="⚽" />
                <div>
                  <b>Mirpur Sports City · Pitch 3</b>
                  <div className="subtle small">
                    Sat 19 Jul · 10:00–11:30 PM · Ref TC-47512
                  </div>
                  <div className="row-wrap" style={{ marginTop: 4 }}>
                    <span className="badge gray">Cancelled by you</span>
                    <span className="badge blue">Refunded ৳2,200 → bKash</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => showToast("Refund receipt downloaded 🧾")}
              >
                Refund receipt
              </Button>
            </div>
          </div>
        </TabPanel>
      </main>

      {/* Reschedule sheet */}
      <Overlay
        isOpen={reschedule.isOpen}
        onClose={reschedule.close}
        mode="sheet"
        hideHeader
        showGrabber
        title="Reschedule booking"
      >
        <h3>Reschedule · ShuttleZone Court 1</h3>
        <p className="subtle small">
          Free reschedule until 24h before. Pick a new slot:
        </p>
        <div style={{ margin: "12px 0" }}>
          <DateStrip
            dates={RESCHEDULE_DATES}
            selectedId={rescheduleDate}
            onSelect={(date) => setRescheduleDate(date.id)}
            label="Choose a new date"
          />
        </div>
        <SlotGrid
          slots={RESCHEDULE_SLOTS}
          selectedId={rescheduleSlot}
          onSelect={(slot) => setRescheduleSlot(slot.id)}
          label="Choose a new slot"
        />
        <div className="row" style={{ marginTop: 16 }}>
          <Button variant="tertiary" onClick={reschedule.close}>
            Keep current slot
          </Button>
          <Button
            variant="primary"
            block
            onClick={() => {
              reschedule.close();
              showToast(
                "Rescheduled to Sun 10 Aug, 8:00 PM ✓ (undo available for 30s)",
              );
            }}
          >
            Confirm reschedule
          </Button>
        </div>
      </Overlay>
    </>
  );
}
