import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Field, Input, Select } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { PageTitle } from '@/components/common/PageTitle';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

import { useApi } from '@/hooks/useApi';
import { getOwnerPromotions, createPromotion, updatePromotion, deletePromotion } from '@/api/ownerPromotions';
import { listMyVenues } from '@/api/ownerVenues';

export default function PromotionsPage() {
  const { showToast } = useToast();
  const drawer = useDisclosure(false);

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: venuesRes } = useApi(listMyVenues, []);
  const venues = venuesRes?.data || venuesRes || [];
  const activeVenueId = venues[0]?.id;

  const getPromosCb = useCallback(() => {
    if (!activeVenueId) return Promise.resolve([]);
    return getOwnerPromotions(activeVenueId);
  }, [activeVenueId]);

  const { data: res, loading, refetch } = useApi(getPromosCb, [activeVenueId]);
  const promotions = res?.data || res || [];

  const handleLaunch = async () => {
    if (!activeVenueId) return;
    
    if (!code || !label || !discountValue) {
      showToast('Please fill out all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await createPromotion(activeVenueId, {
        code,
        label,
        discountType,
        discountValue: Number(discountValue),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null
      });
      
      showToast('Promotion live — discounted slots now shown to players ✓');
      drawer.close();
      
      // Reset form
      setCode('');
      setLabel('');
      setDiscountValue('');
      setUsageLimit('');
      setValidFrom('');
      setValidUntil('');
      
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to create promotion';
      showToast(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (promoId, currentActive) => {
    if (!activeVenueId) return;
    try {
      await updatePromotion(activeVenueId, promoId, { active: !currentActive });
      showToast(!currentActive ? 'Promotion activated ✓' : 'Promotion paused ✓');
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update promotion status';
      showToast(`Error: ${msg}`);
    }
  };

  const handleDelete = async (promoId) => {
    if (!activeVenueId) return;
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    
    try {
      await deletePromotion(activeVenueId, promoId);
      showToast('Promotion deleted ✓');
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete promotion';
      showToast(`Error: ${msg}`);
    }
  };

  return (
    <>
      <PageTitle title="Promotions" />

      <div className="main-header">
        <div>
          <h1>Promotions</h1>
          <span className="subtle small">Fill empty slots and reward loyal teams</span>
        </div>
        <Button variant="primary" onClick={drawer.open}>
          + New promotion
        </Button>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {promotions.map((promo) => (
            <div className="card" key={promo.id} style={{ borderLeft: `3px solid ${promo.active ? 'var(--brand)' : 'var(--muted)'}` }}>
              <div className="between">
                <h3 style={{ margin: 0 }}>{promo.label}</h3>
                <Badge tone={promo.active ? 'green' : 'gray'}>{promo.active ? 'Active' : 'Paused'}</Badge>
              </div>
              <p className="subtle small" style={{ margin: '4px 0 10px' }}>
                Code: <strong>{promo.code}</strong>
              </p>
              
              <div className="grid3" style={{ gap: 8 }}>
                <div className="panel center">
                  <b className="num">
                    {promo.discountType === 'PERCENT' ? `${promo.discountValue}%` : `৳${promo.discountValue}`}
                  </b>
                  <div className="tiny subtle">Discount</div>
                </div>
                <div className="panel center">
                  <b className="num">{promo.usageCount}</b>
                  <div className="tiny subtle">Times used</div>
                </div>
                <div className="panel center">
                  <b className="num">{promo.usageLimit ? promo.usageLimit : '∞'}</b>
                  <div className="tiny subtle">Usage limit</div>
                </div>
              </div>
              
              <div className="row" style={{ marginTop: 10 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleToggle(promo.id, promo.active)}
                >
                  {promo.active ? 'Pause' : 'Activate'}
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => handleDelete(promo.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!loading && promotions.length === 0 && (
            <div className="card center subtle" style={{ padding: '48px 24px' }}>
              No promotions active yet. Create one to fill empty slots!
            </div>
          )}
          {loading && (
            <div className="card center subtle" style={{ padding: '48px 24px' }}>
              Loading promotions...
            </div>
          )}
        </div>

        <div className="glass glass-card">
          <h3>💡 Suggested for you</h3>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="panel">
              <b className="small">Tue–Wed 2–4 PM is 71% empty</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                A 25–35% off-peak discount typically fills 60% of these slots.
              </p>
              <Button size="sm" variant="primary" onClick={() => {
                  setLabel('Off-Peak Deal');
                  setCode('OFFPEAK30');
                  setDiscountType('PERCENT');
                  setDiscountValue('30');
                  drawer.open();
              }}>
                Create off-peak promo
              </Button>
            </div>
            <div className="panel">
              <b className="small">3 regulars near loyalty milestone</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                Rafiul K. (9/10), Karim Traders (15 visits), Tanvir A. (8 visits).
              </p>
              <Button size="sm" to={paths.owner.customers}>
                Review customers
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New promotion drawer */}
      <Overlay isOpen={drawer.isOpen} onClose={drawer.close} title="New promotion" mode="drawer">
        <Field label="Label (e.g. Weekday Off-Peak)" htmlFor="npLabel">
          <Input id="npLabel" value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        
        <Field label="Promo Code (e.g. OFFPEAK30)" htmlFor="npCode">
          <Input id="npCode" value={code} onChange={(event) => setCode(event.target.value)} style={{textTransform: 'uppercase'}} />
        </Field>
        
        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Discount" htmlFor="npDisc">
            <div className="row">
              <Select
                id="npDisc"
                style={{ maxWidth: 100 }}
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value)}
              >
                <option value="PERCENT">%</option>
                <option value="FLAT">৳ fixed</option>
              </Select>
              <Input
                className="num"
                aria-label="Discount amount"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Usage cap (optional)" htmlFor="npCap">
            <Input
              className="num"
              id="npCap"
              placeholder="e.g. 40 bookings"
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
            />
          </Field>
        </div>

        <div className="grid2" style={{ gap: 10 }}>
          <Field label="Valid From (optional)" htmlFor="npValidFrom">
            <Input
              type="datetime-local"
              id="npValidFrom"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </Field>
          <Field label="Valid Until (optional)" htmlFor="npValidUntil">
            <Input
              type="datetime-local"
              id="npValidUntil"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </Field>
        </div>
        
        <Button
          variant="primary"
          size="lg"
          block
          style={{ marginTop: 12 }}
          onClick={handleLaunch}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Launching...' : 'Launch promotion'}
        </Button>
      </Overlay>
    </>
  );
}
