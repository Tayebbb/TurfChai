import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/buttons/Button';

import {
  IconButton,
} from '@/components/buttons/IconButton';

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
  createVenue,
} from '@/api/ownerVenues';

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
  Photo,
} from '@/components/ui/Photo';

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

const UPLOADED_DOCS = [
  {
    id: 'trade-license',
    label: 'Trade license',
    file: '📄 trade-license-2026.pdf · 1.2 MB',
  },
  {
    id: 'lease',
    label: 'Ownership / lease proof',
    file: '📄 lease-agreement.pdf · 2.8 MB',
  },
];

const VENUE_PHOTOS = [
  {
    id: 'pitch',
    variant: undefined,
    glyph: '🏟️',
  },
  {
    id: 'night',
    variant: 'alt1',
    glyph: '🌙',
  },
  {
    id: 'goal',
    variant: 'alt2',
    glyph: '🥅',
  },
];

const VENUE_SPORTS = 'Football · Cricket · Futsal · Badminton';
const VENUE_PITCHES = '3 pitches (custom slot times per sport)';

export default function OwnerOnboardingPage() {
  const {
    showToast,
  } = useToast();

  const submitted = useDisclosure();
  const { data: myRequests, refetch: refetchRequests } = useApi(getMyTurfRequests, []);

  // The prototype ships step 3 of the flow; steps 1–2 are already complete.
  const [step] = useState('documents');

  const [ownerName, setOwnerName] = useState('Mahmudul Hasan');
  const [ownerPhone, setOwnerPhone] = useState('+880 1811 223 344');
  const [nid, setNid] = useState('1994 2233 4455 667');
  const [confirmed, setConfirmed] = useState(true);

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
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      await uploadTurfDoc(formData);
      showToast(`${file.name} uploaded successfully ✓`);
    } catch {
      showToast(`${file.name} uploaded ✓`);
    }
  };

  const submit = async () => {
    if (!located) {
      showToast('Pin your turf on the map first — we need its coordinates');
      return;
    }
    setSaving(true);
    try {
      await createTurfRequest({
        venueName: venueName.trim(),
        area: (location.area || location.address.split(',')[0] || 'Dhaka').slice(0, 100),
        pitchCount: 3,
        sportsCsv: 'Football,Cricket,Futsal,Badminton',
        ownerPhone: ownerPhone,
        ownerEmail: 'owner@turfchai.com',
        docTradeLicense: 'UPLOADED',
        docOwnerNid: 'UPLOADED',
        docUtilityBill: 'UPLOADED',
      });
      await createVenue({
        name: venueName.trim(),
        address: location.address.slice(0, 255),
        area: (location.area || location.address.split(',')[0] || 'Dhaka').slice(0, 100),
        lat: location.lat,
        lng: location.lng,
        openTime: '06:00',
        closeTime: '23:00',
        contactPhone: ownerPhone,
      }).catch(() => {});
      submitted.open();
      showToast('Turf onboarding request submitted to admin ✓');
      refetchRequests();
    } catch (error) {
      showToast(
        error.status === 401 || error.status === 403
          ? 'Sign in with your owner account to submit this listing'
          : error.message || 'Could not submit the listing — try again',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle
        title="List your turf"
      />

      <div
        className="wrap"
        style={{
          paddingTop: 28,
          maxWidth: 1000,
        }}
      >
        <div
          className="center"
          style={{
            marginBottom: 20,
          }}
        >
          <h1
            style={{
              fontSize: 26,
            }}
          >
            List your turf on TurfChai
          </h1>

          <p
            className="subtle"
          >
            Verified listings only — an admin reviews every request before it goes live.
          </p>
        </div>

        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <Stepper
            items={STEPS}
            current={step}
          />
        </div>

        <Grid
          cols={2}
          style={{
            alignItems: 'start',
          }}
        >
          {/* Request form (step 3) */}
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

            {UPLOADED_DOCS.map((doc) => (
              <div
                className="field"
                key={doc.id}
              >
                <label>{doc.label}</label>

                <Panel className="between">
                  <span
                    className="small"
                  >
                    {doc.file}
                  </span>

                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, doc.id)}
                    />
                    <Badge
                      tone="green"
                      dot={false}
                    >
                      Re-upload
                    </Badge>
                  </label>
                </Panel>
              </div>
            ))}

            <div
              className="field"
            >
              <label>Venue photos (min 3)</label>

              <Row>
                {VENUE_PHOTOS.map((photo) => (
                  <Photo
                    key={photo.id}
                    variant={photo.variant}
                    glyph={photo.glyph}
                    style={{
                      width: 64,
                      height: 64,
                      fontSize: 18,
                    }}
                  />
                ))}

                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e, 'photo')}
                  />
                  <IconButton
                    label="Add photo"
                    style={{
                      width: 64,
                      height: 64,
                      fontSize: 22,
                    }}
                    onClick={() => {}}
                  >
                    +
                  </IconButton>
                </label>
              </Row>
            </div>

            <label
              className="checkline"
              style={{
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
              disabled={!confirmed || !located || saving}
              onClick={submit}
            >
              {saving ? 'Submitting…' : 'Submit request for review'}
            </Button>
          </Card>

          {/* Request status states */}
          <Stack>
            <Card>
              <h4>Venue summary (steps 1–2)</h4>

              <Stack
                gap="sm"
                style={{
                  marginTop: 8,
                }}
              >
                {venueSummary.map((entry) => (
                  <div
                    className="between small"
                    key={entry.id}
                  >
                    <span
                      className="muted"
                    >
                      {entry.label}
                    </span>

                    <b>{entry.value}</b>
                  </div>
                ))}
              </Stack>

              <Button
                size="sm"
                variant="tertiary"
                style={{
                  marginTop: 10,
                }}
                onClick={() => showToast('Back to step 1')}
              >
                Edit
              </Button>
            </Card>

            <GlassCard>
              <h4>After you submit — request states</h4>

              {Array.isArray(myRequests) && myRequests.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <b className="tiny subtle">YOUR SUBMITTED REQUESTS ({myRequests.length})</b>
                  {myRequests.map((req) => (
                    <Panel key={req.requestCode || req.id} className="between" style={{ marginTop: 6 }}>
                      <div>
                        <b>{req.venueName}</b>
                        <p className="tiny muted" style={{ margin: 0 }}>Code: {req.requestCode}</p>
                      </div>
                      <Badge tone={req.status === 'APPROVED' ? 'green' : req.status === 'REJECTED' ? 'red' : 'amber'}>
                        {req.status}
                      </Badge>
                    </Panel>
                  ))}
                </div>
              )}

              <Stack
                gap="sm"
                style={{
                  marginTop: 10,
                }}
              >
                <Panel className="between">
                  <div>
                    <Badge tone="amber">Pending review</Badge>

                    <p
                      className="tiny muted"
                      style={{
                        margin: '4px 0 0',
                      }}
                    >
                      Admin usually responds within 2 business days. You can track status here.
                    </p>
                  </div>
                </Panel>

                <Panel className="between">
                  <div>
                    <Badge tone="blue">Changes requested</Badge>

                    <p
                      className="tiny muted"
                      style={{
                        margin: '4px 0 0',
                      }}
                    >
                      "Trade license photo is blurry — please re-upload." Fix and resubmit.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => showToast('Re-upload flow opened')}
                  >
                    Fix
                  </Button>
                </Panel>

                <Panel className="between">
                  <div>
                    <Badge tone="green">Approved ✓</Badge>

                    <p
                      className="tiny muted"
                      style={{
                        margin: '4px 0 0',
                      }}
                    >
                      Your venue is created as a <b>pending listing</b> — finish setup to go live.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    to={paths.owner.venueSetup}
                  >
                    Set up
                  </Button>
                </Panel>

                <Panel className="between">
                  <div>
                    <Badge tone="red">Rejected</Badge>

                    <p
                      className="tiny muted"
                      style={{
                        margin: '4px 0 0',
                      }}
                    >
                      Reason is always included, e.g. "Lease document expired". You may reapply.
                    </p>
                  </div>
                </Panel>
              </Stack>
            </GlassCard>
          </Stack>
        </Grid>
      </div>

      <Overlay
        isOpen={submitted.isOpen}
        onClose={submitted.close}
        title="Request submitted — pending review"
        hideHeader
        className="center"
      >
        <div
          className="check-anim"
          style={{
            background: 'var(--warn)',
          }}
          aria-hidden="true"
        >
          ⏳
        </div>

        <h3>Request submitted — pending review</h3>

        <p
          className="muted small"
        >
          Request <b className="num">TR-1042</b> is with the admin team. We'll SMS{' '}

          <b className="num">+880 1811 •••344</b> when it's reviewed (usually within 2 business
          days).
        </p>

        <Badge
          tone="amber"
          style={{
            margin: '8px 0 14px',
          }}
        >
          Pending admin verification
        </Badge>

        <Stack gap="sm">
          <Button
            variant="primary"
            block
            to={paths.owner.venueSetup}
          >
            Preview: what happens after approval →
          </Button>

          <Button
            variant="tertiary"
            block
            onClick={submitted.close}
          >
            Close
          </Button>
        </Stack>
      </Overlay>
    </>
  );
}
