import { NextFunction, Request, Response } from 'express';
import { geocodeAddress } from '../services/geocoding.service';
import { fetchNearbyParkingFacilities } from '../services/parkingFacilities.service';
import { scoreParkingFacilities } from '../services/parkingScore.service';
import { ParkingPredictionResponse } from '../types/parking.types';

const DEFAULT_RADIUS_METERS = 500;
const MIN_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 2000;

function parseRadius(raw: unknown): number {
  const value = Number(raw ?? DEFAULT_RADIUS_METERS);
  if (Number.isNaN(value)) return DEFAULT_RADIUS_METERS;
  return Math.min(Math.max(value, MIN_RADIUS_METERS), MAX_RADIUS_METERS);
}

export async function getParkingPrediction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const address = String(req.query.address ?? '').trim();

    if (!address) {
      res.status(400).json({ error: 'Query parameter "address" is required' });
      return;
    }

    const radiusMeters = parseRadius(req.query.radius);

    const destination = await geocodeAddress(address);
    const facilities = await fetchNearbyParkingFacilities(destination.coordinates, radiusMeters);
    const scoredFacilities = scoreParkingFacilities(facilities, destination.coordinates, radiusMeters);

    const payload: ParkingPredictionResponse = {
      destination,
      radiusMeters,
      generatedAt: new Date().toISOString(),
      parkingFacilities: scoredFacilities,
    };

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
}
