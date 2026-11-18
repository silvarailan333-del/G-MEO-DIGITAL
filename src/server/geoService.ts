// Real multi-source Geographic, Market, Routes, IBGE, OSM & Climate Intelligence Service
// Uses Google Maps Platform REST APIs (Places API New, Geocoding, Routes API v2) + IBGE + OSM Overpass + Open-Meteo + INMET

export const GMP_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export class MapsQuotaExceededError extends Error {
  status = 429;
  quotaExceeded = true;
  constructor(message = 'Google Maps Platform quota exceeded.') {
    super(message);
    this.name = 'MapsQuotaExceededError';
  }
}

export function getMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

export interface ApiUsageEvent {
  provider:
    | 'google_places'
    | 'google_geocoding'
    | 'google_routes'
    | 'osm_overpass'
    | 'ibge'
    | 'open_meteo'
    | 'inmet'
    | 'brasilapi';
  endpoint: string;
  cacheHit: boolean;
  statusCode: number;
}

// In-memory TTL cache (respecting GMP 30-day lat/lng policy with short operational TTLs)
const MEMORY_CACHE = new Map<string, { expiresAt: number; value: unknown }>();
const RATE_LIMIT_BUCKETS = new Map<number, number[]>();

function getCached<T>(key: string): T | null {
  const hit = MEMORY_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    MEMORY_CACHE.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached(key: string, value: unknown, ttlMs: number) {
  if (MEMORY_CACHE.size > 600) {
    const firstKey = MEMORY_CACHE.keys().next().value;
    if (firstKey) MEMORY_CACHE.delete(firstKey);
  }
  MEMORY_CACHE.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function assertCompanyGeoRateLimit(companyId: number, maxPerMinute = 40) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const stamps = (RATE_LIMIT_BUCKETS.get(companyId) || []).filter((t) => t > windowStart);
  if (stamps.length >= maxPerMinute) {
    throw new Error(
      'Limite temporário de consultas geográficas por minuto atingido. Aguarde alguns segundos antes de tentar novamente.'
    );
  }
  stamps.push(now);
  RATE_LIMIT_BUCKETS.set(companyId, stamps);
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function detectQuotaError(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  const upper = bodyText.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVER_DAILY_LIMIT') ||
    upper.includes('RATE_LIMIT_EXCEEDED')
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 11000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeStr(v: string): string {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface GeocodeResult {
  found: boolean;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
  placeId: string;
  city: string;
  state: string;
  country: string;
  granularity: string;
  source: string;
  consultedAt: string;
  cacheHit: boolean;
  errorNote?: string;
}

export async function geocodeAddressServer(
  addressQuery: string,
  onUsage?: (evt: ApiUsageEvent) => void
): Promise<GeocodeResult> {
  const clean = addressQuery.trim();
  const consultedAt = new Date().toISOString();
  if (!clean) {
    return {
      found: false,
      lat: null,
      lng: null,
      formattedAddress: '',
      placeId: '',
      city: '',
      state: '',
      country: '',
      granularity: '',
      source: 'Nenhum endereço informado',
      consultedAt,
      cacheHit: false,
      errorNote: 'Informe uma cidade, estado ou endereço válido.',
    };
  }

  const cacheKey = `geocode:${clean.toLowerCase()}`;
  const cached = getCached<GeocodeResult>(cacheKey);
  if (cached) {
    onUsage?.({ provider: 'google_geocoding', endpoint: 'geocode', cacheHit: true, statusCode: 200 });
    return { ...cached, cacheHit: true };
  }

  const apiKey = getMapsApiKey();
  if (apiKey) {
    // 1. Try Geocoding API v4
    try {
      const encoded = encodeURIComponent(clean);
      const v4Url = `https://geocode.googleapis.com/v4/geocode/address/${encoded}?languageCode=pt-BR`;
      const resp = await fetchWithTimeout(v4Url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'results.placeId,results.location,results.formattedAddress,results.postalAddress,results.granularity',
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
      });
      const raw = await resp.text();
      onUsage?.({
        provider: 'google_geocoding',
        endpoint: 'v4/geocode/address',
        cacheHit: false,
        statusCode: resp.status,
      });
      if (detectQuotaError(resp.status, raw)) {
        throw new MapsQuotaExceededError('Cota do Google Geocoding API excedida.');
      }
      if (resp.ok) {
        const parsed = JSON.parse(raw) as {
          results?: Array<{
            placeId?: string;
            location?: { latitude?: number; longitude?: number };
            formattedAddress?: string;
            granularity?: string;
            postalAddress?: {
              locality?: string;
              administrativeArea?: string;
              regionCode?: string;
            };
          }>;
        };
        const first = parsed.results?.[0];
        if (first?.location?.latitude !== undefined && first?.location?.longitude !== undefined) {
          const out: GeocodeResult = {
            found: true,
            lat: first.location.latitude,
            lng: first.location.longitude,
            formattedAddress: first.formattedAddress || clean,
            placeId: first.placeId || '',
            city: first.postalAddress?.locality || '',
            state: first.postalAddress?.administrativeArea || '',
            country: first.postalAddress?.regionCode || '',
            granularity: first.granularity || 'APPROXIMATE',
            source: 'Google Geocoding API v4',
            consultedAt,
            cacheHit: false,
          };
          setCached(cacheKey, out, 1000 * 60 * 60 * 6);
          return out;
        }
      }
    } catch (err) {
      if (err instanceof MapsQuotaExceededError) throw err;
    }

    // 2. Fallback to standard Google Geocoding REST endpoint
    try {
      const legacyUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        clean
      )}&language=pt-BR&key=${encodeURIComponent(apiKey)}`;
      const resp = await fetchWithTimeout(legacyUrl);
      const raw = await resp.text();
      onUsage?.({
        provider: 'google_geocoding',
        endpoint: 'geocode/json',
        cacheHit: false,
        statusCode: resp.status,
      });
      if (detectQuotaError(resp.status, raw)) {
        throw new MapsQuotaExceededError('Cota do Google Geocoding API excedida.');
      }
      if (resp.ok) {
        const json = JSON.parse(raw) as {
          status?: string;
          results?: Array<{
            place_id?: string;
            formatted_address?: string;
            geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
            address_components?: Array<{ short_name: string; long_name: string; types: string[] }>;
          }>;
        };
        if (json.status === 'OVER_QUERY_LIMIT') {
          throw new MapsQuotaExceededError('Cota do Google Geocoding API excedida.');
        }
        const first = json.results?.[0];
        if (first?.geometry?.location?.lat !== undefined && first?.geometry?.location?.lng !== undefined) {
          const comps = first.address_components || [];
          const findComp = (type: string) => comps.find((c) => c.types.includes(type));
          const cityComp =
            findComp('administrative_area_level_2') || findComp('locality') || findComp('sublocality');
          const stateComp = findComp('administrative_area_level_1');
          const countryComp = findComp('country');
          const out: GeocodeResult = {
            found: true,
            lat: first.geometry.location.lat,
            lng: first.geometry.location.lng,
            formattedAddress: first.formatted_address || clean,
            placeId: first.place_id || '',
            city: cityComp?.long_name || '',
            state: stateComp?.short_name || stateComp?.long_name || '',
            country: countryComp?.short_name || '',
            granularity: first.geometry.location_type || 'APPROXIMATE',
            source: 'Google Geocoding API',
            consultedAt,
            cacheHit: false,
          };
          setCached(cacheKey, out, 1000 * 60 * 60 * 6);
          return out;
        }
      }
    } catch (err) {
      if (err instanceof MapsQuotaExceededError) throw err;
    }
  }

  // 3. Open-source Nominatim secondary fallback (if GMP geocoding unavailable or unconfigured)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(
      clean
    )}`;
    const resp = await fetchWithTimeout(nomUrl, {
      headers: {
        'User-Agent': 'GemeoDigital-GeoIntelligence/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (resp.ok) {
      const list = (await resp.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
        address?: Record<string, string>;
      }>;
      const first = list?.[0];
      if (first) {
        const addr = first.address || {};
        const out: GeocodeResult = {
          found: true,
          lat: Number(first.lat),
          lng: Number(first.lon),
          formattedAddress: first.display_name || clean,
          placeId: '',
          city: addr.city || addr.town || addr.municipality || addr.village || '',
          state: addr.state || '',
          country: (addr.country_code || '').toUpperCase(),
          granularity: 'NOMINATIM',
          source: 'OpenStreetMap Nominatim (fallback)',
          consultedAt,
          cacheHit: false,
        };
        setCached(cacheKey, out, 1000 * 60 * 60 * 6);
        return out;
      }
    }
  } catch {
    // fallback exhausted
  }

  return {
    found: false,
    lat: null,
    lng: null,
    formattedAddress: clean,
    placeId: '',
    city: '',
    state: '',
    country: '',
    granularity: '',
    source: apiKey ? 'Google Geocoding / Nominatim' : 'Nominatim (Chave Maps indisponível)',
    consultedAt,
    cacheHit: false,
    errorNote: 'Endereço ou localidade não encontrado nas fontes geocodificadas.',
  };
}

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
  shortAddress: string;
  lat: number;
  lng: number;
  distanceKm: number;
  travelDistanceKm?: number | null;
  travelTimeText?: string;
  primaryType: string;
  primaryTypeLabel: string;
  types: string[];
  rating: number | null;
  userRatingCount: number;
  website: string;
  phone: string;
  priceLevel: string;
  businessStatus: string;
  openNow: boolean | null;
  openingHours: string[];
  googleMapsUri: string;
  sourceName: string;
  consultedAt: string;
}

const PRICE_LEVEL_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Gratuito',
  PRICE_LEVEL_INEXPENSIVE: 'Econômico ($)',
  PRICE_LEVEL_MODERATE: 'Intermediário ($$)',
  PRICE_LEVEL_EXPENSIVE: 'Elevado ($$$)',
  PRICE_LEVEL_VERY_EXPENSIVE: 'Premium ($$$$)',
};

const BUSINESS_STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: 'Em operação',
  CLOSED_TEMPORARILY: 'Temporariamente fechado',
  CLOSED_PERMANENTLY: 'Fechado permanentemente',
};

export async function searchPlacesServer(
  params: {
    textQuery?: string;
    includedTypes?: string[];
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    maxResults?: number;
    regionCode?: string;
  },
  onUsage?: (evt: ApiUsageEvent) => void
): Promise<{
  places: PlaceCandidate[];
  source: string;
  consultedAt: string;
  cacheHit: boolean;
  radiusLimitedNote?: string;
}> {
  const consultedAt = new Date().toISOString();
  const radiusKm = Math.min(200, Math.max(0.5, Number(params.radiusKm || 5)));
  const effectiveRadiusMeters = Math.min(50000, Math.max(500, Math.round(radiusKm * 1000)));
  const maxResults = Math.min(20, Math.max(1, Number(params.maxResults || 20)));
  const textQuery = (params.textQuery || '').trim();
  const includedTypes = (params.includedTypes || []).filter(Boolean);

  const cacheKey = `places:${textQuery.toLowerCase()}:${includedTypes.join(',')}:${params.centerLat.toFixed(
    3
  )}:${params.centerLng.toFixed(3)}:${radiusKm}`;
  const cached = getCached<{
    places: PlaceCandidate[];
    source: string;
    consultedAt: string;
    radiusLimitedNote?: string;
  }>(cacheKey);
  if (cached) {
    onUsage?.({ provider: 'google_places', endpoint: 'places:cache', cacheHit: true, statusCode: 200 });
    return { ...cached, cacheHit: true };
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    throw new Error(
      'Chave Google Maps Platform não detectada no servidor. Verifique a configuração da API.'
    );
  }

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.shortFormattedAddress',
    'places.location',
    'places.primaryType',
    'places.primaryTypeDisplayName',
    'places.types',
    'places.rating',
    'places.userRatingCount',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.regularOpeningHours',
    'places.priceLevel',
    'places.googleMapsUri',
    'places.businessStatus',
  ].join(',');

  const useTextSearch = Boolean(textQuery);
  const endpoint = useTextSearch
    ? 'https://places.googleapis.com/v1/places:searchText'
    : 'https://places.googleapis.com/v1/places:searchNearby';

  const bodyPayload = useTextSearch
    ? {
        textQuery,
        languageCode: 'pt-BR',
        ...(params.regionCode ? { regionCode: params.regionCode } : {}),
        pageSize: maxResults,
        ...(includedTypes.length === 1 ? { includedType: includedTypes[0] } : {}),
        locationBias: {
          circle: {
            center: { latitude: params.centerLat, longitude: params.centerLng },
            radius: effectiveRadiusMeters,
          },
        },
      }
    : {
        includedTypes: includedTypes.length > 0 ? includedTypes : ['store'],
        maxResultCount: maxResults,
        rankPreference: 'DISTANCE',
        languageCode: 'pt-BR',
        locationRestriction: {
          circle: {
            center: { latitude: params.centerLat, longitude: params.centerLng },
            radius: effectiveRadiusMeters,
          },
        },
      };

  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
      'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
    },
    body: JSON.stringify(bodyPayload),
  });

  const rawText = await resp.text();
  onUsage?.({
    provider: 'google_places',
    endpoint: useTextSearch ? 'places:searchText' : 'places:searchNearby',
    cacheHit: false,
    statusCode: resp.status,
  });

  if (detectQuotaError(resp.status, rawText)) {
    throw new MapsQuotaExceededError('Cota do Google Places API atingida.');
  }

  if (!resp.ok) {
    throw new Error(`Erro na Places API (${resp.status}): ${rawText.slice(0, 220)}`);
  }

  const parsed = JSON.parse(rawText) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      shortFormattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      primaryType?: string;
      primaryTypeDisplayName?: { text?: string };
      types?: string[];
      rating?: number;
      userRatingCount?: number;
      websiteUri?: string;
      nationalPhoneNumber?: string;
      priceLevel?: string;
      businessStatus?: string;
      googleMapsUri?: string;
      regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
    }>;
  };

  const placesList = (parsed.places || [])
    .filter((p) => p.location?.latitude !== undefined && p.location?.longitude !== undefined)
    .map((p): PlaceCandidate => {
      const lat = Number(p.location!.latitude);
      const lng = Number(p.location!.longitude);
      const distanceKm = haversineDistanceKm(params.centerLat, params.centerLng, lat, lng);
      return {
        placeId: p.id || '',
        name: p.displayName?.text || 'Estabelecimento sem nome',
        address: p.formattedAddress || p.shortFormattedAddress || 'Endereço não divulgado',
        shortAddress: p.shortFormattedAddress || p.formattedAddress || '',
        lat,
        lng,
        distanceKm,
        primaryType: p.primaryType || '',
        primaryTypeLabel: p.primaryTypeDisplayName?.text || p.primaryType || 'Comércio/Serviço',
        types: p.types || [],
        rating: typeof p.rating === 'number' ? p.rating : null,
        userRatingCount: Number(p.userRatingCount || 0),
        website: p.websiteUri || '',
        phone: p.nationalPhoneNumber || '',
        priceLevel: PRICE_LEVEL_LABEL[p.priceLevel || ''] || 'Não informado',
        businessStatus:
          BUSINESS_STATUS_LABEL[p.businessStatus || ''] || p.businessStatus || 'Não informado',
        openNow:
          typeof p.regularOpeningHours?.openNow === 'boolean'
            ? p.regularOpeningHours.openNow
            : null,
        openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
        googleMapsUri: p.googleMapsUri || '',
        sourceName: 'Google Places API (New)',
        consultedAt,
      };
    })
    .filter((p) => p.distanceKm <= radiusKm + 1.5)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const radiusLimitedNote =
    radiusKm > 50
      ? 'A Google Places API limita a busca circular direta a 50 km por requisição; resultados retornados dentro do raio máximo suportado ao redor do centro.'
      : undefined;

  const result = {
    places: placesList,
    source: 'Google Places API (New)',
    consultedAt,
    radiusLimitedNote,
  };
  setCached(cacheKey, result, 1000 * 60 * 20);
  return { ...result, cacheHit: false };
}

