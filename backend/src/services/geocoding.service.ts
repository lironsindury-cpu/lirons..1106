import { Coordinates, GeocodingResult } from '../types/parking.types';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SmartParkingApp/1.0 (contact@example.com)';

export class GeocodingError extends Error {}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
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
}
