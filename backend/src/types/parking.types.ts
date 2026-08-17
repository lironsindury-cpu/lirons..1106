export type AreaType = 'commercial' | 'residential' | 'mixed';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodingResult {
  address: string;
  coordinates: Coordinates;
}

export interface StreetSegment {
  id: string;
  name: string;
  areaType: AreaType;
  coordinates: Coordinates[];
  midpoint: Coordinates;
}

export type ParkingPotential = 'high' | 'medium' | 'low';

export interface ScoredStreet {
  id: string;
  name: string;
  areaType: AreaType;
  coordinates: Coordinates[];
  distanceMeters: number;
  score: number;
  potential: ParkingPotential;
  breakdown: {
    availabilityScore: number;
    proximityScore: number;
    occupancyRate: number;
  };
}

export interface ParkingPredictionResponse {
  destination: GeocodingResult;
  radiusMeters: number;
  generatedAt: string;
  streets: ScoredStreet[];
}
