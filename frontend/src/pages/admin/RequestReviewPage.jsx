import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './RequestReviewPage.css';

const MOCK_REQUEST_DATA = {
  'TR-1042': {
    id: 'TR-1042',
    venueName: 'Kick Off Arena',
    ownerName: 'Mahmudul Hasan',
    phone: '+880 1811 344 123',
    email: 'mahmudul@kickoff.com',
    area: 'Dhanmondi',
    pitches: 3,
    submittedDate: 'Aug 04, 2026',
    status: 'Pending Review',
    statusTone: 'amber',
    docs: {
      tradeLicense: 'Verified',
      ownerNid: 'Verified',
      utilityBill: 'Verified',
    },
  },
};

export default function RequestReviewPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const rejectModal = useDisclosure(false);
  const changesModal = useDisclosure(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changesNote, setChangesNote] = useState('');

  const request = MOCK_REQUEST_DATA[requestId] || {
    id: requestId || 'TR-1042',
    venueName: 'Kick Off Arena',
    ownerName: 'Mahmudul Hasan',
    phone: '+880 1811 344 123',
    email: 'mahmudul@kickoff.com',
    area: 'Dhanmondi',
    pitches: 3,
    submittedDate: 'Aug 04, 2026',
    status: 'Pending Review',
    statusTone: 'amber',
    docs: {
      tradeLicense: 'Verified',
      ownerNid: 'Verified',
      utilityBill: 'Verified',
    },
  };

  const handleApprove = () => {
    showToast(`Request ${request.id} for ${request.venueName} approved! Venue is now live ✓`);
    navigate(paths.admin.turfRequests);
  };

  const handleConfirmReject = () => {
    rejectModal.close();
    showToast(`Request ${request.id} rejected. Reason logged in audit file.`);
    navigate(paths.admin.turfRequests);
  };

  const handleConfirmChanges = () => {
    changesModal.close();
    showToast(`Requested changes sent to ${request.ownerName}. Status updated ✓`);
    navigate(paths.admin.turfRequests);
  };

  return (
    <>
      <PageTitle title={`Review Request ${request.id}`} />

      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Link
              className="btn btn-sm btn-tertiary"
              to={paths.admin.turfRequests}
              style={{ padding: '4px 10px', fontWeight: 700 }}
            >
              ← Back to Requests
            </Link>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              Review Submission: {request.venueName} ({request.id})
            </h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Submitted by {request.ownerName} on {request.submittedDate}
          </span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-primary" type="button" onClick={handleApprove}>
            ✓ Approve Request
          </button>
          <button className="btn btn-secondary" type="button" onClick={changesModal.open}>
            Request Changes
          </button>
          <button className="btn btn-ghost-danger" type="button" onClick={rejectModal.open}>
            Reject Request
          </button>
        </div>
      </div>

      <div
        className="admin-stack-mobile"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 24,
          marginBottom: 28,
        }}
      >
        {/* Left Column - Submission Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
              Venue Information
            </h3>
            <div className="stack-sm" style={{ gap: 12 }}>
              <div className="between">
                <span className="subtle small">Venue Name</span>
                <b>{request.venueName}</b>
              </div>
              <div className="between">
                <span className="subtle small">Area / Location</span>
                <span>{request.area}</span>
              </div>
              <div className="between">
                <span className="subtle small">Number of Pitches</span>
                <span className="num font-semibold">{request.pitches} Pitches</span>
              </div>
              <div className="between">
                <span className="subtle small">Status</span>
                <span className={`badge ${request.statusTone}`}>{request.status}</span>
              </div>
            </div>
          </div>

          <div className="liquid-glass" style={{ padding: 24, borderRadius: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
              Submitted Verification Documents
            </h3>
            <div className="stack-sm" style={{ gap: 12 }}>
              <div className="between" style={{ alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Trade License</b>
                  <span className="subtle tiny">Registration proof</span>
                </div>
                <span className="badge green nodot">{request.docs.tradeLicense}</span>
              </div>
              <div className="between" style={{ alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Owner National ID</b>
                  <span className="subtle tiny">Identity verification</span>
                </div>
                <span className="badge green nodot">{request.docs.ownerNid}</span>
              </div>
              <div className="between" style={{ alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Commercial Utility Bill</b>
                  <span className="subtle tiny">Address verification</span>
                </div>
                <span className="badge green nodot">{request.docs.utilityBill}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Owner Profile */}
        <div className="liquid-glass" style={{ padding: 24, borderRadius: 20, height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
            Owner Contact Details
          </h3>
          <div className="stack-sm" style={{ gap: 12 }}>
            <div>
              <span className="subtle tiny" style={{ display: 'block' }}>
                OWNER NAME
              </span>
              <b style={{ fontSize: 15 }}>{request.ownerName}</b>
            </div>
            <div>
              <span className="subtle tiny" style={{ display: 'block' }}>
                PHONE NUMBER
              </span>
              <span className="num font-semibold">{request.phone}</span>
            </div>
            <div>
              <span className="subtle tiny" style={{ display: 'block' }}>
                EMAIL ADDRESS
              </span>
              <span>{request.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      <Overlay
        isOpen={rejectModal.isOpen}
        onClose={rejectModal.close}
        title="Reject Listing Request?"
        hideHeader
      >
        <div className="fail-anim" aria-hidden="true">
          !
        </div>
        <h3 className="center" style={{ marginBottom: 8 }}>
          Reject Listing Request?
        </h3>
        <p className="muted small center" style={{ marginBottom: 12 }}>
          The owner will be notified of the rejection.
        </p>
        <div className="field">
          <label htmlFor="rejectReason">Rejection Reason</label>
          <input
            className="input"
            id="rejectReason"
            placeholder="e.g. Expired Trade License"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
        <div className="stack-sm" style={{ marginTop: 14 }}>
          <button className="btn btn-danger btn-block" type="button" onClick={handleConfirmReject}>
            Confirm Rejection
          </button>
          <button className="btn btn-tertiary btn-block" type="button" onClick={rejectModal.close}>
            Cancel
          </button>
        </div>
      </Overlay>

      {/* Request Changes Modal */}
      <Overlay
        isOpen={changesModal.isOpen}
        onClose={changesModal.close}
        title="Request Document Changes"
        hideHeader
      >
        <h3 className="center" style={{ marginBottom: 8 }}>
          Request Changes
        </h3>
        <p className="muted small center" style={{ marginBottom: 12 }}>
          Specify what documents or details need update from the venue owner.
        </p>
        <div className="field">
          <label htmlFor="changesNote">Instruction Note</label>
          <textarea
            className="input"
            id="changesNote"
            rows={3}
            placeholder="e.g. Please upload a clearer photo of your National ID..."
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
          />
        </div>
        <div className="stack-sm" style={{ marginTop: 14 }}>
          <button className="btn btn-primary btn-block" type="button" onClick={handleConfirmChanges}>
            Send Request to Owner
          </button>
          <button className="btn btn-tertiary btn-block" type="button" onClick={changesModal.close}>
            Cancel
          </button>
        </div>
      </Overlay>
    </>
  );
}
