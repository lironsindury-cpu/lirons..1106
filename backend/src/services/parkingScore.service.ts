import { Coordinates, ParkingFacility, ParkingPotential, ScoredParkingFacility } from '../types/parking.types';
import { clamp, haversineDistanceMeters } from '../utils/geo.utils';

const HIGH_POTENTIAL_THRESHOLD = 66;
const MEDIUM_POTENTIAL_THRESHOLD = 33;

function classifyPotential(score: number): ParkingPotential {
  if (score >= HIGH_POTENTIAL_THRESHOLD) return 'high';
  if (score >= MEDIUM_POTENTIAL_THRESHOLD) return 'medium';
  return 'low';
}

// With real, named parking facilities from Google Places (rather than
// heuristically-inferred street availability), the only signal available
// per result is proximity to the destination — Places' Nearby Search
// doesn't expose live occupancy. Score is purely distance-based: closer to
// the destination scores higher, scaled against the search radius.
export function scoreParkingFacility(
  facility: ParkingFacility,
  destination: Coordinates,
  radiusMeters: number
): ScoredParkingFacility {
  const distanceMeters = haversineDistanceMeters(destination, facility.location);
  const score = clamp((1 - distanceMeters / radiusMeters) * 100, 0, 100);

  return {
    ...facility,
    distanceMeters: Math.round(distanceMeters),
    score: Math.round(score),
    potential: classifyPotential(score),
  };
}

export function scoreParkingFacilities(
  facilities: ParkingFacility[],
  destination: Coordinates,
  radiusMeters: number
): ScoredParkingFacility[] {
  return facilities
    .filter((facility) => haversineDistanceMeters(destination, facility.location) <= radiusMeters)
    .map((facility) => scoreParkingFacility(facility, destination, radiusMeters))
    .sort((a, b) => b.score - a.score);
}
