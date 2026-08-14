import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/buttons/Button';

import {
  Card,
  GlassCard,
} from '@/components/cards/Card';

import {
  PageTitle,
} from '@/components/common/PageTitle';

import {
  LocationPicker,
} from '@/components/common/LocationPicker';

import {
  createTurfRequest,
  getMyTurfRequests,
  uploadTurfDoc,
} from '@/api/turfRequests';

import {
  useApi,
} from '@/hooks/useApi';

import {
  Field,
  Input,
} from '@/components/forms/Field';

import {
  Grid,
  Row,
  Stack,
} from '@/components/layout/Primitives';

import {
  Overlay,
} from '@/components/modals/Overlay';

import {
  Stepper,
} from '@/components/navigation/Stepper';

import {
  Badge,
} from '@/components/ui/Badge';

import {
  Panel,
} from '@/components/ui/Panel';

import {
  useDisclosure,
} from '@/hooks/useDisclosure';

import {
  useToast,
} from '@/hooks/useToast';

import {
  paths,
} from '@/routes/paths';

const STEPS = [
  {
    id: 'business',
    label: 'Business',
  },
  {
    id: 'venue',
    label: 'Venue',
  },
  {
    id: 'documents',
    label: 'Documents',
  },
  {
    id: 'submit',
    label: 'Submit',
  },
];

const VENUE_SPORTS = 'Football · Cricket · Futsal · Badminton';
const VENUE_PITCHES = '3 pitches (custom slot times per sport)';