export async function getPlaceDetailsServer(
  placeId: string,
  onUsage?: (evt: ApiUsageEvent) => void
) {
  const cleanId = placeId.replace(/^places\//, '').trim();
  if (!cleanId) return null;

  const cacheKey = `placedetail:${cleanId}`;
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) {
    onUsage?.({ provider: 'google_places', endpoint: 'places:details', cacheHit: true, statusCode: 200 });
    return cached;
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) return null;

  const fieldMask =
    'id,displayName,formattedAddress,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,priceLevel,googleMapsUri,businessStatus,editorialSummary,reviews';
  const resp = await fetchWithTimeout(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}?languageCode=pt-BR`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
        'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
      },
    }
  );
  const raw = await resp.text();
  onUsage?.({
    provider: 'google_places',
    endpoint: 'places/{id}',
    cacheHit: false,
    statusCode: resp.status,
  });
  if (detectQuotaError(resp.status, raw)) {
    throw new MapsQuotaExceededError('Cota do Google Places Details atingida.');
  }
  if (!resp.ok) return null;
  const data = JSON.parse(raw) as Record<string, unknown>;
  setCached(cacheKey, data, 1000 * 60 * 60 * 6);
  return data;
}

export async function computeRouteMatrixServer(
  params: {
    originLat: number;
    originLng: number;
    destinations: Array<{ id: string; lat: number; lng: number }>;
    travelMode?: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
  },
  onUsage?: (evt: ApiUsageEvent) => void
): Promise<
  Array<{
    id: string;
    distanceKm: number;
    durationMinutes: number | null;
    durationText: string;
    source: string;
  }>
> {
  const targets = params.destinations.slice(0, 25);
  if (targets.length === 0) return [];

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return targets.map((d) => {
      const km = haversineDistanceKm(params.originLat, params.originLng, d.lat, d.lng);
      return {
        id: d.id,
        distanceKm: km,
        durationMinutes: null,
        durationText: `${km} km (linha reta)`,
        source: 'Cálculo geodésico (Routes API não configurada)',
      };
    });
  }

  try {
    const resp = await fetchWithTimeout(
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'originIndex,destinationIndex,duration,distanceMeters,status,condition',
          'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
        },
        body: JSON.stringify({
          origins: [
            {
              waypoint: {
                location: {
                  latLng: { latitude: params.originLat, longitude: params.originLng },
                },
              },
            },
          ],
          destinations: targets.map((d) => ({
            waypoint: {
              location: {
                latLng: { latitude: d.lat, longitude: d.lng },
              },
            },
          })),
          travelMode: params.travelMode || 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      }
    );
    const raw = await resp.text();
    onUsage?.({
      provider: 'google_routes',
      endpoint: 'computeRouteMatrix',
      cacheHit: false,
      statusCode: resp.status,
    });
    if (detectQuotaError(resp.status, raw)) {
      throw new MapsQuotaExceededError('Cota da Google Routes API excedida.');
    }
    if (!resp.ok) {
      throw new Error(`Routes API ${resp.status}`);
    }
    const elements = JSON.parse(raw) as Array<{
      originIndex?: number;
      destinationIndex?: number;
      distanceMeters?: number;
      duration?: string;
      condition?: string;
    }>;

    const byIndex = new Map<number, { distanceMeters?: number; duration?: string; condition?: string }>();
    for (const el of elements) {
      if (typeof el.destinationIndex === 'number') {
        byIndex.set(el.destinationIndex, el);
      }
    }

    return targets.map((d, idx) => {
      const hit = byIndex.get(idx);
      if (hit && hit.condition === 'ROUTE_EXISTS' && typeof hit.distanceMeters === 'number') {
        const km = Number((hit.distanceMeters / 1000).toFixed(2));
        const sec = Number(String(hit.duration || '0s').replace(/[^0-9.]/g, '') || 0);
        const mins = Math.max(1, Math.round(sec / 60));
        return {
          id: d.id,
          distanceKm: km,
          durationMinutes: mins,
          durationText: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins} min`,
          source: 'Google Routes API v2',
        };
      }
      const km = haversineDistanceKm(params.originLat, params.originLng, d.lat, d.lng);
      return {
        id: d.id,
        distanceKm: km,
        durationMinutes: null,
        durationText: `${km} km (geodésica)`,
        source: 'Distância geodésica (rota rodoviária indisponível)',
      };
    });
  } catch (err) {
    if (err instanceof MapsQuotaExceededError) throw err;
    return targets.map((d) => {
      const km = haversineDistanceKm(params.originLat, params.originLng, d.lat, d.lng);
      return {
        id: d.id,
        distanceKm: km,
        durationMinutes: null,
        durationText: `${km} km (geodésica)`,
        source: 'Fallback geodésico',
      };
    });
  }
}

