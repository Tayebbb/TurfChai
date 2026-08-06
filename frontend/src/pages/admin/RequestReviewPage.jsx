import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Overlay } from '@/components/modals/Overlay';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import './RequestReviewPage.css';

import { getTurfRequest, reviewTurfRequest } from '@/api/turfRequests';
import { useApi } from '@/hooks/useApi';

export default function RequestReviewPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const rejectModal = useDisclosure(false);
  const changesModal = useDisclosure(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changesNote, setChangesNote] = useState('');

  const { data: request, loading, error } = useApi(() => getTurfRequest(requestId), [requestId]);

  const handleApprove = async () => {
    try {
      await reviewTurfRequest(requestId, 'APPROVE');
      showToast(`Request ${requestId} approved! Venue is now live ✓`);
      navigate(paths.admin.turfRequests);
    } catch (e) {
      showToast(e.message || 'Failed to approve');
    }
  };

  const handleConfirmReject = async () => {
    try {
      await reviewTurfRequest(requestId, 'REJECT', rejectReason);
      rejectModal.close();
      showToast(`Request ${requestId} rejected. Reason logged in audit file.`);
      navigate(paths.admin.turfRequests);
    } catch (e) {
      showToast(e.message || 'Failed to reject');
    }
  };

  const handleConfirmChanges = async () => {
    try {
      await reviewTurfRequest(requestId, 'REQUEST_CHANGES', changesNote);
      changesModal.close();
      showToast(`Requested changes sent to owner. Status updated ✓`);
      navigate(paths.admin.turfRequests);
    } catch (e) {
      showToast(e.message || 'Failed to request changes');
    }
  };

  return (
    <>
      <PageTitle title={`Review Request ${requestId}`} />

      {loading && <div style={{padding:40}} className="center">Loading request...</div>}
      {error && <div style={{padding:40, color:'var(--danger)'}} className="center">{error.message || 'Error loading request'}</div>}
      
      {request && !loading && !error && (
        <>
      <div className="main-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Link
              className="btn btn-sm btn-tertiary"
              to={paths.admin.turfRequests}
              style={{ padding: '4px 10px', fontWeight: 700 }}
            >
              ← Back
            </Link>
            <h1>Review Submission: {request.venueName} ({request.requestCode})</h1>
          </div>
          <span className="subtle small" style={{ marginTop: 4, display: 'block' }}>
            Submitted on {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
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
                <span className="num font-semibold">{request.pitchCount} Pitches</span>
              </div>
              <div className="between">
                <span className="subtle small">Status</span>
                <span className={`badge ${request.status === 'APPROVED' ? 'green' : request.status === 'REJECTED' ? 'red' : 'amber'}`}>{request.status}</span>
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
                <span className={`badge nodot ${request.docTradeLicense === 'VERIFIED' ? 'green' : 'amber'}`}>{request.docTradeLicense}</span>
              </div>
              <div className="between" style={{ alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Owner National ID</b>
                  <span className="subtle tiny">Identity verification</span>
                </div>
                <span className={`badge nodot ${request.docOwnerNid === 'VERIFIED' ? 'green' : 'amber'}`}>{request.docOwnerNid}</span>
              </div>
              <div className="between" style={{ alignItems: 'center' }}>
                <div>
                  <b style={{ fontSize: 14, display: 'block' }}>Commercial Utility Bill</b>
                  <span className="subtle tiny">Address verification</span>
                </div>
                <span className={`badge nodot ${request.docUtilityBill === 'VERIFIED' ? 'green' : 'amber'}`}>{request.docUtilityBill}</span>
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
              <b style={{ fontSize: 15 }}>{request.ownerUserId} (ID)</b>
            </div>
            <div>
              <span className="subtle tiny" style={{ display: 'block' }}>
                PHONE NUMBER
              </span>
              <span className="num font-semibold">{request.ownerPhone}</span>
            </div>
            <div>
              <span className="subtle tiny" style={{ display: 'block' }}>
                EMAIL ADDRESS
              </span>
              <span>{request.ownerEmail}</span>
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
      )}
    </>
  );
}
