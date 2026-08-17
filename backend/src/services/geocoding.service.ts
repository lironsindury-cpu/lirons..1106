import { Coordinates, GeocodingResult } from '../types/parking.types';
import { TTLCache } from '../utils/cache.utils';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SmartParkingApp/1.0 (contact@example.com)';

// Nominatim's usage policy caps unauthenticated clients at ~1 req/sec;
// repeated lookups of the same address are extremely common in this app
// (users re-searching a destination), so a 10 minute TTL absorbs that
// traffic without ever serving stale-enough-to-matter coordinates.
const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const geocodeCache = new TTLCache<GeocodingResult>(GEOCODE_CACHE_TTL_MS);

export class GeocodingError extends Error {}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase();
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const cacheKey = normalizeAddressKey(address);

  return geocodeCache.getOrSet(cacheKey, async () => {
    const url = new URL(NOMINATIM_ENDPOINT);
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new GeocodingError(`Geocoding request failed with status ${response.status}`);
    }

    const results = (await response.json()) as NominatimResult[];

    if (results.length === 0) {
      throw new GeocodingError(`No coordinates found for address: ${address}`);
    }

    const [top] = results;
    const coordinates: Coordinates = {
      latitude: parseFloat(top.lat),
      longitude: parseFloat(top.lon),
    };

    if (Number.isNaN(coordinates.latitude) || Number.isNaN(coordinates.longitude)) {
      throw new GeocodingError(`Invalid coordinates returned for address: ${address}`);
    }

    return { address: top.display_name, coordinates };
  });
}