export interface IbgeCityContext {
  status: 'ok' | 'partial' | 'unavailable';
  cityName: string;
  stateUf: string;
  ibgeCode: string | null;
  mesoregion: string;
  microregion: string;
  population: number | null;
  populationReference: string;
  pibTotalMilReais: number | null;
  pibPerCapitaReais: number | null;
  pibReference: string;
  source: string;
  note: string;
}

export async function fetchIbgeCityContext(
  cityName: string,
  stateUf: string,
  onUsage?: (evt: ApiUsageEvent) => void
): Promise<IbgeCityContext> {
  const cleanCity = cityName.trim();
  const cleanUf = stateUf.trim().toUpperCase();
  const cacheKey = `ibge:${normalizeStr(cleanCity)}:${cleanUf}`;
  const cached = getCached<IbgeCityContext>(cacheKey);
  if (cached) {
    onUsage?.({ provider: 'ibge', endpoint: 'municipios+sidra', cacheHit: true, statusCode: 200 });
    return cached;
  }

  const baseEmpty: IbgeCityContext = {
    status: 'unavailable',
    cityName: cleanCity,
    stateUf: cleanUf,
    ibgeCode: null,
    mesoregion: '',
    microregion: '',
    population: null,
    populationReference: '',
    pibTotalMilReais: null,
    pibPerCapitaReais: null,
    pibReference: '',
    source: 'IBGE Localidades & Agregados (SIDRA)',
    note: 'Cidade não localizada na base oficial do IBGE ou localidade internacional.',
  };

  if (!cleanCity) return baseEmpty;

  try {
    const munUrl =
      cleanUf.length === 2
        ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(
            cleanUf
          )}/municipios`
        : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`;

    const munResp = await fetchWithTimeout(munUrl);
    onUsage?.({ provider: 'ibge', endpoint: 'localidades/municipios', cacheHit: false, statusCode: munResp.status });
    if (!munResp.ok) return baseEmpty;

    const municipios = (await munResp.json()) as Array<{
      id: number;
      nome: string;
      microrregiao?: { nome?: string; mesorregiao?: { nome?: string; UF?: { sigla?: string } } };
    }>;

    const targetNorm = normalizeStr(cleanCity);
    const match =
      municipios.find((m) => normalizeStr(m.nome) === targetNorm) ||
      municipios.find((m) => normalizeStr(m.nome).includes(targetNorm));

    if (!match) return baseEmpty;

    const ibgeCode = String(match.id);
    const ufSigla = match.microrregiao?.mesorregiao?.UF?.sigla || cleanUf;
    const mesoregion = match.microrregiao?.mesorregiao?.nome || '';
    const microregion = match.microrregiao?.nome || '';

    // Fetch Censo 2022 Population (Agregado 4714 / Var 93) and Municipal PIB (Agregado 5938 / Var 37 & 593 or 513)
    const [popRes, pibRes, pibPcRes] = await Promise.allSettled([
      fetchWithTimeout(
        `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/-1/variaveis/93?localidades=N6[${ibgeCode}]`
      ),
      fetchWithTimeout(
        `https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/-1/variaveis/37?localidades=N6[${ibgeCode}]`
      ),
      fetchWithTimeout(
        `https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/-1/variaveis/593?localidades=N6[${ibgeCode}]`
      ),
    ]);

    let population: number | null = null;
    let populationReference = '';
    if (popRes.status === 'fulfilled' && popRes.value.ok) {
      const popJson = (await popRes.value.json()) as Array<{
        resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>;
      }>;
      const serie = popJson?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        const [period, val] = Object.entries(serie)[0] || [];
        const num = Number(val);
        if (Number.isFinite(num) && num > 0) {
          population = num;
          populationReference = `Censo IBGE ${period}`;
        }
      }
    }

    let pibTotalMilReais: number | null = null;
    let pibReference = '';
    if (pibRes.status === 'fulfilled' && pibRes.value.ok) {
      const pibJson = (await pibRes.value.json()) as Array<{
        resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>;
      }>;
      const serie = pibJson?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        const [period, val] = Object.entries(serie)[0] || [];
        const num = Number(val);
        if (Number.isFinite(num) && num > 0) {
          pibTotalMilReais = num;
          pibReference = `PIB Municipal IBGE ${period}`;
        }
      }
    }

    let pibPerCapitaReais: number | null = null;
    if (pibPcRes.status === 'fulfilled' && pibPcRes.value.ok) {
      const pcJson = (await pibPcRes.value.json()) as Array<{
        resultados?: Array<{ series?: Array<{ serie?: Record<string, string> }> }>;
      }>;
      const serie = pcJson?.[0]?.resultados?.[0]?.series?.[0]?.serie;
      if (serie) {
        const [, val] = Object.entries(serie)[0] || [];
        const num = Number(val);
        if (Number.isFinite(num) && num > 0) {
          pibPerCapitaReais = num;
        }
      }
    }

    if (!pibPerCapitaReais && pibTotalMilReais && population) {
      pibPerCapitaReais = Math.round((pibTotalMilReais * 1000) / population);
    }

    const out: IbgeCityContext = {
      status: population || pibTotalMilReais ? 'ok' : 'partial',
      cityName: match.nome,
      stateUf: ufSigla,
      ibgeCode,
      mesoregion,
      microregion,
      population,
      populationReference,
      pibTotalMilReais,
      pibPerCapitaReais,
      pibReference,
      source: 'IBGE Localidades & Agregados (Censo 2022 / PIB Municipal)',
      note:
        population || pibTotalMilReais
          ? 'Dados oficiais consultados diretamente na API pública do IBGE.'
          : 'Município localizado, porém indicadores agregados indisponíveis nesta consulta.',
    };
    setCached(cacheKey, out, 1000 * 60 * 60 * 12);
    return out;
  } catch {
    return baseEmpty;
  }
}

