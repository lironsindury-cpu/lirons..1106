import { spawn } from 'node:child_process';
import { AreaType, Coordinates, StreetSegment } from '../types/parking.types';
import { polylineMidpoint } from '../utils/geo.utils';
import { TTLCache } from '../utils/cache.utils';

// overpass-api.de (the default public instance) started rejecting requests
// with a blanket 406 in 2026 as part of an anti-scraper filter, independent
// of anything about the request shape — a widely reported, unresolved issue
// (see drolbr/Overpass-API#791). overpass.kumi.systems is a separate,
// independently-run mirror with its own infrastructure, so it isn't subject
// to that block. OVERPASS_API_URL lets ops point at yet another mirror (or
// back at overpass-api.de) without a code change.
const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';

function getOverpassEndpoint(): string {
  return process.env.OVERPASS_API_URL || DEFAULT_OVERPASS_ENDPOINT;
}

// Chained ["highway"!="x"] filters rather than a single
// ["highway"!~"^(a|b|c)$"] regex — semantically identical, but the
// regex-alternation form (caret, parens, pipes, dollar sign together)
// gets blocked with a 406 by Overpass's Apache front-end, almost
// certainly a WAF rule mistaking it for an attack pattern.
const EXCLUDED_HIGHWAY_TYPES = [
  'motorway',
  'footway',
  'cycleway',
  'steps',
  'path',
  'pedestrian',
] as const;

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
  const exclusionFilters = EXCLUDED_HIGHWAY_TYPES.map((type) => `["highway"!="${type}"]`).join('');

  return `
    [out:json][timeout:25];
    way(around:${radiusMeters},${center.latitude},${center.longitude})
      ["highway"]${exclusionFilters};
    out body geom;
  `;
}

const CURL_STATUS_DELIMITER = '\n__OVERPASS_HTTP_STATUS__:';

// Posts via curl (spawned as a subprocess) rather than fetch/node:https so
// the request goes out over curl's own TLS stack and default header set.
// The query is piped over stdin (curl's `data@-`) rather than passed as an
// argument, so it never touches the shell or a process argv list.
function postOverpassQuery(query: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      '--silent',
      '--show-error',
      '--request',
      'POST',
      getOverpassEndpoint(),
      '--header',
      `User-Agent: ${USER_AGENT}`,
      '--data-urlencode',
      'data@-',
      '--write-out',
      `${CURL_STATUS_DELIMITER}%{http_code}`,
    ];

    const curl = spawn('curl', args);

    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    curl.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    curl.on('error', (error) => {
      reject(new StreetDataError(`Failed to spawn curl for Overpass request: ${error.message}`));
    });

    curl.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new StreetDataError(`curl exited with code ${exitCode} calling Overpass: ${stderr.trim()}`));
        return;
      }

      const delimiterIndex = stdout.lastIndexOf(CURL_STATUS_DELIMITER);
      if (delimiterIndex === -1) {
        reject(new StreetDataError('Unexpected curl output calling Overpass: missing status marker'));
        return;
      }

      resolve({
        statusCode: Number(stdout.slice(delimiterIndex + CURL_STATUS_DELIMITER.length).trim()),
        body: stdout.slice(0, delimiterIndex),
      });
    });

    curl.stdin.write(query);
    curl.stdin.end();
  });
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

    const { statusCode, body } = await postOverpassQuery(query);

    if (statusCode !== 200) {
      // TEMPORARY DEBUG LOG — remove once the kumi.systems 500 is diagnosed.
      console.log(`--- Overpass error response body (status ${statusCode}) ---\n` + body);

      throw new StreetDataError(`Overpass API request failed with status ${statusCode}`);
    }

    const data = JSON.parse(body) as OverpassResponse;

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
