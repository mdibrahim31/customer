import { DeliveryZone } from '../types/database';

/**
 * Haversine formula to calculate great-circle distance between two points in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  // Round to 2 decimal places
  return Math.round(d * 100) / 100;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Standard Ray-casting algorithm to test if a point (lat, lng) is inside a polygon
 */
export function isPointInsidePolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > lng) !== (yj > lng))
        && (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a location (lat, lng) falls within a DeliveryZone (polygon boundary or radius circle)
 */
export function isPointInZone(lat: number, lng: number, zone: DeliveryZone): boolean {
  if (!zone || zone.is_active === false) return false;

  // 1. If polygon boundary coordinates exist with >= 3 points, check polygon
  if (zone.boundary_coordinates && zone.boundary_coordinates.length >= 3) {
    if (isPointInsidePolygon(lat, lng, zone.boundary_coordinates)) {
      return true;
    }
  }

  // 2. Center & Radius check
  if (zone.center_latitude && zone.center_longitude) {
    const dist = calculateDistanceKm(lat, lng, zone.center_latitude, zone.center_longitude);
    const radius = zone.radius_km || 3.0;
    if (dist <= radius) {
      return true;
    }
  }

  return false;
}

/**
 * Find the matching zone for a given point.
 */
export function findZoneForPoint(
  lat: number, 
  lng: number, 
  zones: DeliveryZone[], 
  fallbackToClosest: boolean = true
): DeliveryZone | null {
  if (!zones || zones.length === 0) return null;
  
  const activeZones = zones.filter(z => z.is_active !== false);
  if (activeZones.length === 0) return null;

  const matchingZones = activeZones.filter(z => isPointInZone(lat, lng, z));

  if (matchingZones.length === 1) return matchingZones[0];
  if (matchingZones.length > 1) {
    // Pick the one with closest center
    matchingZones.sort((a, b) => {
      const distA = calculateDistanceKm(lat, lng, a.center_latitude, a.center_longitude);
      const distB = calculateDistanceKm(lat, lng, b.center_latitude, b.center_longitude);
      return distA - distB;
    });
    return matchingZones[0];
  }

  if (!fallbackToClosest) {
    return null;
  }

  // Fallback: if outside all configured zones, return the closest zone
  let closestZone: DeliveryZone | null = null;
  let minDistance = Infinity;
  for (const z of activeZones) {
    const dist = calculateDistanceKm(lat, lng, z.center_latitude, z.center_longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestZone = z;
    }
  }
  return closestZone;
}

/**
 * Calculate dynamic Cash-on-Delivery Delivery Fee based on distance and admin rates
 */
export function calculateDeliveryFee(
  distanceKm: number,
  baseCharge: number,
  perKmRate: number
): number {
  // If under 1km, applies base charge; each additional km adds perKmRate
  const calculated = baseCharge + Math.max(0, distanceKm - 1) * perKmRate;
  return Math.max(baseCharge, Math.round(calculated));
}

/**
 * Parses Google Maps URL or string to extract lat and lng
 */
export function parseGoogleMapsLinkOrCoords(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: Raw "lat, lng" or "lat,lng"
  const rawCoordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  if (rawCoordRegex.test(trimmed)) {
    const [latStr, lngStr] = trimmed.split(',').map(s => s.trim());
    return { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
  }

  // Pattern 2: ?q=lat,lng
  const qMatch = trimmed.match(/[?&]q=([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Pattern 3: @lat,lng
  const atMatch = trimmed.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Pattern 4: /maps/search/lat,lng
  const searchMatch = trimmed.match(/maps\/search\/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  if (searchMatch) {
    return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };
  }

  return null;
}
