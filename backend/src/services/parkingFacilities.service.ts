import { Coordinates, ParkingFacility } from '../types/parking.types';
import { TTLCache } from '../utils/cache.utils';

const GOOGLE_PLACES_NEARBY_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

// Parking facility locations are physical structures that essentially never
// move; repeated searches around the same destination are extremely common
// (users re-searching, or two users near the same address), so a 30 minute
// TTL cuts billed Places API requests without ever serving stale-enough-to-
// matter results.
const PARKING_FACILITIES_CACHE_TTL_MS = 30 * 60 * 1000;
const parkingFacilitiesCache = new TTLCache<ParkingFacility[]>(PARKING_FACILITIES_CACHE_TTL_MS);

// Round to ~11m precision so requests for effectively the same destination
// share a cache entry instead of missing on floating-point noise.
const CACHE_COORDINATE_PRECISION = 4;

export class ParkingFacilitiesError extends Error {}

interface GooglePlacesResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity?: string;
}

interface GooglePlacesResponse {
  results: GooglePlacesResult[];
  status: string;
  error_message?: string;
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new ParkingFacilitiesError('GOOGLE_MAPS_API_KEY environment variable is not set');
  }
  return apiKey;
}

function buildCacheKey(center: Coordinates, radiusMeters: number): string {
  const lat = center.latitude.toFixed(CACHE_COORDINATE_PRECISION);
  const lon = center.longitude.toFixed(CACHE_COORDINATE_PRECISION);
  return `${lat},${lon},${radiusMeters}`;
}

export async function fetchNearbyParkingFacilities(
  center: Coordinates,
  radiusMeters: number
): Promise<ParkingFacility[]> {
  const cacheKey = buildCacheKey(center, radiusMeters);

  return parkingFacilitiesCache.getOrSet(cacheKey, async () => {
    const url = new URL(GOOGLE_PLACES_NEARBY_ENDPOINT);
    url.searchParams.set('location', `${center.latitude},${center.longitude}`);
    url.searchParams.set('radius', String(radiusMeters));
    url.searchParams.set('type', 'parking');
    url.searchParams.set('key', getApiKey());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new ParkingFacilitiesError(`Places API request failed with status ${response.status}`);
    }

    const data = (await response.json()) as GooglePlacesResponse;

    if (data.status === 'ZERO_RESULTS') {
      return [];
    }

    if (data.status !== 'OK') {
      throw new ParkingFacilitiesError(
        `Places API request failed with status ${data.status}${data.error_message ? `: ${data.error_message}` : ''}`
      );
    }

    return data.results.map((place) => ({
      id: place.place_id,
      name: place.name,
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      address: place.vicinity,
    }));
  });
}
