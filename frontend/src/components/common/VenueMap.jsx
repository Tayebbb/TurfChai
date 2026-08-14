import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './VenueMap.css';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * Interactive OpenStreetMap (Leaflet) with venue price pins.
 * markers: [{ id, lat, lng, label, title, hot }] — invalid coords are skipped.
 * With multiple markers the view fits their bounds; with one it centres on it.
 */
export default function VenueMap({
  markers = [],
  centerLat = 23.78,
  centerLng = 90.39,
  zoom = 13,
  onMarkerClick,
  onMapClick,
  className,
  style,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const clickRef = useRef(onMarkerClick);
  const mapClickRef = useRef(onMapClick);

  useEffect(() => {
    clickRef.current = onMarkerClick;
    mapClickRef.current = onMapClick;
  });

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    
    map.on('click', (e) => {
      if (mapClickRef.current) {
        mapClickRef.current(e.latlng);
      }
    });
    // The container is often 0-sized on first paint (lazy chunk / route
    // transition) — recalc dimensions whenever it settles or resizes.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Value-based key so re-renders with identical pins don't rebuild the layer.
  const markersKey = useMemo(
    () =>
      JSON.stringify(
        markers.map((m) => [m.id, m.lat, m.lng, m.label ?? '', m.title ?? '', Boolean(m.hot)]),
      ),
    [markers],
  );
  const markersRef = useRef(markers);
  useEffect(() => {
    markersRef.current = markers;
  });

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    map.invalidateSize();
    layer.clearLayers();
    const points = markersRef.current.filter(
      (m) => Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)),
    );
    points.forEach((m) => {
      const icon = L.divIcon({
        className: 'venue-map-icon',
        html: `<span class="venue-map-pin${m.hot ? ' hot' : ''}">${escapeHtml(m.label ?? '•')}</span>`,
        iconSize: null,
      });
      const marker = L.marker([Number(m.lat), Number(m.lng)], {
        icon,
        title: m.title ?? '',
        keyboard: true,
      }).addTo(layer);
      if (m.title) {
        marker.bindTooltip(escapeHtml(m.title), { direction: 'top', offset: [0, -8] });
      }
      marker.on('click', () => clickRef.current?.(m));
    });

    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => [Number(p.lat), Number(p.lng)])).pad(0.2),
      );
    } else if (points.length === 1) {
      map.setView([Number(points[0].lat), Number(points[0].lng)], zoom);
    } else {
      map.setView([centerLat, centerLng], zoom);
    }
  }, [markersKey, centerLat, centerLng, zoom]);

  return (
    <div
      ref={containerRef}
      className={className ? `venue-map ${className}` : 'venue-map'}
      style={style}
      role="application"
      aria-label="Map of venues"
    />
  );
}
