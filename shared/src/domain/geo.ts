export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;
/** Widen the prefilter box slightly so float error never drops a donor right at the edge. */
const BOX_MARGIN = 1.01;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (spec 5.6). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Lat/lng box that fully contains the circle of `radiusKm` around `center`.
 * Used as a cheap database prefilter before running Haversine.
 */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const r = radiusKm * BOX_MARGIN;
  const dLat = r / KM_PER_DEGREE;
  const cosLat = Math.max(Math.cos(toRad(center.lat)), 0.01);
  const dLng = r / (KM_PER_DEGREE * cosLat);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Public distances are rounded to the nearest 0.5 km so exact locations can't be inferred. */
export function roundToHalfKm(km: number): number {
  return Math.round(km * 2) / 2;
}

export function formatPublicDistance(km: number): string {
  const rounded = roundToHalfKm(km);
  return rounded < 0.5 ? "< 0.5 km" : `~${rounded} km`;
}
