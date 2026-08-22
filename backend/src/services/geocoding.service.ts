import { Coordinates, GeocodingResult } from '../types/parking.types';
import { TTLCache } from '../utils/cache.utils';

const GOOGLE_GEOCODING_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

// Addresses rarely resolve to different coordinates within a short window;
// repeated lookups of the same destination are extremely common in this app
// (users re-searching), so a 10 minute TTL absorbs that traffic and keeps
// billed Google Geocoding requests down.
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const geocodeCache = new TTLCache<GeocodingResult>(GEOCODE_CACHE_TTL_MS);

export class GeocodingError extends Error {}

interface GoogleGeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GoogleGeocodingResponse {
  results: GoogleGeocodingResult[];
  status: string;
  error_message?: string;
}

function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase();
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    throw new GeocodingError('GOOGLE_GEOCODING_API_KEY environment variable is not set');
  }
  return apiKey;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const cacheKey = normalizeAddressKey(address);

  return geocodeCache.getOrSet(cacheKey, async () => {
    const url = new URL(GOOGLE_GEOCODING_ENDPOINT);
    url.searchParams.set('address', address);
    url.searchParams.set('key', getApiKey());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new GeocodingError(`Geocoding request failed with status ${response.status}`);
    }

    const data = (await response.json()) as GoogleGeocodingResponse;

    if (data.status === 'ZERO_RESULTS') {
      throw new GeocodingError(`No coordinates found for address: ${address}`);
    }

    if (data.status !== 'OK') {
      throw new GeocodingError(
        `Geocoding request failed with status ${data.status}${data.error_message ? `: ${data.error_message}` : ''}`
      );
    }

    const [top] = data.results;
    const coordinates: Coordinates = {
      latitude: top.geometry.location.lat,
      longitude: top.geometry.location.lng,
    };

    if (Number.isNaN(coordinates.latitude) || Number.isNaN(coordinates.longitude)) {
      throw new GeocodingError(`Invalid coordinates returned for address: ${address}`);
    }

    return { address: top.formatted_address, coordinates };
  });
}
