import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  CloudRain,
  Compass,
  Download,
  ExternalLink,
  Factory,
  FileSpreadsheet,
  Filter,
  Globe,
  History,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Satellite,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Truck,
  Waves,
  X,
} from 'lucide-react';
import { EmptyEvidenceBox, KpiStatCard, PageHeader, StatusBadge } from './ui/TwinUI';
import { useBetaAuth } from '../beta/AuthContext';
import { safeExternalHref } from '../lib/safeUrl';

export interface UserCloudSqlCompanyPin {
  id: number;
  name: string;
  segment: string;
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  placeId?: string;
  isCurrent?: boolean;
}

export interface CompanyDistanceResult {
  originCompany: {
    id: number;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  radiusKm: number;
  travelMode: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
  selectedPair: {
    key: string;
    id: number;
    name: string;
    address: string;
    linearDistanceKm: number;
    routeDistanceKm: number | null;
    durationText: string;
    withinRadius: boolean;
  } | null;
  withinRadiusCount: number;
  withinRadius: Array<{
    key: string;
    kind: 'user_company' | 'saved_entity';
    entityKind: string;
    id: number;
    name: string;
    segmentOrCategory: string;
    address: string;
    lat: number;
    lng: number;
    linearDistanceKm: number;
    routeDistanceKm: number | null;
    durationText: string;
    withinRadius: boolean;
  }>;
  allCompaniesAndEntities: Array<{
    key: string;
    kind: 'user_company' | 'saved_entity';
    entityKind: string;
    id: number;
    name: string;
    segmentOrCategory: string;
    address: string;
    lat: number;
    lng: number;
    linearDistanceKm: number;
    routeDistanceKm: number | null;
    durationText: string;
    withinRadius: boolean;
  }>;
  summary: string;
  consultedAt: string;
}

export interface GeoCompanyInfo {
  id: number;
  name: string;
  segment: string;
  cnae: string;
  address: string;
  city: string;
  state: string;
  operationType: string;
  latitude?: string;
  longitude?: string;
  placeId?: string;
}

export interface GeoUnitItem {
  id: number;
  name: string;
  city: string;
  state: string;
  latitude?: string;
  longitude?: string;
  placeId?: string;
  isPrimary: boolean;
}

export interface GeoPlaceResult {
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
  classification?: 'direct' | 'indirect' | 'potential';
  classificationRationale?: string;
  competitiveThreat?: string;
}

export interface GeoSavedEntityRow {
  id: number;
  entityKind: string;
  classification: string;
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  distanceKm: string;
  travelTimeText: string;
  category: string;
  website: string;
  phone: string;
  publicRating: string;
  userRatingsTotal: number;
  priceLevel: string;
  openingHoursJson: unknown;
  sourceName: string;
  googleMapsUri: string;
  notes: string;
  lastUpdatedAt: string;
}

export interface GeoSearchLogRow {
  id: number;
  searchType: string;
  query: string;
  centerAddress: string;
  centerLat: string;
  centerLng: string;
  radiusKm: number;
  resultsCount: number;
  alertsSummary: string;
  createdAt: string;
}

interface TerritorialResult {
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

interface ExpansionLocalityBundle {
  label: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
  radiusKm: number;
  competitorsCount: number;
  avgRating: number | null;
  totalReviewsVolume: number;
  ibge: {
    status: string;
    cityName: string;
    stateUf: string;
    population: number | null;
    populationReference: string;
    pibTotalMilReais: number | null;
    pibPerCapitaReais: number | null;
    pibReference: string;
    source: string;
    note: string;
  };
  industrialZonesCount: number;
  commercialZonesCount: number;
  highwaysCount: number;
}

interface ExpansionComparisonAI {
  verdictSummary: string;
  localityEvaluations: Array<{
    label: string;
    demandVsSaturationTag: string;
    score0to100: number;
    pros: string[];
    cautions: string[];
  }>;
  confirmedData: string[];
  estimatedData: string[];
  hypotheses: string[];
  unavailableData: string[];
}

interface CompetitiveAiResult {
  classifiedPlaces: Array<{
    placeId: string;
    classification: string;
    rationale: string;
    competitiveThreat: string;
  }>;
  executiveSummary: string;
  confirmedData: string[];
  estimatedData: string[];
  hypotheses: string[];
  unavailableData: string[];
  advantageVsFragility: Array<{
    topic: string;
    ourAdvantage: string;
    competitorStrengthOrGap: string;
  }>;
  swotLocal: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

type GeoSubTab =
  | 'radar-mapa'
  | 'concorrencia-ia'
  | 'expansao'
  | 'fornecedores'
  | 'territorial'
  | 'assistente-geo'
  | 'historico';

const PRESET_RADII = [1, 5, 10, 25, 50];

interface GoogleMapsCircleInstance {
  setMap: (map: unknown | null) => void;
}

interface WindowWithGoogleMaps {
  google?: {
    maps?: {
      Circle?: new (opts: Record<string, unknown>) => GoogleMapsCircleInstance;
    };
  };
}

// Imperative Radius Circle drawn safely on the underlying Google Map instance
const RadiusCircleOverlay: React.FC<{
  center: { lat: number; lng: number } | null;
  radiusMeters: number;
  color?: string;
}> = ({ center, radiusMeters, color = '#20C5D5' }) => {
  const map = useMap();

  useEffect(() => {
    const g = (window as unknown as WindowWithGoogleMaps).google;
    if (!map || !center || !g?.maps?.Circle) {
      return;
    }
    const circle = new g.maps.Circle({
      map,
      center,
      radius: radiusMeters,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 1.5,
      fillColor: color,
      fillOpacity: 0.1,
      clickable: false,
    });
    return () => {
      circle.setMap(null);
    };
  }, [map, center, radiusMeters, color]);

  return null;
};

// Camera auto-receneter whenever target center or radius changes
const MapCameraSync: React.FC<{
  center: { lat: number; lng: number } | null;
  radiusKm: number;
}> = ({ center, radiusKm }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    const zoom =
      radiusKm <= 1.5
        ? 15
        : radiusKm <= 5
        ? 13
        : radiusKm <= 12
        ? 12
        : radiusKm <= 28
        ? 11
        : 10;
    map.setZoom(zoom);
  }, [map, center, radiusKm]);

  return null;
};

const PinMarkerWithInfo: React.FC<{
  position: { lat: number; lng: number };
  title: string;
  pinBg: string;
  pinBorder: string;
  glyphColor?: string;
  glyph?: string;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  infoContent: React.ReactNode;
}> = ({
  position,
  title,
  pinBg,
  pinBorder,
  glyphColor = '#06132D',
  glyph,
  isSelected,
  onSelect,
  onClose,
  infoContent,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker ref={markerRef} position={position} title={title} onClick={onSelect}>
        <Pin
          background={pinBg}
          borderColor={pinBorder}
          glyphColor={glyphColor}
          glyph={glyph}
        />
      </AdvancedMarker>
      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={290} onCloseClick={onClose}>
          {infoContent}
        </InfoWindow>
      )}
    </>
  );
};

