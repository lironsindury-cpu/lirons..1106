import { AreaType, Coordinates, StreetSegment } from '../types/parking.types';
import { polylineMidpoint } from '../utils/geo.utils';
import { TTLCache } from '../utils/cache.utils';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const EXCLUDED_HIGHWAY_TYPES = 'motorway|footway|cycleway|steps|path|pedestrian';
const USER_AGENT = 'SmartParkingApp/1.0 (contact@example.com)';

// Public Overpass instances throttle aggressively and often reject
// concurrent requests from the same client outright. Street geometry and
// zoning tags for a given area barely change day to day, so a longer TTL
// than geocoding is safe here and meaningfully cuts request volume.
const STREET_DATA_CACHE_TTL_MS = 30 * 60 * 1000;
const streetDataCache = new TTLCache<StreetSegment[]>(STREET_DATA_CACHE_TTL_MS);

// Round to ~11m precision so requests for effectively the same destination
// (e.g. re-searching, or two users near the same address) share a cache
// entry instead of missing on floating-point noise.
const CACHE_COORDINATE_PRECISION = 4;

function buildCacheKey(center: Coordinates, radiusMeters: number): string {
  const lat = center.latitude.toFixed(CACHE_COORDINATE_PRECISION);
  const lon = center.longitude.toFixed(CACHE_COORDINATE_PRECISION);
  return `${lat},${lon},${radiusMeters}`;
}

export class StreetDataError extends Error {}

interface OverpassGeometryPoint {
  lat: number;
  lon: number;
}

interface OverpassWayElement {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
}

interface OverpassResponse {
  elements: OverpassWayElement[];
}

function classifyAreaType(tags: Record<string, string> | undefined): AreaType {
  const landUse = tags?.landuse;
  const shop = tags?.shop;
  const amenity = tags?.amenity;
  const office = tags?.office;

  if (landUse === 'commercial' || landUse === 'retail' || shop || amenity === 'marketplace' || office) {
    return 'commercial';
  }

  if (landUse === 'residential') {
    return 'residential';
  }

  return 'mixed';
}

function buildOverpassQuery(center: Coordinates, radiusMeters: number): string {
  return `
    [out:json][timeout:25];
    way(around:${radiusMeters},${center.latitude},${center.longitude})
      ["highway"]["highway"!~"^(${EXCLUDED_HIGHWAY_TYPES})$"];
    out body geom;
  `;
}

function dedupeStreetsByName(streets: StreetSegment[]): StreetSegment[] {
  const seen = new Map<string, StreetSegment>();
  for (const street of streets) {
    if (!seen.has(street.name)) {
      seen.set(street.name, street);
    }
  }
  return Array.from(seen.values());
}

export async function fetchNearbyStreets(
  center: Coordinates,
  radiusMeters: number
): Promise<StreetSegment[]> {
  const cacheKey = buildCacheKey(center, radiusMeters);

  return streetDataCache.getOrSet(cacheKey, async () => {
    const query = buildOverpassQuery(center, radiusMeters);

    // TEMPORARY DEBUG LOG — remove once the Overpass 406 is diagnosed.
    console.log('--- Overpass query being sent ---\n' + query + '\n--- end query ---');

    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new StreetDataError(`Overpass API request failed with status ${response.status}`);
    }

    const data = (await response.json()) as OverpassResponse;

    const streets: StreetSegment[] = data.elements
      .filter((el) => el.type === 'way' && el.geometry && el.geometry.length > 1)
      .map((way) => {
        const coordinates: Coordinates[] = way.geometry!.map((point) => ({
          latitude: point.lat,
          longitude: point.lon,
        }));

        return {
          id: `way-${way.id}`,
          name: way.tags?.name ?? `Unnamed street ${way.id}`,
          areaType: classifyAreaType(way.tags),
          coordinates,
          midpoint: polylineMidpoint(coordinates),
        };
      });

    return dedupeStreetsByName(streets);
  });
}