export interface TerritorialAnalysisResult {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  elevationMeters: number | null;
  weather: {
    status: 'ok' | 'unavailable';
    temperatureC: number | null;
    precipitationNowMm: number | null;
    windSpeedKmh: number | null;
    rain7dTotalMm: number | null;
    maxRainProbPct: number | null;
    source: string;
    consultedAt: string;
  };
  floodRisk: {
    status: 'ok' | 'unavailable';
    riverDischargeNow: number | null;
    riverDischargeMax7d: number | null;
    riverDischargeMean: number | null;
    elevatedFlowAlert: boolean;
    summary: string;
    source: string;
  };
  inmetAlerts: Array<{
    severity: string;
    description: string;
    states: string;
    startsAt: string;
    endsAt: string;
    source: string;
  }>;
  osmInfrastructure: {
    status: 'ok' | 'unavailable';
    industrialZonesCount: number;
    commercialZonesCount: number;
    highwaysCount: number;
    portsAndAirportsCount: number;
    waterwaysCount: number;
    protectedAreasCount: number;
    highlights: Array<{ category: string; name: string; tags: string }>;
    source: string;
    note: string;
  };
  limitations: string[];
  consultedAt: string;
}

export async function analyzeTerritorialEnvironment(
  params: {
    lat: number;
    lng: number;
    radiusKm: number;
    stateUf?: string;
  },
  onUsage?: (evt: ApiUsageEvent) => void
): Promise<TerritorialAnalysisResult> {
  const consultedAt = new Date().toISOString();
  const radiusKm = Math.min(25, Math.max(1, Number(params.radiusKm || 5)));
  const radiusMeters = Math.round(radiusKm * 1000);
  const cacheKey = `territorial:${params.lat.toFixed(3)}:${params.lng.toFixed(3)}:${radiusKm}:${(
    params.stateUf || ''
  ).toUpperCase()}`;
  const cached = getCached<TerritorialAnalysisResult>(cacheKey);
  if (cached) {
    onUsage?.({ provider: 'osm_overpass', endpoint: 'territorial-cache', cacheHit: true, statusCode: 200 });
    return cached;
  }

  const osmQuery = `
    [out:json][timeout:8];
    (
      way["landuse"~"industrial|commercial|retail"](around:${radiusMeters},${params.lat},${params.lng});
      way["highway"~"motorway|trunk|primary"](around:${radiusMeters},${params.lat},${params.lng});
      node["aeroway"="aerodrome"](around:${Math.min(25000, radiusMeters * 2)},${params.lat},${params.lng});
      way["aeroway"="aerodrome"](around:${Math.min(25000, radiusMeters * 2)},${params.lat},${params.lng});
      node["harbour"="yes"](around:${Math.min(25000, radiusMeters * 2)},${params.lat},${params.lng});
      way["waterway"~"river|canal"](around:${Math.min(10000, radiusMeters)},${params.lat},${params.lng});
      way["boundary"="protected_area"](around:${Math.min(15000, radiusMeters)},${params.lat},${params.lng});
    );
    out center 50;
  `;

  const fetchOsmWithMirror = async (): Promise<Response> => {
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    for (const url of endpoints) {
      try {
        const resp = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'GemeoDigital-GeoIntelligence/1.0',
            },
            body: `data=${encodeURIComponent(osmQuery)}`,
          },
          7500
        );
        if (resp.ok) return resp;
      } catch {
        // try next mirror
      }
    }
    throw new Error('All Overpass mirrors unavailable');
  };

  const [weatherRes, floodRes, elevRes, inmetRes, osmRes] = await Promise.allSettled([
    fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${params.lat}&longitude=${params.lng}&current=temperature_2m,precipitation,wind_speed_10m&daily=precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`
    ),
    fetchWithTimeout(
      `https://flood-api.open-meteo.com/v1/flood?latitude=${params.lat}&longitude=${params.lng}&daily=river_discharge,river_discharge_max,river_discharge_mean&forecast_days=7`
    ),
    fetchWithTimeout(
      `https://api.open-meteo.com/v1/elevation?latitude=${params.lat}&longitude=${params.lng}`
    ),
    fetchWithTimeout('https://apiprevmet3.inmet.gov.br/avisos/ativos', {}, 7000),
    fetchOsmWithMirror(),
  ]);

  let elevationMeters: number | null = null;
  if (elevRes.status === 'fulfilled' && elevRes.value.ok) {
    try {
      const ej = (await elevRes.value.json()) as { elevation?: number[] };
      if (typeof ej.elevation?.[0] === 'number') {
        elevationMeters = Math.round(ej.elevation[0]);
      }
    } catch {
      // ignore
    }
  }

  let weather: TerritorialAnalysisResult['weather'] = {
    status: 'unavailable',
    temperatureC: null,
    precipitationNowMm: null,
    windSpeedKmh: null,
    rain7dTotalMm: null,
    maxRainProbPct: null,
    source: 'Open-Meteo Meteorological API',
    consultedAt,
  };
  if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
    onUsage?.({ provider: 'open_meteo', endpoint: 'forecast', cacheHit: false, statusCode: 200 });
    try {
      const wj = (await weatherRes.value.json()) as {
        current?: { temperature_2m?: number; precipitation?: number; wind_speed_10m?: number };
        daily?: { precipitation_sum?: number[]; precipitation_probability_max?: number[] };
      };
      const rain7d = (wj.daily?.precipitation_sum || []).reduce((acc, v) => acc + Number(v || 0), 0);
      const maxProb = Math.max(0, ...(wj.daily?.precipitation_probability_max || [0]));
      weather = {
        status: 'ok',
        temperatureC: wj.current?.temperature_2m ?? null,
        precipitationNowMm: wj.current?.precipitation ?? null,
        windSpeedKmh: wj.current?.wind_speed_10m ?? null,
        rain7dTotalMm: Number(rain7d.toFixed(1)),
        maxRainProbPct: maxProb,
        source: 'Open-Meteo Meteorological API',
        consultedAt,
      };
    } catch {
      // ignore
    }
  }

  let floodRisk: TerritorialAnalysisResult['floodRisk'] = {
    status: 'unavailable',
    riverDischargeNow: null,
    riverDischargeMax7d: null,
    riverDischargeMean: null,
    elevatedFlowAlert: false,
    summary: 'Dados hidrológicos GloFAS indisponíveis para esta coordenada.',
    source: 'Open-Meteo GloFAS Flood API (Copernicus EFAS/GloFAS)',
  };
  if (floodRes.status === 'fulfilled' && floodRes.value.ok) {
    try {
      const fj = (await floodRes.value.json()) as {
        daily?: {
          river_discharge?: Array<number | null>;
          river_discharge_max?: Array<number | null>;
          river_discharge_mean?: Array<number | null>;
        };
      };
      const nowD = fj.daily?.river_discharge?.[0] ?? null;
      const maxArr = (fj.daily?.river_discharge_max || []).filter((v): v is number => typeof v === 'number');
      const meanArr = (fj.daily?.river_discharge_mean || []).filter((v): v is number => typeof v === 'number');
      const max7d = maxArr.length ? Number(Math.max(...maxArr).toFixed(2)) : null;
      const meanVal = meanArr.length ? Number((meanArr.reduce((a, b) => a + b, 0) / meanArr.length).toFixed(2)) : null;
      const elevated = Boolean(max7d !== null && meanVal !== null && meanVal > 0 && max7d > meanVal * 2.2);
      floodRisk = {
        status: nowD !== null || max7d !== null ? 'ok' : 'unavailable',
        riverDischargeNow: nowD !== null ? Number(nowD.toFixed(2)) : null,
        riverDischargeMax7d: max7d,
        riverDischargeMean: meanVal,
        elevatedFlowAlert: elevated,
        summary:
          nowD === null && max7d === null
            ? 'Ponto distante de grandes bacias modeladas no GloFAS; consulte mapeamento da Defesa Civil municipal.'
            : elevated
              ? `Vazão máxima prevista (7 dias: ${max7d} m³/s) acima de 2,2× da média sazonal (${meanVal} m³/s) — recomenda atenção operacional.`
              : `Vazão hidrológica prevista dentro da faixa média modelada (máx. 7d: ${max7d ?? 'N/A'} m³/s).`,
        source: 'Open-Meteo GloFAS Flood API (Copernicus)',
      };
    } catch {
      // ignore
    }
  }

  const inmetAlerts: TerritorialAnalysisResult['inmetAlerts'] = [];
  if (inmetRes.status === 'fulfilled' && inmetRes.value.ok) {
    onUsage?.({ provider: 'inmet', endpoint: 'avisos/ativos', cacheHit: false, statusCode: 200 });
    try {
      const aj = (await inmetRes.value.json()) as {
        hoje?: Array<{
          severidade?: string;
          descricao?: string;
          estados?: string;
          data_inicio?: string;
          data_fim?: string;
        }>;
      };
      const ufUpper = (params.stateUf || '').toUpperCase().trim();
      const rows = (aj.hoje || []).filter((a) => {
        if (!ufUpper) return true;
        return String(a.estados || '').toUpperCase().includes(ufUpper);
      });
      for (const a of rows.slice(0, 5)) {
        inmetAlerts.push({
          severity: a.severidade || 'Aviso meteorológico',
          description: a.descricao || 'Alerta climático ativo',
          states: a.estados || ufUpper || 'Brasil',
          startsAt: a.data_inicio || '',
          endsAt: a.data_fim || '',
          source: 'INMET — Instituto Nacional de Meteorologia',
        });
      }
    } catch {
      // ignore
    }
  }

  let osmInfrastructure: TerritorialAnalysisResult['osmInfrastructure'] = {
    status: 'unavailable',
    industrialZonesCount: 0,
    commercialZonesCount: 0,
    highwaysCount: 0,
    portsAndAirportsCount: 0,
    waterwaysCount: 0,
    protectedAreasCount: 0,
    highlights: [],
    source: 'OpenStreetMap Overpass API',
    note: 'Consulta espacial ao OpenStreetMap indisponível ou atingiu tempo limite.',
  };

  if (osmRes.status === 'fulfilled' && osmRes.value.ok) {
    onUsage?.({ provider: 'osm_overpass', endpoint: 'interpreter', cacheHit: false, statusCode: 200 });
    try {
      const oj = (await osmRes.value.json()) as {
        elements?: Array<{
          tags?: Record<string, string>;
        }>;
      };
      const elements = oj.elements || [];
      let industrialZonesCount = 0;
      let commercialZonesCount = 0;
      let highwaysCount = 0;
      let portsAndAirportsCount = 0;
      let waterwaysCount = 0;
      let protectedAreasCount = 0;
      const highlights: Array<{ category: string; name: string; tags: string }> = [];
      const seenNames = new Set<string>();

      for (const el of elements) {
        const t = el.tags || {};
        const name = t.name || t['name:pt'] || '';
        if (t.landuse === 'industrial') {
          industrialZonesCount += 1;
          if (name && !seenNames.has(`ind:${name}`)) {
            seenNames.add(`ind:${name}`);
            highlights.push({ category: 'Zona Industrial', name, tags: 'landuse=industrial' });
          }
        } else if (t.landuse === 'commercial' || t.landuse === 'retail') {
          commercialZonesCount += 1;
          if (name && !seenNames.has(`com:${name}`)) {
            seenNames.add(`com:${name}`);
            highlights.push({ category: 'Polo Comercial', name, tags: `landuse=${t.landuse}` });
          }
        } else if (t.highway) {
          highwaysCount += 1;
          if (name && !seenNames.has(`hwy:${name}`) && highlights.length < 18) {
            seenNames.add(`hwy:${name}`);
            highlights.push({ category: 'Eixo Viário', name, tags: `highway=${t.highway}` });
          }
        } else if (t.aeroway === 'aerodrome' || t.harbour === 'yes') {
          portsAndAirportsCount += 1;
          if (name && !seenNames.has(`hub:${name}`)) {
            seenNames.add(`hub:${name}`);
            highlights.push({
              category: t.aeroway ? 'Aeroporto / Aeródromo' : 'Porto / Terminal',
              name,
              tags: t.aeroway ? 'aeroway=aerodrome' : 'harbour=yes',
            });
          }
        } else if (t.waterway) {
          waterwaysCount += 1;
          if (name && !seenNames.has(`wat:${name}`)) {
            seenNames.add(`wat:${name}`);
            highlights.push({ category: 'Curso d’água', name, tags: `waterway=${t.waterway}` });
          }
        } else if (t.boundary === 'protected_area') {
          protectedAreasCount += 1;
          if (name && !seenNames.has(`pro:${name}`)) {
            seenNames.add(`pro:${name}`);
            highlights.push({ category: 'Área Protegida', name, tags: 'boundary=protected_area' });
          }
        }
      }

      osmInfrastructure = {
        status: 'ok',
        industrialZonesCount,
        commercialZonesCount,
        highwaysCount,
        portsAndAirportsCount,
        waterwaysCount,
        protectedAreasCount,
        highlights: highlights.slice(0, 14),
        source: 'OpenStreetMap Overpass API',
        note: `Mapeamento colaborativo OSM num raio de até ${radiusKm} km. Áreas sem mapeamento comunitário completo podem subestimar infraestrutura local.`,
      };
    } catch {
      // ignore
    }
  }

  const result: TerritorialAnalysisResult = {
    centerLat: params.lat,
    centerLng: params.lng,
    radiusKm,
    elevationMeters,
    weather,
    floodRisk,
    inmetAlerts,
    osmInfrastructure,
    limitations: [
      'Dados hidrológicos (GloFAS) e de elevação refletem modelos regionais e não substituem laudos de engenharia geotécnica ou cotas de enchente da Defesa Civil local.',
      'Classificações de uso do solo (industrial/comercial) vêm do OpenStreetMap colaborativo e devem ser cruzadas com o Plano Diretor municipal.',
    ],
    consultedAt,
  };

  setCached(cacheKey, result, 1000 * 60 * 30);
  return result;
}
