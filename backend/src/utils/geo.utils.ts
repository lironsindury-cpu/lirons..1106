import { Coordinates } from '../types/parking.types';

const EARTH_RADIUS_METERS = 6371000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function polylineMidpoint(points: Coordinates[]): Coordinates {
  const latitude = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const longitude = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
  return { latitude, longitude };
}

export function minDistanceToPolyline(point: Coordinates, line: Coordinates[]): number {
  let min = Infinity;
  for (const vertex of line) {
    const distance = haversineDistanceMeters(point, vertex);
    if (distance < min) {
      min = distance;
    }
  }
  return min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
