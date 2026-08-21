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
import { getOwnerPromotions, createPromotion, deletePromotion, updatePromotion } from '@/api/ownerPromotions';
import { listMyVenues, resolveActiveVenue } from '@/api/ownerVenues';
import { toUserMessage } from '@/utils/errorMessage';

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
  /** Set while the drawer is editing an existing promotion rather than creating one. */
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { data: venuesRes } = useApi(listMyVenues, []);
  const venues = Array.isArray(venuesRes) ? venuesRes : (Array.isArray(venuesRes?.data) ? venuesRes.data : []);
  const activeVenueId = resolveActiveVenue(venues);

  const getPromosCb = useCallback(() => {
    if (!activeVenueId) return Promise.resolve([]);
    return getOwnerPromotions(activeVenueId);
  }, [activeVenueId]);

  const { data: res, loading, reload } = useApi(getPromosCb, [activeVenueId]);
  const promotions = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

  const handleLaunch = async () => {
    if (!activeVenueId) return;

    if (!code || !label || !discountValue) {
      showToast('Please fill out all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        label,
        discountType,
        discountValue: Number(discountValue),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      };
      if (editingId) {
        // The code is printed on campaigns, so the server does not allow it to move.
        await updatePromotion(activeVenueId, editingId, payload);
        showToast('Promotion updated ✓');
      } else {
        await createPromotion(activeVenueId, { code, ...payload });
        showToast('Promotion live — discounted slots now shown to players ✓');
      }
      drawer.close();
      resetForm();
      reload();
    } catch (err) {
      showToast(toUserMessage(err, editingId ? 'Failed to update promotion' : 'Failed to create promotion'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setLabel('');
    setDiscountType('PERCENT');
    setDiscountValue('');
    setUsageLimit('');
    setValidFrom('');
    setValidUntil('');
  };

  /** Datetime-local wants 'YYYY-MM-DDTHH:mm'; the API returns an ISO instant. */
  const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

  const openCreate = () => {
    resetForm();
    drawer.open();
  };

  const openEdit = (promo) => {
    setEditingId(promo.id);
    setCode(promo.code ?? '');
    setLabel(promo.label ?? '');
    setDiscountType(promo.discountType ?? 'PERCENT');
    setDiscountValue(String(promo.discountValue ?? ''));
    setUsageLimit(promo.usageLimit != null ? String(promo.usageLimit) : '');
    setValidFrom(toLocalInput(promo.validFrom));
    setValidUntil(toLocalInput(promo.validUntil));
    drawer.open();
  };

  const togglePaused = async (promo) => {
    if (!activeVenueId || busyId) return;
    setBusyId(promo.id);
    try {
      await updatePromotion(activeVenueId, promo.id, { active: !promo.active });
    } catch (err) {
      showToast(toUserMessage(err, 'Could not update this promotion.'));
      return;
    } finally {
      setBusyId(null);
    }
    reload();
    showToast(promo.active ? 'Promotion paused — the code no longer applies' : 'Promotion resumed ✓');
  };

  const handleDelete = async (promoId) => {
    if (!activeVenueId) return;
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    
    try {
      await deletePromotion(activeVenueId, promoId);
      showToast('Promotion deleted ✓');
      reload();
    } catch (err) {
      const msg = err.message || 'Failed to delete promotion';
      showToast(`Error: ${msg}`);
    }
  };

  const getRemainingDays = (validUntil) => {
    if (!validUntil) return 'No expiry';
    const diff = new Date(validUntil).getTime() - new Date().getTime();
    if (diff <= 0) return 'Expired';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <PageTitle title="Promotions" />

      <div className="main-header">
        <div>
          <h1>Promotions</h1>
          <span className="subtle small">Fill empty slots and reward loyal teams</span>
        </div>
        <Button variant="primary" onClick={openCreate}>
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

              <div className="grid3" style={{ gap: 8, marginTop: 8 }}>
                <div className="panel center">
                  <b className="small" style={{ fontSize: '0.85em' }}>{formatDate(promo.validFrom)}</b>
                  <div className="tiny subtle">Start Date</div>
                </div>
                <div className="panel center">
                  <b className="small" style={{ fontSize: '0.85em' }}>{formatDate(promo.validUntil)}</b>
                  <div className="tiny subtle">End Date</div>
                </div>
                <div className="panel center">
                  <b className="small" style={{ fontSize: '0.85em' }}>{getRemainingDays(promo.validUntil)}</b>
                  <div className="tiny subtle">Remaining</div>
                </div>
              </div>
              
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => openEdit(promo)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={promo.active ? 'secondary' : 'primary'}
                  disabled={busyId === promo.id}
                  onClick={() => togglePaused(promo)}
                >
                  {busyId === promo.id ? 'Saving…' : promo.active ? 'Pause' : 'Resume'}
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
          <h3>Quick starts</h3>
          <p className="tiny muted" style={{ marginTop: 2 }}>
            Templates you can edit before launching. TurfChai does not analyse your empty slots
            yet, so these are starting points rather than recommendations.
          </p>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            <div className="panel">
              <b className="small">Off-peak discount</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                A percentage off to move quieter weekday hours.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  resetForm();
                  setLabel('Off-Peak Deal');
                  setCode('OFFPEAK30');
                  setDiscountType('PERCENT');
                  setDiscountValue('30');
                  drawer.open();
                }}
              >
                Start off-peak promo
              </Button>
            </div>
            <div className="panel">
              <b className="small">Your customers</b>
              <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                See who books most often and how reliable they are.
              </p>
              <Button size="sm" to={paths.owner.customers}>
                Review customers
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Promotion drawer — create or edit */}
      <Overlay
        isOpen={drawer.isOpen}
        onClose={() => {
          drawer.close();
          resetForm();
        }}
        title={editingId ? 'Edit promotion' : 'New promotion'}
        mode="drawer"
      >
        <Field label="Label (e.g. Weekday Off-Peak)" htmlFor="npLabel">
          <Input id="npLabel" value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>

        <Field
          label="Promo Code (e.g. OFFPEAK30)"
          htmlFor="npCode"
          hint={editingId ? 'The code cannot be changed once players have it.' : undefined}
        >
          <Input
            id="npCode"
            value={code}
            disabled={Boolean(editingId)}
            onChange={(event) => setCode(event.target.value)}
            style={{ textTransform: 'uppercase' }}
          />
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
          {isSubmitting ? 'Saving…' : editingId ? 'Save changes' : 'Launch promotion'}
        </Button>
      </Overlay>
    </>
  );
}