export const GeoIntelligenceModule: React.FC<{
  company: GeoCompanyInfo;
  units: GeoUnitItem[];
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onWorkspaceRefresh: () => Promise<void> | void;
}> = ({ company, units, apiFetch, onWorkspaceRefresh }) => {
  const { preferences } = useBetaAuth();
  const [subTab, setSubTab] = useState<GeoSubTab>('radar-mapa');

  // Maps API configuration (env OR authenticated server config)
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [configLoaded, setConfigLoaded] = useState(false);

  // Overview state
  const [userCompanies, setUserCompanies] = useState<UserCloudSqlCompanyPin[]>([]);
  const [savedEntities, setSavedEntities] = useState<GeoSavedEntityRow[]>([]);
  const [searchLogs, setSearchLogs] = useState<GeoSearchLogRow[]>([]);
  const [usageSummary, setUsageSummary] = useState<{
    totalCalls: number;
    cacheHits: number;
    byProvider: Record<string, number>;
  }>({ totalCalls: 0, cacheHits: 0, byProvider: {} });

  // Active Map & Search Controls
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = Number(company.latitude);
    const lng = Number(company.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      ? { lat, lng }
      : null;
  });
  const [centerLabel, setCenterLabel] = useState<string>(
    [company.address, company.city, company.state].filter(Boolean).join(', ') || 'Brasil'
  );
  const [locationInput, setLocationInput] = useState<string>(
    [company.address, company.city, company.state].filter(Boolean).join(', ')
  );
  const [segmentQuery, setSegmentQuery] = useState<string>(company.segment || '');
  const [radiusKm, setRadiusKm] = useState<number>(preferences.defaultRadiusKm || 5);
  const [customRadiusInput, setCustomRadiusInput] = useState<string>(
    String(preferences.defaultRadiusKm || 5)
  );

  // Company-to-Company Distance & Radius X km (Cloud SQL)
  const [originCompanyId, setOriginCompanyId] = useState<number>(company.id);
  const [targetCompanyId, setTargetCompanyId] = useState<string>('');
  const [travelMode, setTravelMode] = useState<'DRIVE' | 'WALK' | 'TWO_WHEELER'>(
    preferences.preferredTravelMode || 'DRIVE'
  );
  const [companiesDistanceResult, setCompaniesDistanceResult] =
    useState<CompanyDistanceResult | null>(null);

  useEffect(() => {
    if (preferences.defaultRadiusKm) {
      setRadiusKm(preferences.defaultRadiusKm);
      setCustomRadiusInput(String(preferences.defaultRadiusKm));
    }
    if (preferences.preferredTravelMode) {
      setTravelMode(preferences.preferredTravelMode);
    }
  }, [preferences.defaultRadiusKm, preferences.preferredTravelMode]);

  useEffect(() => {
    setOriginCompanyId(company.id);
  }, [company.id]);

  // Layer visibility toggles
  const [showOwnUnits, setShowOwnUnits] = useState(true);
  const [showDirect, setShowDirect] = useState(true);
  const [showIndirect, setShowIndirect] = useState(true);
  const [showSuppliersLayer, setShowSuppliersLayer] = useState(true);

  // Live results & selection
  const [livePlaces, setLivePlaces] = useState<GeoPlaceResult[]>([]);
  const [supplierResults, setSupplierResults] = useState<GeoPlaceResult[]>([]);
  const [supplierQuery, setSupplierQuery] = useState<string>(
    `fornecedor distribuidor atacado ${company.segment || ''}`.trim()
  );
  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(null);
  const [dossierPlace, setDossierPlace] = useState<GeoPlaceResult | null>(null);
  const [dossierDetails, setDossierDetails] = useState<Record<string, unknown> | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // AI & Analytical states
  const [competitorAi, setCompetitorAi] = useState<CompetitiveAiResult | null>(null);
  const [territorialData, setTerritorialData] = useState<TerritorialResult | null>(null);
  const [expansionTargets, setExpansionTargets] = useState<
    Array<{ city: string; state: string; label: string }>
  >([
    { city: company.city || 'São Paulo', state: company.state || 'SP', label: 'Região Atual' },
    { city: 'Joinville', state: 'SC', label: 'Mercado Candidato B' },
    { city: 'Curitiba', state: 'PR', label: 'Mercado Candidato C' },
  ]);
  const [expansionResult, setExpansionResult] = useState<{
    localities: ExpansionLocalityBundle[];
    comparison: ExpansionComparisonAI;
    consultedAt: string;
  } | null>(null);

  // Geo AI Chat
  const [geoChatInput, setGeoChatInput] = useState('');
  const [geoChatMessages, setGeoChatMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      groundingLinks?: Array<{ title: string; uri: string; sourceType?: string }>;
    }>
  >([]);
  const [geoChatLoading, setGeoChatLoading] = useState(false);

  // Loading & Notice state
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [geoNotice, setGeoNotice] = useState<string>('');
  const [geoError, setGeoError] = useState<string>('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [searchMetaNote, setSearchMetaNote] = useState<string>('');

  const handleApiError = useCallback((err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : fallback;
    if (
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('cota') ||
      msg.includes('429')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    setGeoError(msg);
  }, []);

  const loadGeoOverview = useCallback(async () => {
    try {
      const [cfg, overview] = await Promise.all([
        apiFetch<{ mapsEnabled: boolean; browserApiKey: string }>('/api/beta/geo/config'),
        apiFetch<{
          companyLocation: {
            address: string;
            city: string;
            state: string;
            latitude: string;
            longitude: string;
          };
          userCompanies?: UserCloudSqlCompanyPin[];
          entities: GeoSavedEntityRow[];
          searchLogs: GeoSearchLogRow[];
          usageSummary: {
            totalCalls: number;
            cacheHits: number;
            byProvider: Record<string, number>;
          };
        }>(`/api/beta/companies/${company.id}/geo/overview`),
      ]);
      if (cfg.browserApiKey) {
        setMapsApiKey(cfg.browserApiKey);
      }
      setUserCompanies(overview.userCompanies || []);
      setSavedEntities(overview.entities || []);
      setSearchLogs(overview.searchLogs || []);
      setUsageSummary(overview.usageSummary || { totalCalls: 0, cacheHits: 0, byProvider: {} });

      const latNum = Number(overview.companyLocation?.latitude);
      const lngNum = Number(overview.companyLocation?.longitude);
      if (Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum !== 0 && lngNum !== 0) {
        setCenterCoords((prev) => prev || { lat: latNum, lng: lngNum });
      }
    } catch {
      // handled silently on init
    } finally {
      setConfigLoaded(true);
    }
  }, [apiFetch, company.id]);

  const handleComputeCompaniesDistance = async () => {
    setLoadingAction('companies-distance');
    setGeoError('');
    setGeoNotice('');
    try {
      const res = await apiFetch<CompanyDistanceResult>(
        `/api/beta/companies/${company.id}/geo/companies-distance`,
        {
          method: 'POST',
          body: JSON.stringify({
            originCompanyId,
            targetCompanyId: targetCompanyId ? Number(targetCompanyId) : null,
            radiusKm,
            travelMode,
            geocodeMissing: true,
          }),
        }
      );
      setCompaniesDistanceResult(res);
      setCenterCoords({ lat: res.originCompany.lat, lng: res.originCompany.lng });
      setCenterLabel(res.originCompany.formattedAddress || res.originCompany.name);
      setGeoNotice(res.summary);
      await loadGeoOverview();
    } catch (err) {
      handleApiError(err, 'Erro ao calcular distância e raio entre empresas no Cloud SQL.');
    } finally {
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    void loadGeoOverview();
  }, [loadGeoOverview]);

  // Auto-geocode company headquarters once if coordinates are missing
  useEffect(() => {
    if (!configLoaded || centerCoords) return;
    const baseAddr = [company.address, company.city, company.state].filter(Boolean).join(', ');
    if (!baseAddr) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{
          found: boolean;
          lat: number | null;
          lng: number | null;
          formattedAddress: string;
        }>(`/api/beta/companies/${company.id}/geo/geocode`, {
          method: 'POST',
          body: JSON.stringify({ address: baseAddr, saveToCompany: true }),
        });
        if (!cancelled && res.found && res.lat !== null && res.lng !== null) {
          setCenterCoords({ lat: res.lat, lng: res.lng });
          setCenterLabel(res.formattedAddress || baseAddr);
        }
      } catch {
        // leave empty cleanly
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, centerCoords, company.address, company.city, company.id, company.state, configLoaded]);

  const handleGeocodeSearch = async (targetAddress?: string, unitId?: number) => {
    const query = (targetAddress ?? locationInput).trim();
    if (!query) return;
    setLoadingAction('geocode');
    setGeoError('');
    setGeoNotice('');
    try {
      const res = await apiFetch<{
        found: boolean;
        lat: number | null;
        lng: number | null;
        formattedAddress: string;
        source: string;
        errorNote?: string;
      }>(`/api/beta/companies/${company.id}/geo/geocode`, {
        method: 'POST',
        body: JSON.stringify({
          address: query,
          saveToCompany: Boolean(unitId ? false : query === [company.address, company.city, company.state].filter(Boolean).join(', ')),
          unitId,
        }),
      });
      if (res.found && res.lat !== null && res.lng !== null) {
        setCenterCoords({ lat: res.lat, lng: res.lng });
        setCenterLabel(res.formattedAddress || query);
        setGeoNotice(`Mapa centralizado em: ${res.formattedAddress} (Fonte: ${res.source})`);
        if (unitId) await onWorkspaceRefresh();
      } else {
        setGeoError(res.errorNote || 'Não foi possível localizar esse endereço.');
      }
    } catch (err) {
      handleApiError(err, 'Erro ao geocodificar região.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSearchCompetitors = async (isMonitorRefresh = false) => {
    setLoadingAction(isMonitorRefresh ? 'monitor' : 'search');
    setGeoError('');
    setGeoNotice('');
    try {
      const res = await apiFetch<{
        center: { lat: number; lng: number; address: string };
        radiusKm: number;
        places: GeoPlaceResult[];
        source: string;
        consultedAt: string;
        cacheHit: boolean;
        radiusLimitedNote?: string;
        alertsSummary: string;
      }>(`/api/beta/companies/${company.id}/geo/search-places`, {
        method: 'POST',
        body: JSON.stringify({
          searchType: isMonitorRefresh ? 'monitor_refresh' : 'competitors',
          textQuery: segmentQuery.trim() || company.segment || company.name,
          centerAddress: locationInput.trim() || undefined,
          centerLat: centerCoords?.lat,
          centerLng: centerCoords?.lng,
          radiusKm,
          includeRoutes: true,
        }),
      });

      setCenterCoords({ lat: res.center.lat, lng: res.center.lng });
      if (res.center.address) setCenterLabel(res.center.address);
      setLivePlaces(res.places || []);
      setCompetitorAi(null);
      setSearchMetaNote(
        `Fonte: ${res.source}${res.cacheHit ? ' (cache)' : ''} · Consultado em ${new Date(
          res.consultedAt
        ).toLocaleString('pt-BR')}${res.radiusLimitedNote ? ` · ${res.radiusLimitedNote}` : ''}`
      );
      setGeoNotice(
        `${res.places.length} estabelecimento(s) encontrado(s) em até ${res.radiusKm} km. ${res.alertsSummary}`
      );
      await loadGeoOverview();
    } catch (err) {
      handleApiError(err, 'Erro ao buscar concorrentes no mapa.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSearchSuppliers = async () => {
    setLoadingAction('suppliers');
    setGeoError('');
    setGeoNotice('');
    try {
      const res = await apiFetch<{
        center: { lat: number; lng: number; address: string };
        places: GeoPlaceResult[];
        source: string;
        consultedAt: string;
        alertsSummary: string;
      }>(`/api/beta/companies/${company.id}/geo/search-places`, {
        method: 'POST',
        body: JSON.stringify({
          searchType: 'suppliers',
          textQuery:
            supplierQuery.trim() ||
            `fornecedor distribuidor atacado logística ${company.segment || ''}`,
          centerAddress: locationInput.trim() || undefined,
          centerLat: centerCoords?.lat,
          centerLng: centerCoords?.lng,
          radiusKm,
          includeRoutes: true,
        }),
      });
      setCenterCoords({ lat: res.center.lat, lng: res.center.lng });
      setSupplierResults(res.places || []);
      setGeoNotice(
        `${res.places.length} fornecedor(es)/parceiro(s) localizado(s) num raio de ${radiusKm} km.`
      );
      await loadGeoOverview();
    } catch (err) {
      handleApiError(err, 'Erro ao buscar fornecedores e parceiros.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAnalyzeCompetitorsAi = async () => {
    if (livePlaces.length === 0) {
      setGeoError('Execute primeiro uma busca de concorrentes no mapa.');
      return;
    }
    setLoadingAction('ai-comp');
    setGeoError('');
    try {
      const res = await apiFetch<{ analysis: CompetitiveAiResult }>(
        `/api/beta/companies/${company.id}/geo/competitor-intelligence`,
        {
          method: 'POST',
          body: JSON.stringify({ radiusKm, places: livePlaces }),
        }
      );
      setCompetitorAi(res.analysis);
      const classMap: Record<
        string,
        { classification: 'direct' | 'indirect' | 'potential'; rationale: string; threat: string }
      > = {};
      for (const item of res.analysis.classifiedPlaces || []) {
        const normCls =
          item.classification === 'direct' ||
          item.classification === 'indirect' ||
          item.classification === 'potential'
            ? item.classification
            : 'indirect';
        classMap[item.placeId] = {
          classification: normCls,
          rationale: item.rationale,
          threat: item.competitiveThreat,
        };
      }
      setLivePlaces((prev) =>
        prev.map((p) =>
          classMap[p.placeId]
            ? {
                ...p,
                classification: classMap[p.placeId].classification,
                classificationRationale: classMap[p.placeId].rationale,
                competitiveThreat: classMap[p.placeId].threat,
              }
            : p
        )
      );
      setGeoNotice('Classificação estratégica (Direto / Indireto / Potencial) e análise SWOT local geradas.');
    } catch (err) {
      handleApiError(err, 'Erro ao gerar análise competitiva por IA.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunTerritorialAnalysis = async () => {
    if (!centerCoords) {
      setGeoError('Defina um ponto central no mapa primeiro.');
      return;
    }
    setLoadingAction('territorial');
    setGeoError('');
    try {
      const res = await apiFetch<TerritorialResult>(
        `/api/beta/companies/${company.id}/geo/territorial-analysis`,
        {
          method: 'POST',
          body: JSON.stringify({
            lat: centerCoords.lat,
            lng: centerCoords.lng,
            radiusKm,
            stateUf: company.state,
          }),
        }
      );
      setTerritorialData(res);
      setGeoNotice('Auditoria territorial, logística, climática e hidrológica concluída.');
      await loadGeoOverview();
    } catch (err) {
      handleApiError(err, 'Erro ao executar análise territorial.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunExpansionAnalysis = async () => {
    setLoadingAction('expansion');
    setGeoError('');
    try {
      const res = await apiFetch<{
        localities: ExpansionLocalityBundle[];
        comparison: ExpansionComparisonAI;
        consultedAt: string;
      }>(`/api/beta/companies/${company.id}/geo/market-expansion`, {
        method: 'POST',
        body: JSON.stringify({
          localities: expansionTargets,
          radiusKm,
          segmentQuery: segmentQuery.trim() || company.segment || company.name,
        }),
      });
      setExpansionResult(res);
      setGeoNotice('Comparativo regional com IBGE, Places e OpenStreetMap concluído.');
      await loadGeoOverview();
    } catch (err) {
      handleApiError(err, 'Erro ao comparar regiões para expansão.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveEntity = async (
    place: GeoPlaceResult,
    entityKind: 'competitor' | 'supplier',
    syncToCompetitorsTab = false
  ) => {
    setLoadingAction(`save:${place.placeId}`);
    setGeoError('');
    try {
      await apiFetch(`/api/beta/companies/${company.id}/geo/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityKind,
          classification:
            place.classification || (entityKind === 'supplier' ? 'strategic' : 'direct'),
          placeId: place.placeId,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          distanceKm: place.distanceKm,
          travelTimeText: place.travelTimeText || '',
          category: place.primaryTypeLabel,
          website: place.website,
          phone: place.phone,
          rating: place.rating,
          userRatingsTotal: place.userRatingCount,
          priceLevel: place.priceLevel,
          openingHours: place.openingHours,
          sourceName: place.sourceName,
          googleMapsUri: place.googleMapsUri,
          syncToCompetitorsTab,
        }),
      });
      setGeoNotice(
        entityKind === 'supplier'
          ? `${place.name} salvo na lista de Fornecedores e Parceiros.`
          : `${place.name} salvo no monitoramento geográfico${
              syncToCompetitorsTab ? ' e sincronizado na aba Concorrentes.' : '.'
            }`
      );
      await loadGeoOverview();
      if (syncToCompetitorsTab) await onWorkspaceRefresh();
    } catch (err) {
      handleApiError(err, 'Erro ao salvar estabelecimento.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteEntity = async (entityId: number) => {
    try {
      await apiFetch(`/api/beta/companies/${company.id}/geo/entities/${entityId}`, {
        method: 'DELETE',
      });
      setSavedEntities((prev) => prev.filter((e) => e.id !== entityId));
    } catch (err) {
      handleApiError(err, 'Erro ao remover registro.');
    }
  };

  const handleOpenDossier = async (place: GeoPlaceResult) => {
    setDossierPlace(place);
    setDossierDetails(null);
    if (!place.placeId) return;
    setDossierLoading(true);
    try {
      const res = await apiFetch<{ details: Record<string, unknown> | null }>(
        `/api/beta/companies/${company.id}/geo/place-details`,
        {
          method: 'POST',
          body: JSON.stringify({ placeId: place.placeId }),
        }
      );
      setDossierDetails(res.details);
    } catch (err) {
      handleApiError(err, 'Erro ao carregar detalhes adicionais.');
    } finally {
      setDossierLoading(false);
    }
  };

  const handleAskGeoAi = async (customPrompt?: string) => {
    const q = (customPrompt ?? geoChatInput).trim();
    if (!q) return;
    setGeoChatLoading(true);
    setGeoError('');
    setGeoChatMessages((prev) => [...prev, { role: 'user', content: q }]);
    if (!customPrompt) setGeoChatInput('');

    const territorialSummary = territorialData
      ? `Elevação: ${territorialData.elevationMeters ?? 'N/A'}m | Clima: ${territorialData.weather.temperatureC ?? 'N/A'}°C, chuva 7d ${territorialData.weather.rain7dTotalMm ?? 'N/A'}mm | Hidrologia: ${territorialData.floodRisk.summary} | OSM: ${territorialData.osmInfrastructure.commercialZonesCount} polos comerciais, ${territorialData.osmInfrastructure.industrialZonesCount} zonas industriais, ${territorialData.osmInfrastructure.highwaysCount} vias principais, ${territorialData.osmInfrastructure.waterwaysCount} cursos d'água, ${territorialData.osmInfrastructure.protectedAreasCount} áreas protegidas.`
      : '';

    const ibgeSummary = expansionResult
      ? expansionResult.localities
          .map(
            (l) =>
              `${l.city}/${l.state}: População ${l.ibge.population?.toLocaleString('pt-BR') || 'N/A'} | PIB per capita R$ ${l.ibge.pibPerCapitaReais?.toLocaleString('pt-BR') || 'N/A'} | Concorrentes no segmento (${l.radiusKm}km): ${l.competitorsCount}`
          )
          .join('\n')
      : '';

    try {
      const res = await apiFetch<{
        answer: string;
        groundingLinks?: Array<{ title: string; uri: string; sourceType?: string }>;
      }>(
        `/api/beta/companies/${company.id}/geo/assistant`,
        {
          method: 'POST',
          body: JSON.stringify({
            question: q,
            activeRadiusKm: radiusKm,
            currentCenter: centerLabel,
            livePlaces,
            territorialContext: territorialSummary,
            ibgeContext: ibgeSummary,
            history: geoChatMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );
      setGeoChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, groundingLinks: res.groundingLinks },
      ]);
    } catch (err) {
      handleApiError(err, 'Erro ao consultar o Analista Geo-IA.');
    } finally {
      setGeoChatLoading(false);
    }
  };

  const handleExportGeoExcel = () => {
    const wb = XLSX.utils.book_new();
    const compRows = (livePlaces.length > 0 ? livePlaces : []).map((p) => ({
      Nome: p.name,
      Classificação: p.classification || 'Não classificado',
      Categoria: p.primaryTypeLabel,
      Endereço: p.address,
      'Distância (km)': p.distanceKm,
      'Tempo de Rota': p.travelTimeText || '—',
      'Nota Pública': p.rating ?? 'N/A',
      Avaliações: p.userRatingCount,
      'Faixa de Preço': p.priceLevel,
      Status: p.businessStatus,
      Site: p.website || '—',
      Fonte: p.sourceName,
      'Link Google Maps': p.googleMapsUri,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        compRows.length > 0 ? compRows : [{ Aviso: 'Execute uma busca de concorrentes antes de exportar.' }]
      ),
      'Concorrentes Radar'
    );

    const savedRows = savedEntities.map((e) => ({
      Tipo: e.entityKind,
      Classificação: e.classification,
      Nome: e.name,
      Categoria: e.category,
      Endereço: e.address,
      'Distância (km)': e.distanceKm,
      Rota: e.travelTimeText,
      Nota: e.publicRating,
      Avaliações: e.userRatingsTotal,
      Telefone: e.phone,
      Site: e.website,
      Fonte: e.sourceName,
    }));
    if (savedRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(savedRows), 'Entidades Salvas');
    }

    if (expansionResult?.localities.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          expansionResult.localities.map((l) => ({
            Localidade: `${l.city}/${l.state}`,
            'Raio (km)': l.radiusKm,
            Concorrentes: l.competitorsCount,
            'Nota Média': l.avgRating ?? 'N/A',
            'População IBGE': l.ibge.population ?? 'N/A',
            'PIB per capita IBGE': l.ibge.pibPerCapitaReais ?? 'N/A',
            'Polos Comerciais OSM': l.commercialZonesCount,
            'Zonas Industriais OSM': l.industrialZonesCount,
          }))
        ),
        'Expansão Regional'
      );
    }

    XLSX.writeFile(
      wb,
      `gemeo-digital-geo-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`
    );
  };

  const handleExportGeoPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 44;
    const writeLine = (txt: string, bold = false, size = 10) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(txt, 515) as string[];
      for (const ln of lines) {
        if (y > 780) {
          doc.addPage();
          y = 44;
        }
        doc.text(ln, 40, y);
        y += size + 4;
      }
    };

    writeLine(`GÊMEO DIGITAL — DOSSIÊ DE INTELIGÊNCIA GEOGRÁFICA`, true, 14);
    writeLine(`Empresa: ${company.name} | Segmento: ${company.segment || 'N/A'}`, false, 10);
    writeLine(`Centro analisado: ${centerLabel} | Raio: ${radiusKm} km | Gerado em: ${new Date().toLocaleString('pt-BR')}`, false, 9);
    y += 10;

    writeLine(`1. ESTABELECIMENTOS MAPEADOS NO RADAR (${livePlaces.length})`, true, 11);
    livePlaces.slice(0, 15).forEach((p, idx) => {
      writeLine(
        `${idx + 1}. ${p.name} [${p.classification || p.primaryTypeLabel}] — ${p.distanceKm} km (${
          p.travelTimeText || 'linha reta'
        }) | Nota: ${p.rating ?? 'N/A'} (${p.userRatingCount} aval.) | ${p.address}`,
        false,
        9
      );
    });

    if (competitorAi) {
      y += 8;
      writeLine(`2. RESUMO COMPETITIVO (IA BASEADA EM EVIDÊNCIAS)`, true, 11);
      writeLine(competitorAi.executiveSummary, false, 9);
    }

    if (territorialData) {
      y += 8;
      writeLine(`3. INTELIGÊNCIA TERRITORIAL E CLIMÁTICA`, true, 11);
      writeLine(
        `Elevação: ${territorialData.elevationMeters ?? 'N/A'} m | Clima: ${
          territorialData.weather.temperatureC ?? 'N/A'
        }°C | Chuva 7d: ${territorialData.weather.rain7dTotalMm ?? 'N/A'} mm | Hidrologia: ${
          territorialData.floodRisk.summary
        }`,
        false,
        9
      );
    }

    doc.save(`gemeo-digital-dossie-geo-${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
  };

  const filteredLivePlaces = useMemo(() => {
    return livePlaces.filter((p) => {
      if (classificationFilter !== 'all') {
        return (p.classification || 'indirect') === classificationFilter;
      }
      return true;
    });
  }, [classificationFilter, livePlaces]);

  const savedSuppliers = useMemo(
    () => savedEntities.filter((e) => e.entityKind === 'supplier' || e.entityKind === 'partner'),
    [savedEntities]
  );

  const savedCompetitors = useMemo(
    () => savedEntities.filter((e) => e.entityKind === 'competitor'),
    [savedEntities]
  );

  const subTabsList: Array<{ id: GeoSubTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'radar-mapa', label: 'Mapa & Radar', icon: MapPin },
    { id: 'concorrencia-ia', label: 'Inteligência Competitiva', icon: Target },
    { id: 'expansao', label: 'Expansão & IBGE', icon: TrendingUp },
    { id: 'fornecedores', label: 'Fornecedores & Parceiros', icon: Truck },
    { id: 'territorial', label: 'Territorial & Clima', icon: Waves },
    { id: 'assistente-geo', label: 'Assistente Geo-IA', icon: Bot },
    { id: 'historico', label: 'Histórico & Exportar', icon: History },
  ];

  const defaultMapCenter = centerCoords || { lat: -23.55052, lng: -46.633308 };

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="RADAR GEOMERCADOLÓGICO EM TEMPO REAL"
        title="Inteligência Geográfica, Mercadológica e Competitiva"
        description={`Mapeamento interativo Google Maps Platform, classificação de concorrentes, demografia oficial IBGE, fornecedores e riscos territoriais para ${company.name}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportGeoExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#20B981]" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportGeoPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
              <span>Dossiê PDF</span>
            </button>
          </div>
        }
      />

      {/* Sub-navigation bar inside Geo Module */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2">
        {subTabsList.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#20C5D5] text-[#06132D]'
                  : 'text-[var(--text-secondary)] hover:bg-[#15365F] hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {geoError && (
        <div className="rounded-xl border border-[#EF6464]/40 bg-[#EF6464]/10 px-4 py-3 text-xs text-[#EF6464] flex items-center justify-between gap-2">
          <span>{geoError}</span>
          <button type="button" onClick={() => setGeoError('')} className="hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {geoNotice && (
        <div className="rounded-xl border border-[#20C5D5]/40 bg-[#20C5D5]/10 px-4 py-3 text-xs text-[#20C5D5] flex items-center justify-between gap-2">
          <span>{geoNotice}</span>
          <button type="button" onClick={() => setGeoNotice('')} className="hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <KpiStatCard
          title="Estabelecimentos no Raio"
          value={livePlaces.length}
          subtitle={`Raio ativo: ${radiusKm} km`}
          icon={Target}
          tone="cyan"
        />
        <KpiStatCard
          title="Fornecedores Salvos"
          value={savedSuppliers.length}
          subtitle="Base própria da empresa"
          icon={Truck}
          tone="green"
        />
        <KpiStatCard
          title="Auditorias Salvas"
          value={searchLogs.length}
          subtitle="Histórico de consultas"
          icon={History}
          tone="default"
        />
        <KpiStatCard
          title="Eficiência de Cache"
          value={
            usageSummary.totalCalls > 0
              ? `${Math.round((usageSummary.cacheHits / usageSummary.totalCalls) * 100)}%`
              : '0%'
          }
          subtitle={`${usageSummary.totalCalls} chamadas registradas`}
          icon={Activity}
          tone="amber"
        />
      </div>

      {/* ================================================================= */}
      {/* 1. MAPA INTELIGENTE & RADAR                                       */}
      {/* ================================================================= */}
      {subTab === 'radar-mapa' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Cidade, Estado, Endereço ou Região (Global)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="Ex: Florianópolis, SC ou Av. Paulista, São Paulo"
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={loadingAction === 'geocode'}
                    onClick={() => handleGeocodeSearch()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 bg-[#15365F] px-3 py-2 text-xs font-semibold text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer shrink-0"
                  >
                    {loadingAction === 'geocode' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Compass className="h-3.5 w-3.5" />
                    )}
                    <span>Ir para local</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Segmento / Palavra-chave Empresarial
                </label>
                <input
                  type="text"
                  value={segmentQuery}
                  onChange={(e) => setSegmentQuery(e.target.value)}
                  placeholder="Ex: moda feminina, supermercado, clínica, distribuidora"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                />
              </div>

              <div className="lg:col-span-3 flex items-end">
                <button
                  type="button"
                  disabled={loadingAction === 'search'}
                  onClick={() => handleSearchCompetitors(false)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  {loadingAction === 'search' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span>Escanear Mercado ({radiusKm} km)</span>
                </button>
              </div>
            </div>

            {/* Radius selector + Unit selector + Map Layers */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[var(--text-secondary)] font-semibold">
                  Raio de distância:
                </span>
                {PRESET_RADII.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRadiusKm(r);
                      setCustomRadiusInput(String(r));
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-mono font-semibold cursor-pointer transition-colors ${
                      radiusKm === r
                        ? 'bg-[#20C5D5] text-[#06132D]'
                        : 'bg-[var(--bg-sidebar)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)]'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min={0.5}
                    max={200}
                    step={0.5}
                    value={customRadiusInput}
                    onChange={(e) => setCustomRadiusInput(e.target.value)}
                    onBlur={() => {
                      const val = Number(customRadiusInput);
                      if (Number.isFinite(val) && val >= 0.5 && val <= 200) {
                        setRadiusKm(val);
                      }
                    }}
                    aria-label="Raio personalizado em km"
                    className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Number(customRadiusInput);
                      if (Number.isFinite(val) && val >= 0.5 && val <= 200) setRadiusKm(val);
                    }}
                    className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] hover:border-[#20C5D5] cursor-pointer"
                  >
                    Aplicar km
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {units.length > 0 && (
                  <select
                    aria-label="Centralizar em unidade"
                    onChange={(e) => {
                      const u = units.find((x) => String(x.id) === e.target.value);
                      if (!u) return;
                      const lat = Number(u.latitude);
                      const lng = Number(u.longitude);
                      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
                        setCenterCoords({ lat, lng });
                        setCenterLabel(`${u.name} (${u.city}/${u.state})`);
                      } else {
                        const q = [u.city, u.state, 'Brasil'].filter(Boolean).join(', ');
                        setLocationInput(q);
                        void handleGeocodeSearch(q, u.id);
                      }
                    }}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-xs"
                  >
                    <option value="">Centralizar em unidade...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.city}/{u.state})
                      </option>
                    ))}
                  </select>
                )}

                <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMapTypeId('roadmap')}
                    className={`px-2.5 py-1 text-xs cursor-pointer ${
                      mapTypeId === 'roadmap'
                        ? 'bg-[#15365F] text-[#20C5D5] font-semibold'
                        : 'bg-[var(--bg-sidebar)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Mapa
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTypeId('hybrid')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer ${
                      mapTypeId === 'hybrid'
                        ? 'bg-[#15365F] text-[#20C5D5] font-semibold'
                        : 'bg-[var(--bg-sidebar)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Satellite className="h-3 w-3" />
                    <span>Satélite</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Marker Visibility Checkboxes */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <Layers className="h-3.5 w-3.5 text-[#20C5D5]" />
                Camadas no mapa:
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOwnUnits}
                  onChange={(e) => setShowOwnUnits(e.target.checked)}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-[#20C5D5]" />
                <span>Nossa Empresa / Unidades</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDirect}
                  onChange={(e) => setShowDirect(e.target.checked)}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF6464]" />
                <span>Concorrentes Diretos</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIndirect}
                  onChange={(e) => setShowIndirect(e.target.checked)}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-[#F2B84B]" />
                <span>Indiretos / Potenciais</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSuppliersLayer}
                  onChange={(e) => setShowSuppliersLayer(e.target.checked)}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-[#20B981]" />
                <span>Fornecedores e Parceiros</span>
              </label>
            </div>
          </div>

          {/* Interactive Google Map + Side List */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
              <div className="h-[460px] w-full relative bg-[#06132D]">
                {mapsApiKey ? (
                  <APIProvider
                    apiKey={mapsApiKey}
                    language="pt-BR"
                    region="BR"
                    libraries={['marker']}
                  >
                    <GoogleMap
                      mapId="DEMO_MAP_ID"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      defaultCenter={defaultMapCenter}
                      defaultZoom={13}
                      mapTypeId={mapTypeId}
                      gestureHandling="greedy"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <MapCameraSync center={centerCoords} radiusKm={radiusKm} />
                      <RadiusCircleOverlay
                        center={centerCoords}
                        radiusMeters={Math.max(500, radiusKm * 1000)}
                      />

                      {/* Own Company / Center Marker */}
                      {showOwnUnits && centerCoords && (
                        <PinMarkerWithInfo
                          position={centerCoords}
                          title={`${company.name} (Centro da Análise)`}
                          pinBg="#20C5D5"
                          pinBorder="#071A3A"
                          glyphColor="#06132D"
                          glyph="HQ"
                          isSelected={selectedMarkerKey === 'hq'}
                          onSelect={() => setSelectedMarkerKey('hq')}
                          onClose={() => setSelectedMarkerKey(null)}
                          infoContent={
                            <div className="text-xs text-slate-900 space-y-1">
                              <div className="font-bold">{company.name}</div>
                              <div>{centerLabel}</div>
                              <div className="text-slate-600">
                                Centro do raio de {radiusKm} km
                              </div>
                            </div>
                          }
                        />
                      )}

                      {/* Other User Companies from Cloud SQL */}
                      {showOwnUnits &&
                        userCompanies
                          .filter((uc) => uc.id !== company.id)
                          .map((uc) => {
                            const lat = Number(uc.latitude);
                            const lng = Number(uc.longitude);
                            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) return null;
                            const key = `company-${uc.id}`;
                            const distMatch = companiesDistanceResult?.allCompaniesAndEntities.find(
                              (d) => d.kind === 'user_company' && d.id === uc.id
                            );
                            return (
                              <PinMarkerWithInfo
                                key={key}
                                position={{ lat, lng }}
                                title={`${uc.name} (Sua Empresa Cloud SQL)`}
                                pinBg="#818CF8"
                                pinBorder="#06132D"
                                glyphColor="#06132D"
                                glyph="EM"
                                isSelected={selectedMarkerKey === key}
                                onSelect={() => setSelectedMarkerKey(key)}
                                onClose={() => setSelectedMarkerKey(null)}
                                infoContent={
                                  <div className="text-xs text-slate-900 space-y-1">
                                    <div className="font-bold">{uc.name}</div>
                                    <div className="text-indigo-700 font-semibold">
                                      {uc.segment || 'Empresa cadastrada no Cloud SQL'}
                                    </div>
                                    <div>
                                      {[uc.address, uc.city, uc.state].filter(Boolean).join(', ')}
                                    </div>
                                    {distMatch && (
                                      <div className="font-semibold text-cyan-800">
                                        Distância: {distMatch.routeDistanceKm ?? distMatch.linearDistanceKm} km ({distMatch.durationText})
                                      </div>
                                    )}
                                  </div>
                                }
                              />
                            );
                          })}

                      {/* Branch Units */}
                      {showOwnUnits &&
                        units.map((u) => {
                          const lat = Number(u.latitude);
                          const lng = Number(u.longitude);
                          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) return null;
                          const key = `unit-${u.id}`;
                          return (
                            <PinMarkerWithInfo
                              key={key}
                              position={{ lat, lng }}
                              title={u.name}
                              pinBg="#20C5D5"
                              pinBorder="#06132D"
                              glyph="UN"
                              isSelected={selectedMarkerKey === key}
                              onSelect={() => setSelectedMarkerKey(key)}
                              onClose={() => setSelectedMarkerKey(null)}
                              infoContent={
                                <div className="text-xs text-slate-900 space-y-1">
                                  <div className="font-bold">{u.name}</div>
                                  <div>
                                    {u.city}/{u.state}
                                  </div>
                                </div>
                              }
                            />
                          );
                        })}

                      {/* Live Discovered Competitors */}
                      {livePlaces.map((p) => {
                        const cls = p.classification || 'indirect';
                        if (cls === 'direct' && !showDirect) return null;
                        if (cls !== 'direct' && !showIndirect) return null;
                        const isDir = cls === 'direct';
                        const key = `place-${p.placeId}`;
                        return (
                          <PinMarkerWithInfo
                            key={key}
                            position={{ lat: p.lat, lng: p.lng }}
                            title={p.name}
                            pinBg={isDir ? '#EF6464' : '#F2B84B'}
                            pinBorder="#071A3A"
                            glyphColor="#06132D"
                            isSelected={selectedMarkerKey === key}
                            onSelect={() => setSelectedMarkerKey(key)}
                            onClose={() => setSelectedMarkerKey(null)}
                            infoContent={
                              <div className="text-xs text-slate-900 space-y-1.5">
                                <div className="font-bold">{p.name}</div>
                                <div className="text-slate-600">{p.address}</div>
                                <div className="font-semibold">
                                  {p.distanceKm} km
                                  {p.travelTimeText ? ` · Rota: ${p.travelTimeText}` : ''}
                                  {p.rating ? ` · ★ ${p.rating} (${p.userRatingCount})` : ''}
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenDossier(p)}
                                    className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                                  >
                                    Abrir Dossiê
                                  </button>
                                  {safeExternalHref(p.googleMapsUri) && (
                                    <a
                                      href={safeExternalHref(p.googleMapsUri)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
                                    >
                                      Google Maps
                                    </a>
                                  )}
                                </div>
                              </div>
                            }
                          />
                        );
                      })}

                      {/* Suppliers Layer */}
                      {showSuppliersLayer &&
                        supplierResults.map((s) => {
                          const key = `sup-${s.placeId}`;
                          return (
                            <PinMarkerWithInfo
                              key={key}
                              position={{ lat: s.lat, lng: s.lng }}
                              title={`Fornecedor: ${s.name}`}
                              pinBg="#20B981"
                              pinBorder="#06132D"
                              glyph="F"
                              isSelected={selectedMarkerKey === key}
                              onSelect={() => setSelectedMarkerKey(key)}
                              onClose={() => setSelectedMarkerKey(null)}
                              infoContent={
                                <div className="text-xs text-slate-900 space-y-1">
                                  <div className="font-bold">{s.name}</div>
                                  <div className="text-emerald-700 font-semibold">
                                    Fornecedor / Parceiro ({s.distanceKm} km)
                                  </div>
                                  <div className="text-slate-600">{s.address}</div>
                                </div>
                              }
                            />
                          );
                        })}
                    </GoogleMap>
                  </APIProvider>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <Globe className="h-10 w-10 text-[#20C5D5]" />
                    <div className="text-sm font-bold text-white">
                      {configLoaded
                        ? 'Mapa interativo aguardando chave Google Maps Platform no navegador'
                        : 'Carregando configuração do Google Maps Platform...'}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] max-w-md">
                      Você ainda pode pesquisar estabelecimentos, consultar IBGE, rotas e análise territorial nas abas ao lado enquanto a chave visual do mapa é carregada.
                    </p>
                  </div>
                )}
              </div>
              {searchMetaNote && (
                <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] text-[11px] text-[var(--text-secondary)]">
                  {searchMetaNote}
                </div>
              )}
            </div>

            {/* Discovered Places Interactive List */}
            <div className="xl:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col h-[500px]">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-sm font-bold">
                    Estabelecimentos no Raio ({filteredLivePlaces.length})
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Dados verificáveis via Google Places + Routes API
                  </p>
                </div>
                {livePlaces.length > 0 && (
                  <button
                    type="button"
                    disabled={loadingAction === 'ai-comp'}
                    onClick={handleAnalyzeCompetitorsAi}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#15365F] border border-[#20C5D5]/40 px-2.5 py-1.5 text-[11px] font-semibold text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer shrink-0"
                  >
                    {loadingAction === 'ai-comp' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>Classificar c/ IA</span>
                  </button>
                )}
              </div>

              {livePlaces.length > 0 && (
                <div className="flex flex-wrap gap-1.5 py-2.5 text-[11px]">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'direct', label: 'Diretos' },
                    { id: 'indirect', label: 'Indiretos' },
                    { id: 'potential', label: 'Potenciais' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setClassificationFilter(f.id)}
                      className={`rounded-md px-2 py-0.5 cursor-pointer ${
                        classificationFilter === f.id
                          ? 'bg-[#20C5D5] text-[#06132D] font-bold'
                          : 'bg-[var(--bg-sidebar)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {filteredLivePlaces.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-[var(--text-secondary)] space-y-2">
                    <Compass className="h-8 w-8 text-[#20C5D5]/70" />
                    <p>
                      Clique em <strong>Escanear Mercado ({radiusKm} km)</strong> para localizar empresas reais ao redor de{' '}
                      <strong className="text-white">{centerLabel}</strong>.
                    </p>
                  </div>
                ) : (
                  filteredLivePlaces.map((p) => (
                    <div
                      key={p.placeId}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 p-3 space-y-2 text-xs hover:border-[#20C5D5]/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{p.name}</div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {p.primaryTypeLabel} · {p.address}
                          </div>
                        </div>
                        {p.classification && (
                          <StatusBadge
                            kind={
                              p.classification === 'direct'
                                ? 'ameaca'
                                : p.classification === 'indirect'
                                ? 'alerta'
                                : 'movimento'
                            }
                            customLabel={
                              p.classification === 'direct'
                                ? 'Direto'
                                : p.classification === 'indirect'
                                ? 'Indireto'
                                : 'Potencial'
                            }
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                        <span className="text-[#20C5D5] font-semibold">{p.distanceKm} km</span>
                        {p.travelTimeText && (
                          <span className="text-[#20B981]">Rota: {p.travelTimeText}</span>
                        )}
                        {p.rating !== null && (
                          <span className="inline-flex items-center gap-1 text-[#F2B84B]">
                            <Star className="h-3 w-3 fill-[#F2B84B]" />
                            {p.rating} ({p.userRatingCount})
                          </span>
                        )}
                        <span className="text-[var(--text-secondary)]">{p.businessStatus}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenDossier(p)}
                            className="text-[11px] font-semibold text-[#20C5D5] hover:underline cursor-pointer"
                          >
                            Ver dossiê completo
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMarkerKey(`place-${p.placeId}`)}
                            className="text-[11px] text-[var(--text-secondary)] hover:text-white cursor-pointer"
                          >
                            Focar pino
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={loadingAction === `save:${p.placeId}`}
                          onClick={() => void handleSaveEntity(p, 'competitor', true)}
                          className="rounded border border-[#20C5D5]/40 bg-[#15365F] px-2 py-1 text-[11px] font-medium text-[#20C5D5] hover:bg-[#20C5D5]/20 cursor-pointer"
                        >
                          Salvar concorrente
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Cloud SQL Companies Distance & Radius X km Panel */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                  <Navigation className="h-4 w-4 text-[#20C5D5]" />
                  <span>Distância (km) entre Empresas e Filtro por Raio ({radiusKm} km) — Cloud SQL</span>
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Calcule a distância real em quilômetros entre suas empresas cadastradas no Cloud SQL e visualize quais empresas ou estabelecimentos salvos estão dentro do raio de {radiusKm} km.
                </p>
              </div>
              <button
                type="button"
                disabled={loadingAction === 'companies-distance'}
                onClick={() => void handleComputeCompaniesDistance()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
              >
                {loadingAction === 'companies-distance' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Compass className="h-3.5 w-3.5" />
                )}
                <span>Calcular Distância e Raio ({radiusKm} km)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Empresa de Origem (Centro do Raio)
                </label>
                <select
                  value={originCompanyId}
                  onChange={(e) => setOriginCompanyId(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                >
                  {(userCompanies.length > 0 ? userCompanies : [{ id: company.id, name: company.name, city: company.city, state: company.state }]).map((uc) => (
                    <option key={uc.id} value={uc.id}>
                      {uc.name} ({uc.city || '—'}/{uc.state || '—'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Comparar com Empresa Específica (opcional)
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                >
                  <option value="">Todas no raio de {radiusKm} km</option>
                  {userCompanies
                    .filter((uc) => uc.id !== originCompanyId)
                    .map((uc) => (
                      <option key={uc.id} value={uc.id}>
                        {uc.name} ({uc.city || '—'}/{uc.state || '—'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Modalidade de Rota (Routes API)
                </label>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value as 'DRIVE' | 'WALK' | 'TWO_WHEELER')}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                >
                  <option value="DRIVE">Carro (Tráfego em tempo real)</option>
                  <option value="TWO_WHEELER">Moto / Entrega rápida</option>
                  <option value="WALK">A pé</option>
                </select>
              </div>
            </div>

            {companiesDistanceResult && (
              <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                {companiesDistanceResult.selectedPair && (
                  <div className="rounded-lg border border-[#20C5D5]/40 bg-[#15365F]/80 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-white">
                        {companiesDistanceResult.originCompany.name} ↔ {companiesDistanceResult.selectedPair.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {companiesDistanceResult.selectedPair.address}
                      </div>
                    </div>
                    <div className="font-mono text-right">
                      <div className="text-sm font-bold text-[#20C5D5]">
                        {companiesDistanceResult.selectedPair.routeDistanceKm ??
                          companiesDistanceResult.selectedPair.linearDistanceKm}{' '}
                        km
                      </div>
                      <div className="text-[11px] text-[#20B981]">
                        {companiesDistanceResult.selectedPair.durationText} · Linha reta:{' '}
                        {companiesDistanceResult.selectedPair.linearDistanceKm} km
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-white">
                    Dentro do raio de {companiesDistanceResult.radiusKm} km ({companiesDistanceResult.withinRadiusCount})
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Consulta registrada no Cloud SQL em{' '}
                    {new Date(companiesDistanceResult.consultedAt).toLocaleString('pt-BR')}
                  </span>
                </div>

                {companiesDistanceResult.allCompaniesAndEntities.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 p-3 text-xs text-[var(--text-secondary)]">
                    Nenhuma outra empresa cadastrada ou entidade salva com coordenadas geocodificadas ainda. Cadastre outra empresa ou salve concorrentes/fornecedores no radar acima para comparar distâncias em km.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {companiesDistanceResult.allCompaniesAndEntities.map((item) => (
                      <div
                        key={item.key}
                        className={`rounded-lg border p-3 text-xs space-y-1.5 ${
                          item.withinRadius
                            ? 'border-[#20C5D5]/50 bg-[#15365F]/50'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{item.name}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] truncate">
                              {item.kind === 'user_company' ? 'Sua Empresa (Cloud SQL)' : item.segmentOrCategory}
                            </div>
                          </div>
                          <StatusBadge
                            kind={item.withinRadius ? 'oportunidade' : 'pendente'}
                            customLabel={item.withinRadius ? `No raio (${item.linearDistanceKm} km)` : `${item.linearDistanceKm} km`}
                          />
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {item.address}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] font-mono text-[11px]">
                          <span className="text-[#20C5D5]">
                            Rota: {item.routeDistanceKm ?? item.linearDistanceKm} km ({item.durationText})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMarkerKey(item.key);
                              setCenterCoords({ lat: item.lat, lng: item.lng });
                            }}
                            className="text-[#20C5D5] hover:underline cursor-pointer font-sans font-semibold"
                          >
                            Ver no mapa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. INTELIGÊNCIA COMPETITIVA & CLASSIFICAÇÃO                       */}
      {/* ================================================================= */}
      {subTab === 'concorrencia-ia' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">
                Classificação Competitiva e Comparativo Estratégico
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Distingue concorrentes diretos, indiretos e potenciais separando dados reais de estimativas e informações não públicas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loadingAction === 'search'}
                onClick={() => handleSearchCompetitors(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#20C5D5]" />
                <span>Atualizar Radar</span>
              </button>
              <button
                type="button"
                disabled={loadingAction === 'ai-comp' || livePlaces.length === 0}
                onClick={handleAnalyzeCompetitorsAi}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-50"
              >
                {loadingAction === 'ai-comp' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Gerar Análise Competitiva Completa</span>
              </button>
            </div>
          </div>

          {livePlaces.length === 0 ? (
            <EmptyEvidenceBox
              title="Nenhum concorrente escaneado nesta sessão"
              description="Vá em Mapa & Radar e execute uma varredura no raio desejado para classificar os concorrentes reais da região."
              actionLabel="Ir para Mapa & Radar"
              onAction={() => setSubTab('radar-mapa')}
            />
          ) : (
            <>
              {/* Comparative Data Table */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <h3 className="text-sm font-bold">Matriz Comparativa de Concorrentes ({livePlaces.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--border-subtle)] text-[11px] uppercase text-[var(--text-secondary)]">
                      <tr>
                        <th className="py-2 pr-3">Empresa</th>
                        <th className="py-2 pr-3">Classificação</th>
                        <th className="py-2 pr-3">Distância / Rota</th>
                        <th className="py-2 pr-3">Nota Pública</th>
                        <th className="py-2 pr-3">Preço / Digital</th>
                        <th className="py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {livePlaces.map((p) => (
                        <tr key={p.placeId} className="hover:bg-[var(--bg-sidebar)]/40">
                          <td className="py-2.5 pr-3">
                            <div className="font-bold text-white">{p.name}</div>
                            <div className="text-[11px] text-[var(--text-secondary)]">{p.address}</div>
                          </td>
                          <td className="py-2.5 pr-3">
                            {p.classification ? (
                              <StatusBadge
                                kind={
                                  p.classification === 'direct'
                                    ? 'ameaca'
                                    : p.classification === 'indirect'
                                    ? 'alerta'
                                    : 'movimento'
                                }
                                customLabel={
                                  p.classification === 'direct'
                                    ? 'Concorrente direto'
                                    : p.classification === 'indirect'
                                    ? 'Concorrente indireto'
                                    : 'Concorrente potencial'
                                }
                              />
                            ) : (
                              <span className="text-[var(--text-secondary)]">Pendente IA</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-mono">
                            <div>{p.distanceKm} km</div>
                            {p.travelTimeText && (
                              <div className="text-[11px] text-[#20B981]">{p.travelTimeText}</div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-mono">
                            {p.rating !== null ? `★ ${p.rating} (${p.userRatingCount})` : 'Não informada'}
                          </td>
                          <td className="py-2.5 pr-3 text-[11px]">
                            <div>{p.priceLevel}</div>
                            {safeExternalHref(p.website) ? (
                              <a
                                href={safeExternalHref(p.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#20C5D5] hover:underline inline-flex items-center gap-1"
                              >
                                Site oficial <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[var(--text-secondary)]">Sem site divulgado</span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <button
                              type="button"
                              onClick={() => void handleOpenDossier(p)}
                              className="rounded border border-[#20C5D5]/40 px-2 py-1 text-[11px] text-[#20C5D5] hover:bg-[#20C5D5]/10 cursor-pointer"
                            >
                              Dossiê
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {competitorAi && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#20C5D5]/30 bg-[#15365F]/50 p-5 text-xs space-y-2">
                    <div className="font-bold text-sm text-[#20C5D5]">Síntese Estratégica Competitiva</div>
                    <p className="leading-relaxed text-white">{competitorAi.executiveSummary}</p>
                  </div>

                  {/* Epistemic 4-box breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-[#20B981]/30 bg-[var(--bg-card)] p-4 space-y-2">
                      <div className="font-bold text-[#20B981]">Dados Confirmados (Fontes Públicas)</div>
                      <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                        {competitorAi.confirmedData.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-4 space-y-2">
                      <div className="font-bold text-[#20C5D5]">Dados Estimados (Com Critério)</div>
                      <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                        {competitorAi.estimatedData.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-[#F2B84B]/30 bg-[var(--bg-card)] p-4 space-y-2">
                      <div className="font-bold text-[#F2B84B]">Hipóteses a Validar em Campo</div>
                      <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                        {competitorAi.hypotheses.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-[#EF6464]/30 bg-[var(--bg-card)] p-4 space-y-2">
                      <div className="font-bold text-[#EF6464]">Informações Indisponíveis</div>
                      <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                        {competitorAi.unavailableData.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. OPORTUNIDADES DE EXPANSÃO & IBGE                               */}
      {/* ================================================================= */}
      {subTab === 'expansao' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold">
                Comparador de Expansão Geográfica (Google Places + IBGE + OpenStreetMap)
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Compara saturação de concorrentes, população e PIB municipal (IBGE) e polos comerciais/viários antes de abrir novas filiais ou frentes comerciais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {expansionTargets.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-3 space-y-2"
                >
                  <div className="font-semibold text-[#20C5D5]">Localidade {idx + 1}</div>
                  <input
                    type="text"
                    value={t.city}
                    onChange={(e) =>
                      setExpansionTargets((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, city: e.target.value } : row))
                      )
                    }
                    placeholder="Cidade"
                    className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={t.state}
                      maxLength={2}
                      onChange={(e) =>
                        setExpansionTargets((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, state: e.target.value.toUpperCase() } : row
                          )
                        )
                      }
                      placeholder="UF"
                      className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 uppercase"
                    />
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) =>
                        setExpansionTargets((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                        )
                      }
                      placeholder="Rótulo"
                      className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={loadingAction === 'expansion'}
                onClick={handleRunExpansionAnalysis}
                className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
              >
                {loadingAction === 'expansion' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                <span>Comparar Regiões (Raio {radiusKm} km)</span>
              </button>
            </div>
          </div>

          {expansionResult && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#20C5D5]/40 bg-[#15365F]/50 p-5 text-xs space-y-2">
                <div className="font-bold text-sm text-[#20C5D5]">
                  Veredicto Comparativo de Expansão
                </div>
                <p className="leading-relaxed text-white">
                  {expansionResult.comparison.verdictSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {expansionResult.localities.map((loc, idx) => {
                  const aiEval = expansionResult.comparison.localityEvaluations?.[idx];
                  return (
                    <div
                      key={`${loc.city}-${idx}`}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-white">
                            {loc.city}/{loc.state}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">{loc.label}</div>
                        </div>
                        {aiEval && (
                          <span className="rounded-md bg-[#20C5D5]/15 border border-[#20C5D5]/40 px-2 py-0.5 font-mono font-bold text-[#20C5D5]">
                            {aiEval.score0to100}/100
                          </span>
                        )}
                      </div>

                      {aiEval?.demandVsSaturationTag && (
                        <StatusBadge kind="movimento" customLabel={aiEval.demandVsSaturationTag} />
                      )}

                      <div className="space-y-1.5 rounded-lg bg-[var(--bg-sidebar)] p-3 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Concorrentes ({loc.radiusKm}km):</span>
                          <span className="font-bold text-white">{loc.competitorsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">População (IBGE):</span>
                          <span className="font-bold text-[#20C5D5]">
                            {loc.ibge.population !== null
                              ? loc.ibge.population.toLocaleString('pt-BR')
                              : 'Indisponível'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">PIB per capita:</span>
                          <span className="font-bold text-[#20B981]">
                            {loc.ibge.pibPerCapitaReais !== null
                              ? `R$ ${loc.ibge.pibPerCapitaReais.toLocaleString('pt-BR')}`
                              : 'Indisponível'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Polos Comerciais OSM:</span>
                          <span>{loc.commercialZonesCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Zonas Industriais / Vias:</span>
                          <span>
                            {loc.industrialZonesCount} / {loc.highwaysCount}
                          </span>
                        </div>
                      </div>

                      {aiEval && (
                        <div className="space-y-2 text-[11px]">
                          {aiEval.pros?.length > 0 && (
                            <div>
                              <div className="font-semibold text-[#20B981]">Fatores favoráveis:</div>
                              <ul className="list-disc pl-4 text-[var(--text-secondary)]">
                                {aiEval.pros.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiEval.cautions?.length > 0 && (
                            <div>
                              <div className="font-semibold text-[#F2B84B]">Pontos de cautela:</div>
                              <ul className="list-disc pl-4 text-[var(--text-secondary)]">
                                {aiEval.cautions.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                        Fontes: {loc.ibge.source}, Google Places API e OSM Overpass.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. RADAR DE FORNECEDORES E PARCEIROS                              */}
      {/* ================================================================= */}
      {subTab === 'fornecedores' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Especialidade de Fornecedor, Distribuidora ou Parceiro Logístico
                </label>
                <input
                  type="text"
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                  placeholder="Ex: distribuidora têxtil, transportadora, embalagem, atacado"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={loadingAction === 'suppliers'}
                onClick={handleSearchSuppliers}
                className="inline-flex items-center gap-2 rounded-lg bg-[#20B981] px-4 py-2 text-xs font-bold text-[#06132D] hover:opacity-90 cursor-pointer"
              >
                {loadingAction === 'suppliers' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                <span>Buscar Fornecedores ({radiusKm} km)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Live Supplier Search Results */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <h3 className="text-sm font-bold">
                Resultados Encontrados ({supplierResults.length})
              </h3>
              {supplierResults.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Execute uma busca acima para localizar distribuidores, prestadores e parceiros logísticos reais ao redor de {centerLabel}.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {supplierResults.map((s) => (
                    <div
                      key={s.placeId}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white">{s.name}</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {s.primaryTypeLabel} · {s.address}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleSaveEntity(s, 'supplier', false)}
                          className="rounded bg-[#20B981]/20 border border-[#20B981]/40 px-2.5 py-1 text-[11px] font-semibold text-[#20B981] hover:bg-[#20B981]/30 cursor-pointer shrink-0"
                        >
                          Salvar parceiro
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] font-mono">
                        <span className="text-[#20C5D5]">{s.distanceKm} km</span>
                        {s.travelTimeText && <span className="text-[#20B981]">{s.travelTimeText}</span>}
                        {s.rating !== null && <span>★ {s.rating} ({s.userRatingCount})</span>}
                        {s.phone && <span>{s.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Supplier & Partner List in PostgreSQL */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <h3 className="text-sm font-bold">
                Lista Salva de Fornecedores e Parceiros ({savedSuppliers.length})
              </h3>
              {savedSuppliers.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Nenhum fornecedor salvo ainda para {company.name}. Salve os melhores resultados ao lado para manter sua rede isolada no banco de dados.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {savedSuppliers.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white">{e.name}</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {e.category} · {e.address}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteEntity(e.id)}
                          className="text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                          aria-label="Remover fornecedor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] font-mono text-[var(--text-secondary)]">
                        {e.distanceKm && <span className="text-[#20C5D5]">{e.distanceKm} km</span>}
                        {e.travelTimeText && <span className="text-[#20B981]">{e.travelTimeText}</span>}
                        {e.phone && <span>{e.phone}</span>}
                        {safeExternalHref(e.googleMapsUri) && (
                          <a
                            href={safeExternalHref(e.googleMapsUri)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#20C5D5] hover:underline"
                          >
                            Ver no Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. INTELIGÊNCIA TERRITORIAL, LOGÍSTICA & AMBIENTAL                */}
      {/* ================================================================= */}
      {subTab === 'territorial' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">
                Auditoria Territorial, Logística, Climática e Hidrológica
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Cruza OpenStreetMap Overpass (zonas industriais, polos comerciais, rodovias, portos, rios e áreas preservadas), Open-Meteo Clima & GloFAS Flood e alertas INMET.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingAction === 'territorial' || !centerCoords}
              onClick={handleRunTerritorialAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-50"
            >
              {loadingAction === 'territorial' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Waves className="h-4 w-4" />
              )}
              <span>Executar Auditoria Territorial</span>
            </button>
          </div>

          {!territorialData ? (
            <EmptyEvidenceBox
              title="Auditoria territorial ainda não executada"
              description={`Clique no botão acima para analisar infraestrutura viária, zonas industriais/comerciais, rios, elevação e alertas climáticos num raio ao redor de ${centerLabel}.`}
              actionLabel="Analisar Entorno Agora"
              onAction={handleRunTerritorialAnalysis}
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiStatCard
                  title="Altitude Local"
                  value={
                    territorialData.elevationMeters !== null
                      ? `${territorialData.elevationMeters} m`
                      : 'Indisponível'
                  }
                  subtitle="Modelo digital Open-Meteo"
                  icon={Compass}
                  tone="default"
                />
                <KpiStatCard
                  title="Clima / Chuva (7 dias)"
                  value={
                    territorialData.weather.status === 'ok'
                      ? `${territorialData.weather.rain7dTotalMm ?? 0} mm`
                      : 'Indisponível'
                  }
                  subtitle={
                    territorialData.weather.temperatureC !== null
                      ? `Agora: ${territorialData.weather.temperatureC}°C · Vento ${territorialData.weather.windSpeedKmh} km/h`
                      : 'Sem leitura'
                  }
                  icon={CloudRain}
                  tone="cyan"
                />
                <KpiStatCard
                  title="Zonas Industriais & Comerciais"
                  value={`${territorialData.osmInfrastructure.industrialZonesCount} / ${territorialData.osmInfrastructure.commercialZonesCount}`}
                  subtitle="OpenStreetMap Overpass"
                  icon={Factory}
                  tone="green"
                />
                <KpiStatCard
                  title="Risco Hidrológico (GloFAS)"
                  value={territorialData.floodRisk.elevatedFlowAlert ? 'Atenção' : 'Normal'}
                  subtitle={territorialData.floodRisk.source}
                  icon={ShieldAlert}
                  tone={territorialData.floodRisk.elevatedFlowAlert ? 'amber' : 'green'}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <div className="font-bold text-sm">Riscos Hídricos e Alertas Meteorológicos</div>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {territorialData.floodRisk.summary}
                  </p>
                  <div className="text-[11px] text-[#20C5D5]">
                    Fonte: {territorialData.floodRisk.source} · Consultado em{' '}
                    {new Date(territorialData.consultedAt).toLocaleString('pt-BR')}
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                    <div className="font-semibold">Alertas Ativos INMET ({company.state || 'Brasil'})</div>
                    {territorialData.inmetAlerts.length === 0 ? (
                      <div className="text-[var(--text-secondary)]">
                        Nenhum alerta meteorológico ativo retornado pelo INMET para a UF no momento.
                      </div>
                    ) : (
                      territorialData.inmetAlerts.map((a, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-[#F2B84B]/40 bg-[#F2B84B]/10 p-2.5 space-y-1"
                        >
                          <div className="font-bold text-[#F2B84B]">{a.severity}</div>
                          <div>{a.description}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            Estados: {a.states} · Fonte: {a.source}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <div className="font-bold text-sm">Infraestrutura Logística e Ambiental (OSM)</div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="rounded bg-[var(--bg-sidebar)] p-2">
                      Eixos viários principais: <strong>{territorialData.osmInfrastructure.highwaysCount}</strong>
                    </div>
                    <div className="rounded bg-[var(--bg-sidebar)] p-2">
                      Portos / Aeródromos: <strong>{territorialData.osmInfrastructure.portsAndAirportsCount}</strong>
                    </div>
                    <div className="rounded bg-[var(--bg-sidebar)] p-2">
                      Rios e canais próximos: <strong>{territorialData.osmInfrastructure.waterwaysCount}</strong>
                    </div>
                    <div className="rounded bg-[var(--bg-sidebar)] p-2">
                      Áreas de preservação: <strong>{territorialData.osmInfrastructure.protectedAreasCount}</strong>
                    </div>
                  </div>
                  {territorialData.osmInfrastructure.highlights.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                      {territorialData.osmInfrastructure.highlights.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 rounded bg-[var(--bg-sidebar)]/60 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="font-medium text-white truncate">{h.name}</span>
                          <span className="text-[#20C5D5] shrink-0">{h.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[11px] text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-2">
                    <strong>Limitações declaradas:</strong> {territorialData.limitations.join(' ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 6. ASSISTENTE GEO-IA                                              */}
      {/* ================================================================= */}
      {subTab === 'assistente-geo' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#20C5D5]" />
              <span>Analista Conversacional de Inteligência Geográfica (Geo-IA)</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Pergunte sobre concorrentes no raio, rotas, expansão com IBGE, fornecedores ou riscos territoriais. A IA cita apenas evidências reais carregadas no módulo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              `Quantos concorrentes existem em ${radiusKm} km de ${centerLabel}?`,
              'Quais são os 5 concorrentes mais bem avaliados e seus diferenciais?',
              'Onde há melhor equilíbrio entre demanda (IBGE) e concorrência?',
              'Quais fornecedores estão mais próximos e quais alertas territoriais existem?',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleAskGeoAi(prompt)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-1.5 text-[11px] text-[#20C5D5] hover:border-[#20C5D5] cursor-pointer text-left"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="h-72 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 p-4 space-y-3 text-xs">
            {geoChatMessages.length === 0 ? (
              <div className="text-[var(--text-secondary)]">
                Faça uma pergunta abaixo ou clique em uma das sugestões acima para analisar o território atual.
              </div>
            ) : (
              geoChatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 ${
                    m.role === 'user'
                      ? 'bg-[#15365F] text-white ml-8'
                      : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] mr-8 whitespace-pre-wrap leading-relaxed'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-[#20C5D5] mb-1">
                    {m.role === 'user' ? 'Você' : 'Geo-IA'}
                  </div>
                  <div>{m.content}</div>
                  {m.groundingLinks && m.groundingLinks.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
                      {m.groundingLinks.map((lk, i) => {
                        const safeHref = safeExternalHref(lk.uri);
                        if (!safeHref) return null;
                        return (
                          <a
                            key={`${safeHref}-${i}`}
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[#20C5D5] hover:border-[#20C5D5]"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            <span>{lk.title}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
            {geoChatLoading && (
              <div className="flex items-center gap-2 text-[#20C5D5] text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>digitando...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAskGeoAi();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={geoChatInput}
              onChange={(e) => setGeoChatInput(e.target.value)}
              placeholder="Pergunte sobre saturação de mercado, rotas, concorrentes ou expansão..."
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={geoChatLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* 7. HISTÓRICO, MONITORAMENTO PERIÓDICO & MONITORAMENTO DE USO      */}
      {/* ================================================================= */}
      {subTab === 'historico' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">
                Monitoramento de Mudanças no Entorno e Histórico de Consultas
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Compara varreduras recentes para detectar novos entrantes ou mudanças no raio de {radiusKm} km e monitora o consumo das APIs.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingAction === 'monitor'}
              onClick={() => handleSearchCompetitors(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-bold text-[#06132D] cursor-pointer"
            >
              {loadingAction === 'monitor' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Verificar Mudanças Agora</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
              <h3 className="text-sm font-bold">Histórico de Pesquisas Geográficas ({searchLogs.length})</h3>
              {searchLogs.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Nenhuma consulta geográfica salva ainda para {company.name}.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {searchLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{log.query}</span>
                        <span className="text-[11px] font-mono text-[#20C5D5]">
                          {log.resultsCount} res. · {log.radiusKm} km
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Centro: {log.centerAddress} ·{' '}
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </div>
                      {log.alertsSummary && (
                        <div className="text-[11px] text-[#F2B84B]">{log.alertsSummary}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold">Consumo de APIs & Fontes</h3>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                  <span>Total de chamadas:</span>
                  <strong className="text-[#20C5D5]">{usageSummary.totalCalls}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                  <span>Atendidas via Cache:</span>
                  <strong className="text-[#20B981]">{usageSummary.cacheHits}</strong>
                </div>
                {Object.entries(usageSummary.byProvider).map(([prov, count]) => (
                  <div key={prov} className="flex justify-between py-1">
                    <span className="text-[var(--text-secondary)]">{prov}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <div className="font-semibold">Concorrentes Salvos no Geo ({savedCompetitors.length})</div>
                {savedCompetitors.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteEntity(c.id)}
                      className="text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Competitor Dossier Modal */}
      {dossierPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
              <div>
                <div className="text-[11px] font-mono text-[#20C5D5]">
                  DOSSIÊ DO ESTABELECIMENTO · {dossierPlace.sourceName}
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">{dossierPlace.name}</h3>
                <p className="text-[var(--text-secondary)]">{dossierPlace.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setDossierPlace(null)}
                className="text-[var(--text-secondary)] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                <div className="text-[10px] text-[var(--text-secondary)]">Distância</div>
                <div className="font-bold text-[#20C5D5]">{dossierPlace.distanceKm} km</div>
              </div>
              <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                <div className="text-[10px] text-[var(--text-secondary)]">Rota (Routes API)</div>
                <div className="font-bold text-[#20B981]">
                  {dossierPlace.travelTimeText || 'Geodésica'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                <div className="text-[10px] text-[var(--text-secondary)]">Avaliação Pública</div>
                <div className="font-bold text-[#F2B84B]">
                  {dossierPlace.rating !== null
                    ? `${dossierPlace.rating}/5 (${dossierPlace.userRatingCount})`
                    : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                <div className="text-[10px] text-[var(--text-secondary)]">Faixa de Preço</div>
                <div className="font-bold">{dossierPlace.priceLevel}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div>
                <strong>Categoria:</strong> {dossierPlace.primaryTypeLabel}
              </div>
              <div>
                <strong>Status operacional:</strong> {dossierPlace.businessStatus}
              </div>
              <div>
                <strong>Telefone:</strong> {dossierPlace.phone || 'Não divulgado publicamente'}
              </div>
              <div>
                <strong>Site oficial:</strong>{' '}
                {safeExternalHref(dossierPlace.website) ? (
                  <a
                    href={safeExternalHref(dossierPlace.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#20C5D5] hover:underline"
                  >
                    {dossierPlace.website}
                  </a>
                ) : (
                  'Não divulgado'
                )}
              </div>
              <div>
                <strong>Última atualização:</strong>{' '}
                {new Date(dossierPlace.consultedAt).toLocaleString('pt-BR')}
              </div>
            </div>

            {dossierPlace.openingHours.length > 0 && (
              <div className="rounded-lg bg-[var(--bg-sidebar)] p-3 space-y-1">
                <div className="font-bold text-[#20C5D5]">Horário de Funcionamento Público</div>
                {dossierPlace.openingHours.map((h, i) => (
                  <div key={i} className="text-[11px] text-[var(--text-secondary)]">
                    {h}
                  </div>
                ))}
              </div>
            )}

            {dossierLoading ? (
              <div className="flex items-center gap-2 text-[#20C5D5]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando avaliações públicas recentes...</span>
              </div>
            ) : (
              Array.isArray(dossierDetails?.reviews) &&
              dossierDetails.reviews.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-[#20C5D5]">
                    Avaliações Públicas Recentes (Google Maps)
                  </div>
                  {(
                    dossierDetails.reviews as Array<{
                      rating?: number;
                      relativePublishTimeDescription?: string;
                      text?: { text?: string };
                    }>
                  )
                    .slice(0, 4)
                    .map((rev, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 p-2.5 space-y-1"
                      >
                        <div className="font-mono text-[11px] text-[#F2B84B]">
                          ★ {rev.rating || '—'} · {rev.relativePublishTimeDescription || ''}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {rev.text?.text || '(Sem texto)'}
                        </p>
                      </div>
                    ))}
                </div>
              )
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-3 border-t border-[var(--border-subtle)]">
              {safeExternalHref(dossierPlace.googleMapsUri) ? (
                <a
                  href={safeExternalHref(dossierPlace.googleMapsUri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs hover:border-[#20C5D5]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Abrir no Google Maps</span>
                </a>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveEntity(dossierPlace, 'competitor', true)}
                  className="rounded-lg bg-[#20C5D5] px-4 py-2 font-bold text-[#06132D] cursor-pointer"
                >
                  Salvar & Sincronizar Concorrente
                </button>
                <button
                  type="button"
                  onClick={() => setDossierPlace(null)}
                  className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
