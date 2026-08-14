import { useState } from 'react';
import { Button } from '@/components/buttons/Button';
import { Card } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Field, Input } from '@/components/forms/Field';
import { Grid } from '@/components/layout/Primitives';
import { Overlay } from '@/components/modals/Overlay';
import VenueMap from '@/components/common/VenueMap';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { createVenue } from '@/api/ownerVenues';
import { paths } from '@/routes/paths';

export default function OwnerOnboardingPage() {
  const { showToast } = useToast();
  const submitted = useDisclosure();
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [basePrice, setBasePrice] = useState('1000');
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [lat, setLat] = useState(23.78);
  const [lng, setLng] = useState(90.39);

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

  return (
    <>
      <PageTitle title="List your turf" />
      <div className="wrap" style={{ paddingTop: 28, maxWidth: 1000 }}>
        <div className="center" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26 }}>List your turf on TurfChai</h1>
          <p className="subtle">Register your venue to get started.</p>
        </div>

        <Grid cols={2} style={{ alignItems: 'start' }}>
          <Card>
            <h3>Venue Details</h3>
            
            <Field label="Venue Name" htmlFor="v-name">
              <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kick Off Arena" />
            </Field>

            <Field label="Address" htmlFor="v-address">
              <Input id="v-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. House 12, Road 27" />
            </Field>
            
            <Field label="Area" htmlFor="v-area">
              <Input id="v-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Dhanmondi" />
            </Field>
            
            <Field label="Base Price (৳)" htmlFor="v-price">
              <Input id="v-price" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </Field>

            <div style={{ display: 'flex', gap: '16px' }}>
              <Field label="Open Time" htmlFor="v-open">
                <Input id="v-open" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </Field>
              <Field label="Close Time" htmlFor="v-close">
                <Input id="v-close" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </Field>
            </div>

            <Button variant="primary" size="lg" block onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Register Venue'}
            </Button>
          </Card>

          <Card>
            <h3>Location (Tap to pick)</h3>
            <p className="subtle small" style={{ marginBottom: 12 }}>
              Selected: {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
            <div style={{ height: 400, borderRadius: 8, overflow: 'hidden' }}>
              <VenueMap 
                markers={mapMarkers} 
                centerLat={lat} 
                centerLng={lng} 
                zoom={14} 
                onMapClick={handleMapClick} 
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </Card>
        </Grid>
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