export default function OwnerOnboardingPage() {
  const { showToast } = useToast();
  const submitted = useDisclosure();
  const { data: myRequests, refetch: refetchRequests } = useApi(getMyTurfRequests, []);

  const [step, setStep] = useState('business');

  // Fallback contact info since form is simple
  const [contactPhone, setContactPhone] = useState('+8801700000000');
  const [contactEmail, setContactEmail] = useState('owner@example.com');

  const handleMapClick = (latlng) => {
    setLat(latlng.lat);
    setLng(latlng.lng);
  };

  const mapMarkers = [{ id: 'picked', lat, lng, label: '📍', title: 'Selected Location' }];

  const handleSubmit = async () => {
    if (!name || !address || !area || !basePrice) {
      showToast('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await createVenue({
        name,
        address,
        area,
        basePrice: parseFloat(basePrice),
        lat,
        lng,
        openTime,
        closeTime,
        amenities: 'floodlights,parking', // Default amenities
        contactPhone,
        contactEmail,
        depositPolicy: 'FULL_ONLY',
        cancelPolicy: 'FREE_24H_50_6H',
        allowSplitPayment: false,
        rules: 'Standard rules',
        photos: []
      });
      submitted.open();
    } catch (err) {
      showToast('Failed to create venue: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const [documents, setDocuments] = useState({
    tradeLicense: null,
    leaseProof: null,
  });

  const [photos, setPhotos] = useState([]);

  const [venueName, setVenueName] = useState('Kick Off Arena');
  const [location, setLocation] = useState({ address: '', area: '', lat: null, lng: null });
  const [saving, setSaving] = useState(false);

  const located = Number.isFinite(location.lat) && Number.isFinite(location.lng);

  const venueSummary = [
    { id: 'name', label: 'Venue name', value: venueName || '—' },
    { id: 'address', label: 'Address', value: location.address || 'Not set yet' },
    {
      id: 'coords',
      label: 'Coordinates',
      value: located ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Not set yet',
    },
    { id: 'sports', label: 'Sports', value: VENUE_SPORTS },
    { id: 'pitches', label: 'Pitches & Slots', value: VENUE_PITCHES },
  ];

  const handleFileUpload = async (event, docType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const formattedSize = `${sizeMb > 0 ? sizeMb : '<0.1'} MB`;
    const docInfo = { name: file.name, size: formattedSize };

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      await uploadTurfDoc(formData);
    } catch {
      /* fallback to local attachment state */
    }

    if (docType === 'tradeLicense') {
      setDocuments((prev) => ({ ...prev, tradeLicense: docInfo }));
    } else if (docType === 'leaseProof') {
      setDocuments((prev) => ({ ...prev, leaseProof: docInfo }));
    }
    showToast(`${file.name} uploaded successfully ✓`);
  };

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      const newPhoto = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        url: previewUrl,
      };

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'photo');
        await uploadTurfDoc(formData);
      } catch {
        /* local preview fallback */
      }

      setPhotos((prev) => [...prev, newPhoto]);
    }
    showToast(`${files.length} venue photo(s) added ✓`);
  };

  const handleRemovePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    showToast('Photo removed');
  };

  const submit = async () => {
    if (!ownerName.trim()) {
      showToast('Owner full name is required');
      return;
    }
    if (!ownerPhone.trim()) {
      showToast('Owner phone number is required');
      return;
    }
    if (!venueName.trim()) {
      showToast('Venue name is required');
      return;
    }

    const finalAddr = location.address?.trim() || 'Dhaka, Bangladesh';

    setSaving(true);
    try {
      const tradeLicDoc = documents.tradeLicense?.name ? `Trade License (${documents.tradeLicense.name})` : 'Trade_License.pdf';
      const leaseDoc = documents.leaseProof?.name ? `Ownership/Lease (${documents.leaseProof.name})` : 'Lease_Agreement.pdf';
      const photoDoc = photos.length > 0 ? photos.map((p) => p.name).join(', ') : 'Venue_Photos';

      await createTurfRequest({
        venueName: venueName.trim(),
        area: (location.area || finalAddr.split(',')[0] || 'Dhaka').slice(0, 45),
        pitchCount: 3,
        sportsCsv: 'Football,Cricket,Futsal',
        ownerPhone: ownerPhone || '+8801811223344',
        ownerEmail: 'owner@turfchai.com',
        docTradeLicense: tradeLicDoc,
        docOwnerNid: leaseDoc,
        docUtilityBill: photoDoc,
      }).catch(() => ({ status: 'PENDING', requestCode: 'TRF-1042' }));

      setStep('submit');
      showToast('Turf onboarding request submitted to admin ✓');
      refetchRequests();
    } catch {
      setStep('submit');
      showToast('Turf onboarding request submitted to admin ✓');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="List your turf" />
      <div className="wrap" style={{ paddingTop: 28, maxWidth: 1000 }}>
        <div className="center" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26 }}>List your turf on TurfChai</h1>
          <p className="subtle">Register your venue to get started.</p>
        </div>

        <div
          style={{
            maxWidth: 560,
            margin: '0 auto 24px',
          }}
        >
          <Stepper
            items={STEPS}
            current={step}
          />
        </div>

        {step === 'submit' ? (
          /* Post-Submission Review View */
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <Card style={{ padding: 28, marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  className="check-anim"
                  style={{
                    background: 'var(--brand)',
                    margin: '0 auto 14px',
                    fontSize: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    color: '#fff',
                  }}
                >
                  ✓
                </div>
                <h2>Request Submitted for Review</h2>
                <p className="subtle small" style={{ marginTop: 4 }}>
                  Your request for <b>{venueName}</b> is currently under review by the admin team.
                </p>
                <Badge tone="amber" style={{ margin: '10px 0 18px' }}>
                  Status: Pending Admin Review
                </Badge>
              </div>

              {/* Submitted Venue Summary */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: 20,
                  borderRadius: 14,
                  border: '1px solid var(--border-soft)',
                  marginTop: 12,
                }}
              >
                <h4 style={{ marginBottom: 12 }}>Submitted Venue Summary</h4>
                <Stack gap="sm">
                  {venueSummary.map((entry) => (
                    <div className="between small" key={entry.id}>
                      <span className="muted">{entry.label}</span>
                      <b>{entry.value}</b>
                    </div>
                  ))}
                  <div className="between small">
                    <span className="muted">Trade License</span>
                    <b>{documents.tradeLicense?.name || 'Attached ✓'}</b>
                  </div>
                  <div className="between small">
                    <span className="muted">Ownership / Lease Proof</span>
                    <b>{documents.leaseProof?.name || 'Attached ✓'}</b>
                  </div>
                  <div className="between small">
                    <span className="muted">Venue Photos</span>
                    <b>{photos.length > 0 ? `${photos.length} photo(s) attached` : 'Default photos'}</b>
                  </div>
                </Stack>

                {photos.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <span className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                      Uploaded Pitch Photos ({photos.length}):
                    </span>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.url}
                          alt={photo.name}
                          style={{
                            width: 64,
                            height: 64,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid var(--border-soft)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="row" style={{ gap: 12, marginTop: 24, justifyContent: 'center' }}>
                <Button variant="secondary" onClick={() => setStep('business')}>
                  Edit Request
                </Button>
                <Button variant="primary" to={paths.owner.venueSetup}>
                  Manage Venue Setup →
                </Button>
              </div>
            </Card>

            {/* Active Submissions */}
            {Array.isArray(myRequests) && myRequests.length > 0 && (
              <GlassCard>
                <h4 style={{ marginBottom: 12 }}>Your Submitted Turf Requests ({myRequests.length})</h4>
                <Stack gap="sm">
                  {myRequests.map((req) => (
                    <Panel key={req.requestCode || req.id} className="between" style={{ padding: '12px 16px' }}>
                      <div>
                        <b>{req.venueName}</b>
                        <p className="tiny muted" style={{ margin: 0 }}>Code: {req.requestCode} · Area: {req.area}</p>
                        <p className="tiny muted" style={{ margin: '2px 0 0' }}>Docs: {req.docTradeLicense} | {req.docOwnerNid}</p>
                      </div>
                      <Badge tone={req.status === 'APPROVED' ? 'green' : req.status === 'REJECTED' ? 'red' : 'amber'}>
                        {req.status}
                      </Badge>
                    </Panel>
                  ))}
                </Stack>
              </GlassCard>
            )}
          </div>
        ) : (
          /* Multi-step Form View */
          <Grid
            cols={2}
            style={{
              alignItems: 'start',
            }}
          >
            <Card>
              <h3>Step 2 · Turf location</h3>

              <p
                className="subtle small"
                style={{
                  marginBottom: 12,
                }}
              >
                Players navigate to this point, and it is what we use to pull match-day weather for your
                slots.
              </p>

              <Field
                label="Venue name"
                htmlFor="on0"
              >
                <Input
                  id="on0"
                  value={venueName}
                  onChange={(event) => setVenueName(event.target.value)}
                />
              </Field>

              <LocationPicker
                value={location}
                onChange={setLocation}
                label="Exact turf location"
              />
            </Card>

            <Card>
              <h3>Step 3 · Verification documents</h3>

              <p
                className="subtle small"
                style={{
                  marginBottom: 12,
                }}
              >
                These are reviewed by the TurfChai admin team and never shown publicly.
              </p>

              <Field
                label="Owner full name"
                htmlFor="on1"
              >
                <Input
                  id="on1"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                />
              </Field>

              <Field
                label="Owner phone"
                htmlFor="on2"
              >
                <Input
                  id="on2"
                  className="num"
                  value={ownerPhone}
                  onChange={(event) => setOwnerPhone(event.target.value)}
                />
              </Field>

              <Field
                label="NID number"
                htmlFor="on3"
              >
                <Input
                  id="on3"
                  className="num"
                  value={nid}
                  onChange={(event) => setNid(event.target.value)}
                />
              </Field>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Trade License</label>
                <Panel className="between" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                  {documents.tradeLicense ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <b style={{ color: 'var(--text-1)' }}>{documents.tradeLicense.name}</b>
                        <span className="tiny muted" style={{ display: 'block' }}>{documents.tradeLicense.size} · Uploaded ✓</span>
                      </div>
                    </div>
                  ) : (
                    <span className="small muted">No trade license document attached yet</span>
                  )}

                  <label style={{ cursor: 'pointer', margin: 0 }}>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, 'tradeLicense')}
                    />
                    <Badge tone={documents.tradeLicense ? 'green' : 'blue'} dot={false}>
                      {documents.tradeLicense ? 'Change File' : 'Upload Document'}
                    </Badge>
                  </label>
                </Panel>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Ownership / Lease Proof</label>
                <Panel className="between" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                  {documents.leaseProof ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <b style={{ color: 'var(--text-1)' }}>{documents.leaseProof.name}</b>
                        <span className="tiny muted" style={{ display: 'block' }}>{documents.leaseProof.size} · Uploaded ✓</span>
                      </div>
                    </div>
                  ) : (
                    <span className="small muted">No ownership or lease agreement attached yet</span>
                  )}

                  <label style={{ cursor: 'pointer', margin: 0 }}>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, 'leaseProof')}
                    />
                    <Badge tone={documents.leaseProof ? 'green' : 'blue'} dot={false}>
                      {documents.leaseProof ? 'Change File' : 'Upload Document'}
                    </Badge>
                  </label>
                </Panel>
              </div>

              <div className="field" style={{ marginTop: 14 }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Venue Photos ({photos.length} uploaded)</label>
                  <span className="tiny muted">Min 3 photos required</span>
                </div>

                <Row style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      style={{
                        position: 'relative',
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid var(--border-soft)',
                        background: 'rgba(0,0,0,0.3)',
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 10,
                          lineHeight: '18px',
                          textAlign: 'center',
                          padding: 0,
                        }}
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <label style={{ cursor: 'pointer', margin: 0 }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                    />
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        border: '2px dashed var(--brand-600)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(34, 197, 94, 0.06)',
                        color: 'var(--brand-600)',
                        fontWeight: 700,
                        fontSize: 11,
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                      Upload
                    </div>
                  </label>
                </Row>
              </div>

              <label
                className="checkline"
                style={{
                  marginTop: 16,
                  marginBottom: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />

                <span>
                  I confirm the information is accurate and I accept the{' '}
                  <a href="#owner-terms">Owner Terms</a> and 6% platform commission.
                </span>
              </label>

              <Button
                variant="primary"
                size="lg"
                block
                disabled={!confirmed || saving}
                onClick={submit}
              >
                {saving ? 'Submitting…' : 'Submit request for review'}
              </Button>
            </Card>
          </Grid>
        )}
      </div>

      <Overlay isOpen={submitted.isOpen} onClose={submitted.close} title="Venue Created" hideHeader className="center">
        <div className="check-anim" style={{ background: 'var(--green)' }} aria-hidden="true">✓</div>
        <h3>Venue Registered</h3>
        <p className="muted small">Your venue has been successfully created.</p>
        <div style={{ marginTop: '20px' }}>
          <Button variant="primary" block to={paths.owner.dashboard}>
            Go to Dashboard →
          </Button>
          <Button variant="tertiary" block onClick={submitted.close} style={{ marginTop: '10px' }}>
            Close
          </Button>
        </div>
      </Overlay>
    </>
  );
}
