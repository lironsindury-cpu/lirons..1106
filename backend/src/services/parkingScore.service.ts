import { AreaType, Coordinates, ParkingPotential, ScoredStreet, StreetSegment } from '../types/parking.types';
import { clamp, minDistanceToPolyline } from '../utils/geo.utils';

export interface TimeContext {
  hour: number;
  dayOfWeek: number;
}

const AVAILABILITY_WEIGHT = 0.65;
const PROXIMITY_WEIGHT = 0.35;

const HIGH_POTENTIAL_THRESHOLD = 66;
const MEDIUM_POTENTIAL_THRESHOLD = 33;

const MIN_OCCUPANCY_RATE = 0.05;
const MAX_OCCUPANCY_RATE = 0.97;

const BASE_OCCUPANCY_BY_AREA: Record<AreaType, number> = {
  commercial: 0.55,
  residential: 0.35,
  mixed: 0.45,
};

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function isRushHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
}

function isNightHours(hour: number): boolean {
  return hour >= 23 || hour <= 5;
}

function timeOfDayModifier(areaType: AreaType, { hour, dayOfWeek }: TimeContext): number {
  let modifier = 0;
  const weekend = isWeekend(dayOfWeek);

  if (areaType === 'commercial') {
    if (isRushHour(hour) && !weekend) modifier += 0.25;
    if (isNightHours(hour)) modifier -= 0.3;
    if (weekend && hour >= 11 && hour <= 20) modifier += 0.15;
  }

  if (areaType === 'residential') {
    if (isNightHours(hour) || (hour >= 19 && hour <= 23)) modifier += 0.25;
    if (hour >= 8 && hour <= 17 && !weekend) modifier -= 0.1;
  }

  if (areaType === 'mixed') {
    if (isRushHour(hour)) modifier += 0.1;
    if (isNightHours(hour)) modifier -= 0.1;
  }

  return modifier;
}

function proximityCongestionModifier(
  areaType: AreaType,
  distanceMeters: number,
  radiusMeters: number
): number {
  const proximityRatio = 1 - clamp(distanceMeters / radiusMeters, 0, 1);
  const congestionFactor = areaType === 'commercial' ? 0.3 : 0.15;
  return proximityRatio * congestionFactor;
}

function classifyPotential(score: number): ParkingPotential {
  if (score >= HIGH_POTENTIAL_THRESHOLD) return 'high';
  if (score >= MEDIUM_POTENTIAL_THRESHOLD) return 'medium';
  return 'low';
}

export function scoreStreet(
  street: StreetSegment,
  destination: Coordinates,
  radiusMeters: number,
  timeContext: TimeContext
): ScoredStreet {
  const distanceMeters = minDistanceToPolyline(destination, street.coordinates);

  const baseOccupancy = BASE_OCCUPANCY_BY_AREA[street.areaType];
  const timeModifier = timeOfDayModifier(street.areaType, timeContext);
  const congestionModifier = proximityCongestionModifier(street.areaType, distanceMeters, radiusMeters);

  const occupancyRate = clamp(
    baseOccupancy + timeModifier + congestionModifier,
    MIN_OCCUPANCY_RATE,
    MAX_OCCUPANCY_RATE
  );

  const availabilityScore = (1 - occupancyRate) * 100;
  const proximityScore = clamp((1 - distanceMeters / radiusMeters) * 100, 0, 100);

  const finalScore = clamp(
    availabilityScore * AVAILABILITY_WEIGHT + proximityScore * PROXIMITY_WEIGHT,
    0,
    100
  );

  return {
    id: street.id,
    name: street.name,
    areaType: street.areaType,
    coordinates: street.coordinates,
    distanceMeters: Math.round(distanceMeters),
    score: Math.round(finalScore),
    potential: classifyPotential(finalScore),
    breakdown: {
      availabilityScore: Math.round(availabilityScore),
      proximityScore: Math.round(proximityScore),
      occupancyRate: Math.round(occupancyRate * 100) / 100,
    },
  };
}

export function scoreStreets(
  streets: StreetSegment[],
  destination: Coordinates,
  radiusMeters: number,
  timeContext: TimeContext
): ScoredStreet[] {
  return streets
    .filter((street) => minDistanceToPolyline(destination, street.coordinates) <= radiusMeters)
    .map((street) => scoreStreet(street, destination, radiusMeters, timeContext))
    .sort((a, b) => b.score - a.score);
}

export function currentTimeContext(date: Date = new Date()): TimeContext {
  return { hour: date.getHours(), dayOfWeek: date.getDay() };
}
