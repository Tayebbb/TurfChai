import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/buttons/Button';
import { reverseGeocode, searchPlaces } from '@/api/geocode';
import './LocationPicker.css';

const PinMap = lazy(() => import('./PinMap'));

const PinIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/**
 * Resolves a turf's exact spot to coordinates: search an address, drop on the
 * device's position, then drag the pin to the gate. `onChange` receives
 * `{ address, area, lat, lng }` — lat/lng are what downstream services
 * (distance search, weather) need.
 */
export function LocationPicker({ value, onChange, label = 'Turf location' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const hasPoint = Number.isFinite(value?.lat) && Number.isFinite(value?.lng);

  const runSearch = async (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 3) {
      setStatus('Type at least 3 characters of the address.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStatus(null);
    try {
      const places = await searchPlaces(term, { signal: controller.signal });
      setResults(places);
      if (places.length === 0) setStatus('No match — try the road and area, or drop the pin manually.');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('Could not reach the address service.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (place) => {
    setResults([]);
    setQuery(place.label);
    onChange({ address: place.address, area: place.area, lat: place.lat, lng: place.lng });
  };

  /** Pin moves keep the coordinates authoritative and refresh the address text. */
  const movePin = async (lat, lng) => {
    onChange({ ...value, lat, lng });
    try {
      const place = await reverseGeocode(lat, lng);
      if (place) {
        setQuery(place.label);
        onChange({ address: place.address, area: place.area, lat, lng });
      }
    } catch {
      /* the coordinates are already captured; the label is a nicety */
    }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setStatus('This browser cannot share a location.');
      return;
    }
    setBusy(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy(false);
        movePin(Number(coords.latitude.toFixed(6)), Number(coords.longitude.toFixed(6)));
      },
      (error) => {
        setBusy(false);
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? 'Location blocked — allow access, or search the address instead.'
            : 'Could not read your location.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="locpick">
      <label className="locpick-label" htmlFor="locpick-search">
        {label}
      </label>

      <form className="locpick-search" onSubmit={runSearch}>
        <input
          id="locpick-search"
          type="search"
          value={query}
          placeholder="House 12, Road 27, Dhanmondi"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>

      <button type="button" className="locpick-here" onClick={useDeviceLocation} disabled={busy}>
        {PinIcon}
        Use my current location
      </button>

      {results.length > 0 ? (
        <ul className="locpick-results">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => choose(place)}>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {status ? (
        <p className="locpick-status" role="status">
          {status}
        </p>
      ) : null}

      <Suspense fallback={<div className="pin-map locpick-map-loading" aria-hidden="true" />}>
        <PinMap lat={value?.lat} lng={value?.lng} onPick={movePin} className="locpick-map" />
      </Suspense>

      <p className="locpick-hint">Drag the pin to the exact gate — that point is what players navigate to.</p>

      <div className="locpick-coords" aria-live="polite">
        {hasPoint ? (
          <>
            <span>
              <b>Latitude</b>
              <code>{value.lat.toFixed(6)}</code>
            </span>
            <span>
              <b>Longitude</b>
              <code>{value.lng.toFixed(6)}</code>
            </span>
          </>
        ) : (
          <span className="locpick-coords-empty">No coordinates yet — search an address or drop the pin.</span>
        )}
      </div>
    </div>
  );
}
