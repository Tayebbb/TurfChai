# coding: utf-8
import sys
import re

with open('d:/DSI/TurfChai/frontend/src/pages/owner/OwnerOnboardingPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update STEPS
code = code.replace(
'''const STEPS = [
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
];''', 
'''const STEPS = [
  { id: 'owner', label: 'Owner Details' },
  { id: 'venue', label: 'Venue Info' },
  { id: 'docs', label: 'Documents' },
  { id: 'review', label: 'Review & Submit' },
];'''
)

# 2. Change initial step
code = code.replace("useState('business')", "useState('owner')")
code = code.replace("setStep('business')", "setStep('owner')")

# 3. Add Next step logic inside OwnerOnboardingPage right before return
next_logic = '''
  const nextToVenue = () => {
    if (!ownerName.trim()) return showToast('Owner full name is required');
    if (!ownerPhone.trim()) return showToast('Owner phone number is required');
    if (!nid.trim()) return showToast('NID number is required');
    setStep('venue');
  };

  const nextToDocs = () => {
    if (!venueName.trim()) return showToast('Venue name is required');
    if (!location.address?.trim()) return showToast('Exact turf location address is required');
    if (!location.lat || !location.lng) return showToast('Please pick the exact location on the map');
    setStep('docs');
  };

  const nextToReview = () => {
    if (!documents.tradeLicense) return showToast('Trade License document is required');
    if (!documents.leaseProof) return showToast('Ownership / Lease Proof is required');
    if (photos.length < 3) return showToast('A minimum of 3 venue photos are required');
    setStep('review');
  };

  return (
'''
code = code.replace("  return (", next_logic, 1)

# 4. Remove validations from submit since they are in next functions now?
# Actually, keep them in submit for extra safety, but we need to update the Stepper component
code = code.replace("current={step}", "current={step === 'submit' ? 'review' : step}")

# 5. Now replace the giant Grid logic.
pattern = r'\) : \(\s*/\* Multi-step Form View \*/\s*<Grid[\s\S]*?</Grid>\s*\)'
new_render = ''') : (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {step === 'owner' && (
              <Card>
                <h3>Step 1 - Owner Details</h3>
                <p className="subtle small" style={{ marginBottom: 12 }}>
                  Provide your business and personal details.
                </p>
                <Field label="Owner full name" htmlFor="on1">
                  <Input id="on1" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </Field>
                <Field label="Owner phone" htmlFor="on2">
                  <Input id="on2" className="num" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                </Field>
                <Field label="NID number" htmlFor="on3">
                  <Input id="on3" className="num" value={nid} onChange={(e) => setNid(e.target.value)} />
                </Field>
                <Button block onClick={nextToVenue} style={{ marginTop: 20 }}>Next Step -></Button>
              </Card>
            )}

            {step === 'venue' && (
              <Card>
                <h3>Step 2 - Turf location</h3>
                <p className="subtle small" style={{ marginBottom: 12 }}>
                  Players navigate to this point, and it is what we use to pull match-day weather.
                </p>
                <Field label="Venue name" htmlFor="on0">
                  <Input id="on0" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
                </Field>
                <LocationPicker value={location} onChange={setLocation} label="Exact turf location" />
                <div className="row" style={{ marginTop: 24, gap: 12 }}>
                  <Button variant="secondary" onClick={() => setStep('owner')}><- Back</Button>
                  <Button block onClick={nextToDocs}>Next Step -></Button>
                </div>
              </Card>
            )}

            {step === 'docs' && (
              <Card>
                <h3>Step 3 - Verification documents</h3>
                <p className="subtle small" style={{ marginBottom: 12 }}>
                  These are reviewed by the TurfChai admin team and never shown publicly.
                </p>

                <div className="field" style={{ marginTop: 12 }}>
                  <label>Trade License</label>
                  <Panel className="between" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                    {documents.tradeLicense ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>[doc]</span>
                        <div>
                          <b style={{ color: 'var(--text-1)' }}>{documents.tradeLicense.name}</b>
                          <span className="tiny muted" style={{ display: 'block' }}>{documents.tradeLicense.size} - Uploaded ?</span>
                        </div>
                      </div>
                    ) : (
                      <span className="small muted">No trade license document attached yet</span>
                    )}
                    <label style={{ cursor: 'pointer', margin: 0 }}>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'tradeLicense')} />
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
                        <span style={{ fontSize: 18 }}>[doc]</span>
                        <div>
                          <b style={{ color: 'var(--text-1)' }}>{documents.leaseProof.name}</b>
                          <span className="tiny muted" style={{ display: 'block' }}>{documents.leaseProof.size} - Uploaded ?</span>
                        </div>
                      </div>
                    ) : (
                      <span className="small muted">No ownership or lease agreement attached yet</span>
                    )}
                    <label style={{ cursor: 'pointer', margin: 0 }}>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'leaseProof')} />
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
                      <div key={photo.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-soft)', background: 'rgba(0,0,0,0.3)' }}>
                        <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => handleRemovePhoto(photo.id)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: '18px', textAlign: 'center', padding: 0 }} title="Remove photo">x</button>
                      </div>
                    ))}
                    <label style={{ cursor: 'pointer', margin: 0 }}>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                      <div style={{ width: 72, height: 72, borderRadius: 12, border: '2px dashed var(--brand-600)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(34, 197, 94, 0.06)', color: 'var(--brand-600)', fontWeight: 700, fontSize: 11, gap: 2 }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Upload
                      </div>
                    </label>
                  </Row>
                </div>

                <div className="row" style={{ marginTop: 24, gap: 12 }}>
                  <Button variant="secondary" onClick={() => setStep('venue')}><- Back</Button>
                  <Button block onClick={nextToReview}>Next Step -></Button>
                </div>
              </Card>
            )}

            {step === 'review' && (
              <Card>
                <h3>Step 4 - Final Review</h3>
                <p className="subtle small" style={{ marginBottom: 12 }}>
                  Please review your details before submitting.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid var(--border-soft)', marginBottom: 16 }}>
                  <Stack gap="sm">
                    <div className="between small"><span className="muted">Owner Name</span><b>{ownerName}</b></div>
                    <div className="between small"><span className="muted">Venue Name</span><b>{venueName}</b></div>
                    <div className="between small"><span className="muted">Location</span><b>{location.address}</b></div>
                    <div className="between small"><span className="muted">Documents</span><b>Attached ?</b></div>
                  </Stack>
                </div>

                <label className="checkline" style={{ marginTop: 16, marginBottom: 14 }}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span>
                    I confirm the information is accurate and I accept the <a href="#owner-terms">Owner Terms</a> and 6% platform commission.
                  </span>
                </label>

                <div className="row" style={{ marginTop: 24, gap: 12 }}>
                  <Button variant="secondary" onClick={() => setStep('docs')}><- Back</Button>
                  <Button variant="primary" block disabled={!confirmed || saving} onClick={submit}>
                    {saving ? 'Submitting...' : 'Submit request for review'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )'''

new_code = re.sub(pattern, new_render, code)

with open('d:/DSI/TurfChai/frontend/src/pages/owner/OwnerOnboardingPage.jsx', 'w', encoding='utf-8') as f:
    f.write(new_code)
