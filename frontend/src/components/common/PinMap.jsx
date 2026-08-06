import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DHAKA = [23.78, 90.39];

/**
 * Map with a single draggable pin. Dragging it or clicking the map reports the
 * new coordinates, which is how an owner nails the exact gate of their turf
 * when the geocoded address only gets them to the right road.
 */
export default function PinMap({ lat, lng, onPick, className, style }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pickRef = useRef(onPick);

  useEffect(() => {
    pickRef.current = onPick;
  });

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
    map.setView(DHAKA, 12);

    const marker = L.marker(DHAKA, {
      draggable: true,
      keyboard: true,
      autoPan: true,
      icon: L.divIcon({ className: 'pin-map-icon', html: '<span class="pin-map-pin"></span>', iconSize: null }),
    }).addTo(map);
    marker.on('dragend', () => {
      const { lat: pinLat, lng: pinLng } = marker.getLatLng();
      pickRef.current?.(pinLat, pinLng);
    });
    map.on('click', (event) => pickRef.current?.(event.latlng.lat, event.latlng.lng));

    // The container is 0-sized on first paint inside a lazy chunk.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
    map.invalidateSize();
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={className ? `pin-map ${className}` : 'pin-map'}
      style={style}
      role="application"
      aria-label="Drag the pin to your turf's exact location"
    />
  );
}
