import { ParkingPredictionResponse } from '../types/parking.types';

const API_BASE_URL = 'http://localhost:4000/api';

export class ApiError extends Error {}

export async function fetchParkingPrediction(
  address: string,
  radiusMeters = 500
): Promise<ParkingPredictionResponse> {
  const url = `${API_BASE_URL}/parking-prediction?address=${encodeURIComponent(
    address
  )}&radius=${radiusMeters}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as { error?: string }));
    throw new ApiError(body.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as ParkingPredictionResponse;
}
