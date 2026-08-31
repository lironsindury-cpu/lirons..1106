export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodingResult {
  address: string;
  coordinates: Coordinates;
}

export interface ParkingFacility {
  id: string;
  name: string;
  location: Coordinates;
  address?: string;
}

export type ParkingPotential = 'high' | 'medium' | 'low';

export interface ScoredParkingFacility extends ParkingFacility {
  distanceMeters: number;
  score: number;
  potential: ParkingPotential;
}

export interface ParkingPredictionResponse {
  destination: GeocodingResult;
  radiusMeters: number;
  generatedAt: string;
  parkingFacilities: ScoredParkingFacility[];
}
