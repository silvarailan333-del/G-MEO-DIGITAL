import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Info,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useBetaAuth } from './AuthContext';
import { BetaBadge } from './BetaAuthPages';
import { GeoIntelligenceModule } from '../components/GeoIntelligenceModule';
import {
  FinancialOperationsModule,
  type CrossAnalysisDisplay,
} from '../components/FinancialOperationsModule';
import { SimpleBarChart } from '../components/SimpleBarChart';
import {
  formatBrlFromCents,
  formatPct,
  type FinancialCostRow,
  type FinancialExpenseRow,
  type FinancialSalesRow,
  type FinancialSummaryBundle,
  type InventoryControlRow,
} from '../lib/financialFormulas';
import { HorizontalProgressList, TrendLineChart } from '../components/Charts';
import {
  AppShell,
  EmptyEvidenceBox,
  KpiStatCard,
  PageHeader,
  SignalCard,
  StatusBadge,
  TraceabilityBar,
  type NavGroup,
} from '../components/ui/TwinUI';
import {
  downloadCatalogTemplateExcel,
  downloadImportTemplateExcel,
  downloadSalesUnitsTemplateExcel,
  exportExecutiveReportExcel,
  exportExecutiveReportPDF,
} from '../components/ReportExporter';
import {
  parseCatalogSpreadsheet,
  parseSalesUnitsSpreadsheet,
  type ParsedCatalogItem,
  type ParsedSalesItem,
} from '../lib/productImportParser';
import {
  ANNUAL_DISCOUNT_LABEL,
  PAYMENT_NOTICE_DEMO,
  PLAN_ADDONS,
  PLANS_CONFIG,
  type BillingCycle,
  type PlanCode,
} from '../config/plans';

type BetaSection =
  | 'painel'
  | 'documentos'
  | 'dados-empresa'
  | 'produtos'
  | 'gestao-financeira'
  | 'consumidores'
  | 'radar'
  | 'macro'
  | 'verificar'
  | 'concorrentes'
  | 'inteligencia-geo'
  | 'analises'
  | 'decisoes'
  | 'planos-acao'
  | 'oportunidades'
  | 'simulador'
  | 'assistente'
  | 'relatorios'
  | 'indicadores'
  | 'historico'
  | 'plano'
  | 'configuracoes';

function normalizeBetaSection(raw?: string): BetaSection {
  if (!raw || raw === 'painel' || raw === 'resumo-do-dia') return 'painel';
  if (raw === 'importacao') return 'documentos';
  if (raw === 'integracoes') return 'dados-empresa';
  if (['dre', 'vendas', 'custos', 'despesas', 'financeiro'].includes(raw)) return 'gestao-financeira';
  if (raw === 'monitoramento' || raw === 'tendencias') return 'radar';
  if (raw === 'indicadores-macro' || raw === 'ambiente') return 'macro';
  if (raw === 'mapa' || raw === 'geo') return 'inteligencia-geo';
  if (raw === 'pestel' || raw === 'porter' || raw === 'swot' || raw === 'tows') return 'analises';
  if (raw === 'voz-do-cliente') return 'consumidores';
  if (raw === 'empresa' || raw === 'equipe' || raw === 'privacidade-lgpd') return 'configuracoes';
  return raw as BetaSection;
}

interface MacroIndicator {
  code: string;
  label: string;
  value: string | null;
  unit: string;
  referenceDate: string | null;
  previousValue?: string | null;
  previousDate?: string | null;
  comparisonText?: string | null;
  source: string;
  sourceUrl?: string;
  status: 'ok' | 'unavailable';
  isStale?: boolean;
  lastKnownDate?: string | null;
  note: string;
}

interface WorkspaceBundle {
  company: {
    id: number;
    name: string;
    legalName: string;
    tradeName: string;
    cnpj: string;
    cnae: string;
    segment: string;
    companySize: string;
    registrationStatus: string;
    description: string;
    operationType: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    commercialEmail: string;
    website: string;
    logoUrl: string;
    latitude?: string;
    longitude?: string;
    placeId?: string;
  };
  role: string;
  units: Array<{ id: number; name: string; city: string; state: string; latitude?: string; longitude?: string; placeId?: string; isPrimary: boolean }>;
  members: Array<{ id: number; email: string; role: string; status: string }>;
  subscription: {
    planCode: PlanCode;
    billingCycle: BillingCycle;
    status: string;
    trialEndsAt: string;
    extraCompetitors: number;
    extraUnits: number;
    extraWhatsappPacks: number;
  };
  categories: Array<{ id: number; name: string; slug: string; description: string }>;
  products: Array<{
    id: number;
    categoryId: number | null;
    name: string;
    description: string;
    sku: string;
    priceCents: number;
    acquisitionCostCents: number;
    stockQty: number;
    soldUnits: number;
    status: string;
    imageUrl: string;
  }>;
  integrations: Array<{
    id: number;
    provider: string;
    connectionStatus: string;
    accountLabel: string;
    storeUrl: string;
    lastSyncAt: string | null;
    lastError: string;
  }>;
  imports: Array<{
    id: number;
    fileName: string;
    fileType: string;
    sourceOrigin: string;
    reliabilityLevel: string;
    rowCount: number;
    summaryText?: string;
    insightsJson?: Array<{ category: string; title: string; detail: string; kind: string }>;
    status: string;
    createdAt: string;
  }>;
  metrics: Array<{
    id: number;
    periodDate: string;
    revenueCents: number;
    ordersCount: number;
    avgTicketCents: number;
    grossMarginPct: string;
    lossesCents: number;
    sourceOrigin: string;
    reliabilityLevel: string;
  }>;
  competitors: Array<{
    id: number;
    name: string;
    segment: string;
    positioning: string;
    announcedPriceRange: string;
    shippingInfo: string;
    deliveryDays: string;
    publicRating: string;
    complaintsNote: string;
    lastChangeNote: string;
    sourceUrl?: string;
    channels?: string;
    priceComparison?: string;
    threatLevel?: string;
    reviewSnippetsJson?:
      | string[]
      | {
          snippets?: string[];
          locationDistance?: string;
          positivesNote?: string;
          negativesNote?: string;
          productsPromotions?: string;
          differentials?: string;
          threatsOpportunities?: string;
          consultedAt?: string;
        };
  }>;
  reviews: Array<{
    id: number;
    source: string;
    rating: number;
    sentiment: string;
    commentText: string;
    authorLabel: string;
    hasLgpdConsent: boolean;
    reviewedAt: string;
  }>;
  evidenceCards: Array<{
    id: number;
    moduleKey: string;
    title: string;
    externalFinding: string;
    internalDataUsed: string;
    source: string;
    referenceDate: string;
    method: string;
    scope: string;
    reliability: string;
    limitations: string;
    verificationNeeded: string;
    crossQualityScore: number;
    hasSufficientEvidence: boolean;
  }>;
  strategicItems: Array<{
    id: number;
    kind: string;
    category: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    impactNote: string;
    dueDate: string;
    metadataJson?: Record<string, unknown>;
  }>;
  simulations: Array<{
    id: number;
    name: string;
    scenarioType: string;
    horizonDays: number;
    projectionsJson: Record<string, unknown>;
    uncertaintyNote: string;
    hasSufficientData: boolean;
    createdAt: string;
  }>;
  reputationProfile?: {
    id: number;
    googlePlaceId: string;
    googlePlaceName: string;
    googleMapsUri: string;
    googleRating: string;
    googleRatingsTotal: number;
    googleSyncStatus: string;
    googleSyncNote: string;
    googleLastSyncedAt: string | null;
    reclameAquiUrl: string;
    reclameAquiScore: string;
    reclameAquiStatusLabel: string;
    reclameAquiResponseRatePct: string;
    reclameAquiSolvedRatePct: string;
    reclameAquiBackToBuyPct: string;
    reclameAquiComplaintsTotal: number;
    reclameAquiAnsweredTotal: number;
    reclameAquiCaptureStatus: string;
    reclameAquiCaptureNote: string;
    reclameAquiLastSyncedAt: string | null;
    aiDiagnosisJson?: Record<string, unknown>;
  } | null;
  financialSales?: FinancialSalesRow[];
  financialCosts?: FinancialCostRow[];
  financialExpenses?: FinancialExpenseRow[];
  inventoryItems?: InventoryControlRow[];
  financialSummary?: FinancialSummaryBundle;
  auditLogs: Array<{
    id: number;
    userEmail: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }>;
  lgpdRecords: Array<{
    id: number;
    recordType: string;
    status: string;
    scope: string;
    notes: string;
    createdAt: string;
  }>;
}

const NO_EVIDENCE_MSG =
  'A investigar — não tenho evidência suficiente para calcular este impacto.';

export const BetaWorkspace: React.FC = () => {
  const {
    firebaseUser,
    loading: authLoading,
    companies,
    activeCompanyId,
    setActiveCompanyId,
    preferences,
    updatePreferences,
    logout,
    apiFetch,
  } = useBetaAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const derivedSection = useMemo<BetaSection>(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return normalizeBetaSection(parts[2]);
  }, [location.pathname]);

  const [section, setSection] = useState<BetaSection>(derivedSection);
  useEffect(() => {
    setSection(derivedSection);
  }, [derivedSection]);
  const [workspace, setWorkspace] = useState<WorkspaceBundle | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Macro indicators (real BCB/IBGE/SEFAZ + historical series + AI sector reading)
  const [macroIndicators, setMacroIndicators] = useState<MacroIndicator[]>([]);
  const [ipcaHistory, setIpcaHistory] = useState<{
    labels: string[];
    values: number[];
    source: string;
  } | null>(null);
  const [selicHistory, setSelicHistory] = useState<{
    labels: string[];
    values: number[];
    source: string;
  } | null>(null);
  const [cambioHistory, setCambioHistory] = useState<{
    labels: string[];
    values: number[];
    source: string;
  } | null>(null);
  const [macroFetchedAt, setMacroFetchedAt] = useState<string>('');
  const [macroLoading, setMacroLoading] = useState(true);
  const [interpretingMacro, setInterpretingMacro] = useState(false);

  // Radar filters & AI Automation state
  const [radarTypeFilter, setRadarTypeFilter] = useState<string>('Todos');
  const [radarCatFilter, setRadarCatFilter] = useState<string>('Todas');
  const [generatingIntelligence, setGeneratingIntelligence] = useState(false);
  const [discoveringCompetitors, setDiscoveringCompetitors] = useState(false);
  const [autoBootstrapping, setAutoBootstrapping] = useState(false);
  const bootstrappedCompaniesRef = useRef<Set<number>>(new Set());
  const [discoveredMapsLinks, setDiscoveredMapsLinks] = useState<Array<{ title: string; uri: string }>>([]);
  const [discoveredSummary, setDiscoveredSummary] = useState('');

  // Product state
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [prodCategoryFilter, setProdCategoryFilter] = useState<string>('all');
  const [prodStatusFilter, setProdStatusFilter] = useState<string>('all');
  const [prodSort, setProdSort] = useState<'newest' | 'sales_desc' | 'price_asc' | 'price_desc' | 'stock_asc'>('newest');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    sku: '',
    categoryId: '',
    priceReais: '',
    costReais: '',
    stockQty: '',
    soldUnits: '',
    status: 'active',
    imageUrl: '',
  });
  const [catalogImportLoading, setCatalogImportLoading] = useState(false);
  const [catalogImportPreview, setCatalogImportPreview] = useState<{
    fileName: string;
    fileType: string;
    note: string;
    items: ParsedCatalogItem[];
  } | null>(null);
  const [salesImportLoading, setSalesImportLoading] = useState(false);
  const [salesMergeStrategy, setSalesMergeStrategy] = useState<'replace' | 'add'>('replace');
  const [salesImportPreview, setSalesImportPreview] = useState<{
    fileName: string;
    fileType: string;
    note: string;
    items: ParsedSalesItem[];
  } | null>(null);

  // Import & Manual Metrics state
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    fileType: string;
    reliability: string;
    note: string;
    documentSummary?: string;
    insights?: Array<{ category: string; title: string; detail: string; kind: string }>;
    rows: Array<{ periodDate: string; revenueReais: number; ordersCount: number; lossesReais: number; note: string }>;
  } | null>(null);
  const [importOrigin, setImportOrigin] = useState('Planilha interna');
  const [importLoading, setImportLoading] = useState(false);
  const [manualMetric, setManualMetric] = useState({
    periodDate: new Date().toISOString().slice(0, 10),
    revenueReais: '',
    ordersCount: '',
    grossMarginPct: '',
    lossesReais: '',
    sourceOrigin: 'Fechamento interno',
  });

  // Integration client credentials draft
  const [integrationClientIds, setIntegrationClientIds] = useState<Record<string, string>>({});

  // Competitor & Review state
  const [compForm, setCompForm] = useState({
    name: '',
    segment: '',
    positioning: '',
    announcedPriceRange: '',
    shippingInfo: '',
    deliveryDays: '',
    publicRating: '',
    complaintsNote: '',
  });
  const [reviewForm, setReviewForm] = useState({
    source: 'google',
    rating: 5,
    commentText: '',
    authorLabel: '',
    hasLgpdConsent: true,
  });
  const [aiReviewInterpretation, setAiReviewInterpretation] = useState<{
    hasSufficientData: boolean;
    summary: string;
    overallPerceptionDiagnosis?: string;
    satisfactionLevel?: string;
    positives?: Array<{ theme: string; frequency: string; example: string; source: string }>;
    recurringComplaints?: Array<{ theme: string; frequency: string; example: string; source: string }>;
    negatives?: Array<{ theme: string; frequency: string; example: string; source: string }>;
    improvementOpportunities?: string[];
    salesAndMarginImpact?: string;
    dataLimitations?: string;
    recommendations?: string[];
  } | null>(null);
  const [interpretingReviews, setInterpretingReviews] = useState(false);
  const [syncingGoogleReviews, setSyncingGoogleReviews] = useState(false);
  const [capturingReclameAqui, setCapturingReclameAqui] = useState(false);
  const [reclameAquiUrlInput, setReclameAquiUrlInput] = useState('');
  const googleSyncedCompaniesRef = useRef<Set<number>>(new Set());

  // Strategic tabs & forms
  const [analysisTab, setAnalysisTab] = useState<'swot' | 'pestel' | 'porter' | 'tows' | 'evidencias'>('swot');
  const [decisionFilter, setDecisionFilter] = useState<'aberto' | 'aprovada' | 'adiada' | 'recusada' | 'todas'>('aberto');
  const [planFilter, setPlanFilter] = useState<'todos' | 'a_fazer' | 'em_andamento' | 'concluido' | 'aguardando_decisao'>('todos');
  const [planReview, setPlanReview] = useState<{
    overallSummary: string;
    alerts: string[];
    recommendations: string[];
  } | null>(null);
  const [reviewingPlans, setReviewingPlans] = useState(false);
  const [stratForm, setStratForm] = useState({
    kind: 'pestel',
    category: 'Político',
    title: '',
    description: '',
    priority: 'media',
    impactNote: '',
  });
  const [evidenceForm, setEvidenceForm] = useState({
    moduleKey: 'geral',
    title: '',
    externalFinding: '',
    internalDataUsed: '',
    source: '',
    method: 'Cruzamento externo × interno',
    limitations: '',
    verificationNeeded: '',
  });

  // Lay-accessible Simulator state
  const [simForm, setSimForm] = useState({
    name: '',
    scenarioType: 'realista' as 'pessimista' | 'realista' | 'otimista',
    horizonDays: 90 as 30 | 90 | 180,
    inflacao: 4.5,
    selic: 11.25,
    cambio: 5.65,
    desemprego: 6.5,
    pibReal: 2.0,
    impostos: 18,
    crescimentoVendas: 8,
    productionIncreasePct: 10,
    currentProducedUnits: 250,
    estimatedDemandUnits: 260,
    fixedCostsReais: 6500,
    variableCostPerUnit: 55,
    marginalCostPerUnit: 55,
    marginalProductUnits: 50,
    unitPriceReais: 120,
    extraEmployeesCount: 0,
    employeeCostReais: 2600,
    targetProfitReais: 15000,
  });
  const [simulatorAdvice, setSimulatorAdvice] = useState<{
    verdictSimple: string;
    explanationSimple: string;
    worthIncreasingProductionAnswer?: string;
    worthHiringAnswer?: string;
    salesCompensateCostsAnswer?: string;
    costIncreaseImpactAnswer?: string;
    salesNeededForGoalAnswer?: string;
    profitabilityMeasuresAnswer?: string;
    suggestions: string[];
  } | null>(null);
  const [advisingSimulator, setAdvisingSimulator] = useState(false);

  // Full-page Assistant state
  const [fullAiInput, setFullAiInput] = useState('');
  const [fullAiLoading, setFullAiLoading] = useState(false);
  const [fullAiMessages, setFullAiMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sourcesUsed?: string[];
      groundingLinks?: Array<{ title: string; uri: string }>;
    }>
  >([]);

  // Company edit, Team invite, Config tab & Firestore User Preferences
  const [companyEdit, setCompanyEdit] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [configTab, setConfigTab] = useState<'empresa' | 'equipe' | 'preferencias' | 'lgpd'>('empresa');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [notifFilter, setNotifFilter] = useState('Todas');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  };

  const loadWorkspace = useCallback(async () => {
    if (!activeCompanyId) {
      setLoadingWorkspace(false);
      return;
    }
    setLoadingWorkspace(true);
    setWorkspaceError('');
    try {
      const data = await apiFetch<WorkspaceBundle>(
        `/api/beta/companies/${activeCompanyId}/workspace`
      );
      setWorkspace(data);
      setCompanyEdit({
        name: data.company.name,
        legalName: data.company.legalName,
        tradeName: data.company.tradeName,
        cnpj: data.company.cnpj,
        segment: data.company.segment,
        description: data.company.description,
        operationType: data.company.operationType,
        address: data.company.address,
        city: data.company.city,
        state: data.company.state,
        phone: data.company.phone,
        commercialEmail: data.company.commercialEmail,
        website: data.company.website,
        logoUrl: data.company.logoUrl,
      });
      setReclameAquiUrlInput(data.reputationProfile?.reclameAquiUrl || '');
      const savedDiag = data.reputationProfile?.aiDiagnosisJson as
        | { hasSufficientData?: boolean; summary?: string }
        | undefined;
      if (savedDiag && savedDiag.summary) {
        setAiReviewInterpretation(savedDiag as typeof aiReviewInterpretation);
      } else {
        setAiReviewInterpretation(null);
      }
      if (data.products.length > 0 || data.metrics.length > 0) {
        const avgPrice =
          data.products.length > 0
            ? data.products.reduce((s, p) => s + p.priceCents, 0) / data.products.length / 100
            : 0;
        const avgCost =
          data.products.length > 0
            ? data.products.reduce((s, p) => s + p.acquisitionCostCents, 0) / data.products.length / 100
            : 0;
        const avgOrders =
          data.metrics.length > 0
            ? Math.round(data.metrics.reduce((s, m) => s + m.ordersCount, 0) / data.metrics.length)
            : 0;
        setSimForm((prev) => ({
          ...prev,
          unitPriceReais: avgPrice > 0 ? Number(avgPrice.toFixed(2)) : prev.unitPriceReais,
          variableCostPerUnit:
            avgCost > 0
              ? Number(avgCost.toFixed(2))
              : avgPrice > 0
                ? Number((avgPrice * 0.45).toFixed(2))
                : prev.variableCostPerUnit,
          marginalCostPerUnit:
            avgCost > 0
              ? Number(avgCost.toFixed(2))
              : avgPrice > 0
                ? Number((avgPrice * 0.45).toFixed(2))
                : prev.marginalCostPerUnit,
          currentProducedUnits: avgOrders > 0 ? avgOrders : prev.currentProducedUnits,
          estimatedDemandUnits: avgOrders > 0 ? Math.round(avgOrders * 1.05) : prev.estimatedDemandUnits,
        }));
      }
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Erro ao carregar empresa.');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [activeCompanyId, apiFetch]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    let cancelled = false;
    setMacroLoading(true);
    const applyMacro = (d: {
      indicators?: MacroIndicator[];
      ipcaHistory?: { labels: string[]; values: number[]; source: string };
      selicHistory?: { labels: string[]; values: number[]; source: string };
      cambioHistory?: { labels: string[]; values: number[]; source: string };
      fetchedAt?: string;
    }) => {
      if (cancelled) return;
      if (Array.isArray(d.indicators)) {
        setMacroIndicators(d.indicators);
        const parseVal = (code: string) => {
          const item = d.indicators?.find((m) => m.code === code && m.status === 'ok');
          if (!item?.value) return null;
          const n = Number(String(item.value).replace(',', '.').replace(/[^\d.-]/g, ''));
          return Number.isFinite(n) ? n : null;
        };
        const selic = parseVal('SELIC');
        const ipca = parseVal('IPCA');
        const cambio = parseVal('CAMBIO');
        const desemp = parseVal('DESEMPREGO');
        const pibReal = parseVal('PIB_REAL');
        const icms = parseVal('ICMS');
        setSimForm((prev) => ({
          ...prev,
          selic: selic ?? prev.selic,
          inflacao: ipca ?? prev.inflacao,
          cambio: cambio ?? prev.cambio,
          desemprego: desemp ?? prev.desemprego,
          pibReal: pibReal ?? prev.pibReal,
          impostos: icms ?? prev.impostos,
        }));
      }
      if (d.ipcaHistory && Array.isArray(d.ipcaHistory.labels)) {
        setIpcaHistory(d.ipcaHistory);
      }
      if (d.selicHistory && Array.isArray(d.selicHistory.labels)) {
        setSelicHistory(d.selicHistory);
      }
      if (d.cambioHistory && Array.isArray(d.cambioHistory.labels)) {
        setCambioHistory(d.cambioHistory);
      }
      if (d.fetchedAt) {
        setMacroFetchedAt(d.fetchedAt);
      }
    };

    if (activeCompanyId) {
      apiFetch<{
        indicators?: MacroIndicator[];
        ipcaHistory?: { labels: string[]; values: number[]; source: string };
        selicHistory?: { labels: string[]; values: number[]; source: string };
        cambioHistory?: { labels: string[]; values: number[]; source: string };
        fetchedAt?: string;
      }>(`/api/beta/companies/${activeCompanyId}/macro`)
        .then(applyMacro)
        .catch(() =>
          fetch('/api/public/macro-indicators')
            .then((r) => r.json())
            .then(applyMacro)
            .catch(() => {})
        )
        .finally(() => {
          if (!cancelled) setMacroLoading(false);
        });
    } else {
      fetch('/api/public/macro-indicators')
        .then((r) => r.json())
        .then(applyMacro)
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setMacroLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, apiFetch]);

  // Automatic initial AI bootstrap (Google Maps competitors + Radar + SWOT/PESTEL/Porter/TOWS + Decisions)
  useEffect(() => {
    if (!workspace || !activeCompanyId) return;
    if (bootstrappedCompaniesRef.current.has(workspace.company.id)) return;
    const isFreshCompany =
      workspace.strategicItems.length === 0 &&
      workspace.competitors.length === 0 &&
      Boolean(workspace.company.segment || workspace.company.city || workspace.company.state);

    if (!isFreshCompany) {
      bootstrappedCompaniesRef.current.add(workspace.company.id);
      return;
    }

    bootstrappedCompaniesRef.current.add(workspace.company.id);
    let cancelled = false;
    setAutoBootstrapping(true);

    apiFetch<{
      discoveredCount: number;
      insertedCount: number;
      groundedLinks?: Array<{ title: string; uri: string }>;
      searchSummary?: string;
    }>(`/api/beta/companies/${workspace.company.id}/bootstrap`, {
      method: 'POST',
    })
      .then(async (res) => {
        if (cancelled) return;
        if (Array.isArray(res.groundedLinks)) setDiscoveredMapsLinks(res.groundedLinks);
        if (res.searchSummary) setDiscoveredSummary(res.searchSummary);
        await loadWorkspace();
        if (res.discoveredCount > 0 || res.insertedCount > 0) {
          showToast(
            `IA concluiu análise inicial: ${res.discoveredCount} concorrente(s) no Google Maps e ${res.insertedCount} item(ns) no Radar, Análises e Decisões.`
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAutoBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspace, activeCompanyId, apiFetch, loadWorkspace]);

  // Automatic Google Reviews capture after registration/login when reputation profile is pending
  useEffect(() => {
    if (!workspace || !activeCompanyId || autoBootstrapping) return;
    if (googleSyncedCompaniesRef.current.has(workspace.company.id)) return;
    const prof = workspace.reputationProfile;
    const needsAutoGoogleSync = !prof || prof.googleSyncStatus === 'pending';
    if (!needsAutoGoogleSync) {
      googleSyncedCompaniesRef.current.add(workspace.company.id);
      return;
    }

    googleSyncedCompaniesRef.current.add(workspace.company.id);
    let cancelled = false;
    setSyncingGoogleReviews(true);
    apiFetch<{ insertedReviewsCount?: number; syncStatus?: string }>(
      `/api/beta/companies/${workspace.company.id}/reviews/sync-google`,
      { method: 'POST' }
    )
      .then(async (res) => {
        if (cancelled) return;
        await loadWorkspace();
        if (res.insertedReviewsCount && res.insertedReviewsCount > 0) {
          showToast(
            `${res.insertedReviewsCount} avaliação(ões) pública(s) encontrada(s) no Google Reviews para ${workspace.company.name}.`
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSyncingGoogleReviews(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspace, activeCompanyId, autoBootstrapping, apiFetch, loadWorkspace]);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      navigate('/beta/login');
    } else if (!authLoading && firebaseUser && companies.length === 0) {
      navigate('/beta/onboarding');
    }
  }, [authLoading, firebaseUser, companies.length, navigate]);

  const goToSection = (next: BetaSection) => {
    setSection(next);
    setSelectedProductId(null);
    navigate(`/beta/app/${next}`);
  };

  const uploadCompanyImage = async (file: File): Promise<string> => {
    if (!activeCompanyId) throw new Error('Empresa não selecionada.');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
      reader.readAsDataURL(file);
    });
    const res = await apiFetch<{ url: string }>(`/api/beta/companies/${activeCompanyId}/assets`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        dataBase64: base64,
      }),
    });
    return res.url;
  };

  const filteredProducts = useMemo(() => {
    if (!workspace) return [];
    const q = searchQuery.toLowerCase();
    const list = workspace.products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      const matchCat =
        prodCategoryFilter === 'all' || String(p.categoryId || '') === prodCategoryFilter;
      const matchStatus = prodStatusFilter === 'all' || p.status === prodStatusFilter;
      return matchSearch && matchCat && matchStatus;
    });

    return [...list].sort((a, b) => {
      if (prodSort === 'sales_desc') return (b.soldUnits || 0) - (a.soldUnits || 0);
      if (prodSort === 'price_asc') return a.priceCents - b.priceCents;
      if (prodSort === 'price_desc') return b.priceCents - a.priceCents;
      if (prodSort === 'stock_asc') return a.stockQty - b.stockQty;
      return b.id - a.id;
    });
  }, [workspace, searchQuery, prodCategoryFilter, prodStatusFilter, prodSort]);

  const productSalesStats = useMemo(() => {
    const list = workspace?.products || [];
    const ranked = [...list].sort((a, b) => {
      const diff = (b.soldUnits || 0) - (a.soldUnits || 0);
      if (diff !== 0) return diff;
      return (b.soldUnits || 0) * b.priceCents - (a.soldUnits || 0) * a.priceCents;
    });
    const totalSoldUnits = ranked.reduce((acc, p) => acc + (p.soldUnits || 0), 0);
    const totalEstimatedRevenue = ranked.reduce(
      (acc, p) => acc + (p.soldUnits || 0) * (p.priceCents / 100),
      0
    );
    const topProduct = ranked.find((p) => (p.soldUnits || 0) > 0) || null;
    const criticalTopSellers = ranked.filter(
      (p) => (p.soldUnits || 0) > 0 && p.stockQty <= Math.max(5, Math.round((p.soldUnits || 0) * 0.15))
    );
    const chartData = ranked
      .filter((p) => (p.soldUnits || 0) > 0 || p.stockQty > 0)
      .slice(0, 8)
      .map((p) => ({
        label: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name,
        value: p.soldUnits || 0,
        secondaryValue: p.stockQty,
        hint: `${p.name} — Vendidas: ${p.soldUnits || 0} un. | Estoque atual: ${p.stockQty} un.`,
      }));
    return {
      ranked,
      totalSoldUnits,
      totalEstimatedRevenue,
      topProduct,
      criticalTopSellersCount: criticalTopSellers.length,
      chartData,
    };
  }, [workspace?.products]);

  const selectedProduct = useMemo(
    () => workspace?.products.find((p) => p.id === selectedProductId) || null,
    [workspace, selectedProductId]
  );

  const crossQuality = useMemo(() => {
    if (!workspace) return { score: 0, label: 'Insuficiente' };
    let score = 0;
    if (workspace.products.length > 0) score += 25;
    if (workspace.metrics.length > 0) score += 30;
    if (workspace.competitors.length > 0) score += 15;
    if (workspace.reviews.length > 0) score += 15;
    if (macroIndicators.some((m) => m.status === 'ok')) score += 15;
    const label = score >= 75 ? 'Alta' : score >= 45 ? 'Parcial' : 'Insuficiente';
    return { score, label };
  }, [workspace, macroIndicators]);

  const reviewChartData = useMemo(() => {
    if (!workspace || workspace.reviews.length === 0) return [];
    const bySource: Record<string, { pos: number; neg: number }> = {};
    for (const r of workspace.reviews) {
      if (!bySource[r.source]) bySource[r.source] = { pos: 0, neg: 0 };
      if (r.rating >= 4) bySource[r.source].pos += 1;
      else bySource[r.source].neg += 1;
    }
    return Object.entries(bySource).map(([source, counts]) => ({
      label: source,
      value: counts.pos,
      secondaryValue: counts.neg,
    }));
  }, [workspace]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    try {
      if (editingProductId) {
        await apiFetch(`/api/beta/companies/${activeCompanyId}/products/${editingProductId}`, {
          method: 'PATCH',
          body: JSON.stringify(prodForm),
        });
        showToast('Produto atualizado.');
      } else {
        await apiFetch(`/api/beta/companies/${activeCompanyId}/products`, {
          method: 'POST',
          body: JSON.stringify(prodForm),
        });
        showToast('Produto cadastrado.');
      }
      setProductModalOpen(false);
      setEditingProductId(null);
      setProdForm({
        name: '',
        description: '',
        sku: '',
        categoryId: '',
        priceReais: '',
        costReais: '',
        stockQty: '',
        soldUnits: '',
        status: 'active',
        imageUrl: '',
      });
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!activeCompanyId) return;
    try {
      await apiFetch(`/api/beta/companies/${activeCompanyId}/products/${id}`, {
        method: 'DELETE',
      });
      setSelectedProductId(null);
      showToast('Produto excluído.');
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir produto.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !newCategoryName.trim()) return;
    try {
      await apiFetch(`/api/beta/companies/${activeCompanyId}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setNewCategoryName('');
      showToast('Categoria adicionada.');
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar categoria.');
    }
  };

  const handleProductSpreadsheetOrPdfUpload = async (
    mode: 'catalog' | 'sales',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeCompanyId) return;

    const setLoading = mode === 'catalog' ? setCatalogImportLoading : setSalesImportLoading;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);

      if (isSpreadsheet) {
        const buffer = await file.arrayBuffer();
        if (mode === 'catalog') {
          const parsed = parseCatalogSpreadsheet(buffer);
          if (parsed.items.length > 0) {
            setCatalogImportPreview({
              fileName: file.name,
              fileType: ext,
              note: `${parsed.items.length} produto(s) identificado(s) na planilha. Revise os dados abaixo e confirme para salvar no catálogo.`,
              items: parsed.items,
            });
            return;
          }
          // AI fallback for non-standard spreadsheet headers
          const extracted = await apiFetch<{ note: string; items: ParsedCatalogItem[] }>(
            `/api/beta/companies/${activeCompanyId}/products/extract-import`,
            {
              method: 'POST',
              body: JSON.stringify({
                mode: 'catalog',
                fileName: file.name,
                mimeType: 'text/csv',
                textContent: parsed.csvPreview,
              }),
            }
          );
          if (!extracted.items?.length) {
            showToast('Nenhum produto identificado na planilha. Use o modelo Excel ou verifique as colunas (Código, Nome, Preço).');
            return;
          }
          setCatalogImportPreview({
            fileName: file.name,
            fileType: ext,
            note: extracted.note,
            items: extracted.items,
          });
        } else {
          const parsed = parseSalesUnitsSpreadsheet(buffer);
          if (parsed.items.length > 0) {
            setSalesImportPreview({
              fileName: file.name,
              fileType: ext,
              note: `${parsed.items.length} item(ns) com unidades vendidas encontrado(s) na planilha. Confira antes de aplicar ao ranking.`,
              items: parsed.items,
            });
            return;
          }
          const extracted = await apiFetch<{ note: string; items: ParsedSalesItem[] }>(
            `/api/beta/companies/${activeCompanyId}/products/extract-import`,
            {
              method: 'POST',
              body: JSON.stringify({
                mode: 'sales',
                fileName: file.name,
                mimeType: 'text/csv',
                textContent: parsed.csvPreview,
              }),
            }
          );
          if (!extracted.items?.length) {
            showToast('Nenhuma unidade vendida identificada na planilha. Verifique as colunas (Código/Nome e Unidades Vendidas).');
            return;
          }
          setSalesImportPreview({
            fileName: file.name,
            fileType: ext,
            note: extracted.note,
            items: extracted.items,
          });
        }
      } else {
        // PDF or image / text document interpreted via AI
        const isText = file.type.startsWith('text/') || ['txt', 'md'].includes(ext);
        const base64Data = !isText
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
              reader.readAsDataURL(file);
            })
          : undefined;
        const textContent = isText ? await file.text() : undefined;

        if (mode === 'catalog') {
          const extracted = await apiFetch<{ note: string; items: ParsedCatalogItem[] }>(
            `/api/beta/companies/${activeCompanyId}/products/extract-import`,
            {
              method: 'POST',
              body: JSON.stringify({
                mode: 'catalog',
                fileName: file.name,
                mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
                base64Data,
                textContent,
              }),
            }
          );
          if (!extracted.items?.length) {
            showToast('Não foi possível extrair produtos deste PDF. Confira se o texto está legível ou use uma planilha Excel.');
            return;
          }
          setCatalogImportPreview({
            fileName: file.name,
            fileType: ext || 'pdf',
            note: extracted.note,
            items: extracted.items,
          });
        } else {
          const extracted = await apiFetch<{ note: string; items: ParsedSalesItem[] }>(
            `/api/beta/companies/${activeCompanyId}/products/extract-import`,
            {
              method: 'POST',
              body: JSON.stringify({
                mode: 'sales',
                fileName: file.name,
                mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
                base64Data,
                textContent,
              }),
            }
          );
          if (!extracted.items?.length) {
            showToast('Não foi possível extrair unidades vendidas deste PDF. Verifique se há tabela de produtos e quantidades.');
            return;
          }
          setSalesImportPreview({
            fileName: file.name,
            fileType: ext || 'pdf',
            note: extracted.note,
            items: extracted.items,
          });
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProductImport = async (mode: 'catalog' | 'sales') => {
    if (!activeCompanyId) return;
    if (mode === 'catalog' && !catalogImportPreview) return;
    if (mode === 'sales' && !salesImportPreview) return;

    const setLoading = mode === 'catalog' ? setCatalogImportLoading : setSalesImportLoading;
    setLoading(true);
    try {
      const payload =
        mode === 'catalog'
          ? {
              mode: 'catalog' as const,
              fileName: catalogImportPreview!.fileName,
              fileType: catalogImportPreview!.fileType,
              items: catalogImportPreview!.items,
            }
          : {
              mode: 'sales' as const,
              fileName: salesImportPreview!.fileName,
              fileType: salesImportPreview!.fileType,
              mergeStrategy: salesMergeStrategy,
              items: salesImportPreview!.items,
            };

      const res = await apiFetch<{
        createdCount: number;
        updatedCount: number;
        summaryText: string;
      }>(`/api/beta/companies/${activeCompanyId}/products/import-confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (mode === 'catalog') setCatalogImportPreview(null);
      else setSalesImportPreview(null);

      showToast(res.summaryText || 'Importação concluída.');
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao confirmar importação.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompanyId) return;
    setImportLoading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const mapped = jsonRows.slice(0, 50).map((r) => ({
          periodDate: String(r.Data_YYYY_MM_DD || r.data || r.Data || new Date().toISOString().slice(0, 10)),
          revenueReais: Number(r.Faturamento_Reais || r.faturamento || r.vendas || 0),
          ordersCount: Number(r.Quantidade_Pedidos || r.pedidos || 0),
          lossesReais: Number(r.Perdas_Reais || r.perdas || 0),
          note: String(r.Observacao || r.observacao || file.name),
        }));

        const csvPreview = XLSX.utils.sheet_to_csv(sheet).slice(0, 12000);
        let aiSummary = `Planilha ${file.name} com ${mapped.length} lançamento(s) financeiros.`;
        let aiInsights: Array<{ category: string; title: string; detail: string; kind: string }> = [];
        try {
          const extracted = await apiFetch<{
            documentSummary?: string;
            insights?: Array<{ category: string; title: string; detail: string; kind: string }>;
          }>(`/api/beta/companies/${activeCompanyId}/imports/extract`, {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              mimeType: 'text/csv',
              textContent: csvPreview,
            }),
          });
          if (extracted.documentSummary) aiSummary = extracted.documentSummary;
          if (Array.isArray(extracted.insights)) aiInsights = extracted.insights;
        } catch {
          // Fallback to deterministic spreadsheet summary cleanly
        }

        setImportPreview({
          fileName: file.name,
          fileType: ext,
          reliability: 'alta',
          note: `${mapped.length} linha(s) lida(s) da planilha. Ao confirmar, a IA atualizará Radar, Análises e Decisões automaticamente.`,
          documentSummary: aiSummary,
          insights: aiInsights,
          rows: mapped,
        });
      } else {
        const isText = file.type.startsWith('text/') || ['txt', 'md'].includes(ext);
        const base64 = !isText
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
              reader.readAsDataURL(file);
            })
          : undefined;
        const textContent = isText ? await file.text() : undefined;
        const extracted = await apiFetch<{
          reliability: string;
          extractionNote: string;
          documentSummary?: string;
          insights?: Array<{ category: string; title: string; detail: string; kind: string }>;
          rows: Array<{ periodDate: string; revenueReais: number; ordersCount: number; lossesReais: number; note: string }>;
        }>(`/api/beta/companies/${activeCompanyId}/imports/extract`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || (isText ? 'text/plain' : 'application/pdf'),
            base64Data: base64,
            textContent,
          }),
        });
        setImportPreview({
          fileName: file.name,
          fileType: file.type.startsWith('image/') ? 'image' : isText ? 'txt' : 'pdf',
          reliability: extracted.reliability || 'media',
          note: extracted.extractionNote || 'Prévia extraída pela IA. Ao confirmar, Radar, Análises e Decisões serão atualizados automaticamente.',
          documentSummary: extracted.documentSummary || '',
          insights: extracted.insights || [],
          rows: extracted.rows || [],
        });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!activeCompanyId || !importPreview) return;
    setGeneratingIntelligence(true);
    try {
      const res = await apiFetch<{ generatedCount?: number }>(
        `/api/beta/companies/${activeCompanyId}/imports/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            fileName: importPreview.fileName,
            fileType: importPreview.fileType,
            sourceOrigin: importOrigin,
            reliabilityLevel: importPreview.reliability,
            summaryText: importPreview.documentSummary || importPreview.note,
            insights: importPreview.insights || [],
            rows: importPreview.rows,
          }),
        }
      );
      setImportPreview(null);
      const count = res.generatedCount || 0;
      showToast(
        count > 0
          ? `Documento gravado e interpretado pela IA! ${count} nova(s) atualização(ões) enviada(s) para Radar, Análises e Decisões.`
          : 'Documento e descobertas gravados no banco da empresa e cruzados pela IA.'
      );
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao confirmar importação.');
    } finally {
      setGeneratingIntelligence(false);
    }
  };

  const handleGenerateIntelligence = async (focus: 'all' | 'radar' | 'strategy' = 'all') => {
    if (!activeCompanyId || generatingIntelligence) return;
    setGeneratingIntelligence(true);
    try {
      const res = await apiFetch<{
        insertedCount: number;
        groundedWebSources?: Array<{ title: string; uri: string }>;
      }>(`/api/beta/companies/${activeCompanyId}/intelligence/generate`, {
        method: 'POST',
        body: JSON.stringify({ focus }),
      });
      showToast(
        res.insertedCount > 0
          ? `IA atualizou a plataforma com ${res.insertedCount} novo(s) item(ns) no Radar, Análises e Decisões.`
          : 'Inteligência já está atualizada com os dados e documentos atuais.'
      );
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao gerar inteligência com IA.');
    } finally {
      setGeneratingIntelligence(false);
    }
  };

  const handleDiscoverCompetitors = async () => {
    if (!activeCompanyId || discoveringCompetitors) return;
    setDiscoveringCompetitors(true);
    try {
      const res = await apiFetch<{
        savedCount: number;
        skippedByLimit: number;
        groundedLinks?: Array<{ title: string; uri: string }>;
        searchSummary?: string;
      }>(`/api/beta/companies/${activeCompanyId}/competitors/discover`, {
        method: 'POST',
      });
      if (Array.isArray(res.groundedLinks)) setDiscoveredMapsLinks(res.groundedLinks);
      if (res.searchSummary) setDiscoveredSummary(res.searchSummary);
      const limitNote =
        res.skippedByLimit > 0
          ? ` (${res.skippedByLimit} ignorado(s) pelo limite do plano atual)`
          : '';
      showToast(
        res.savedCount > 0
          ? `${res.savedCount} concorrente(s) da região localizado(s) via Google Maps${limitNote}.`
          : `Busca concluída no Google Maps.${limitNote}`
      );
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao buscar concorrentes na região.');
    } finally {
      setDiscoveringCompetitors(false);
    }
  };

  const askFullAssistant = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || !activeCompanyId || fullAiLoading) return;
    const next = [...fullAiMessages, { role: 'user' as const, content: q }];
    setFullAiMessages(next);
    setFullAiInput('');
    setFullAiLoading(true);
    try {
      const res = await apiFetch<{
        answer: string;
        sourcesUsed?: string[];
        groundingLinks?: Array<{ title: string; uri: string }>;
      }>(`/api/beta/companies/${activeCompanyId}/assistant`, {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          screenContext: 'Assistente de Inteligência (Página Dedicada)',
          history: next,
        }),
      });
      setFullAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          sourcesUsed: res.sourcesUsed,
          groundingLinks: res.groundingLinks,
        },
      ]);
    } catch (err) {
      setFullAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'Não foi possível concluir a consulta agora. Tente novamente em instantes.',
        },
      ]);
    } finally {
      setFullAiLoading(false);
    }
  };

  const buildExecutiveReportPayload = () => {
    if (!workspace) return null;
    const revTotal = workspace.metrics.reduce((acc, m) => acc + m.revenueCents / 100, 0);
    const radarAll = workspace.strategicItems.filter((s) => s.kind === 'radar');
    const analysesAll = workspace.strategicItems.filter((s) => s.kind === 'analysis');
    const oppsAll = workspace.strategicItems.filter((s) => s.kind === 'opportunity');
    const decisionsAll = workspace.strategicItems.filter((s) => s.kind === 'decision');
    const approvedDecs = decisionsAll.filter((s) => s.status === 'aprovada');
    const plansAll = workspace.strategicItems.filter((s) => s.kind === 'action_plan');

    return {
      companyName: workspace.company.name,
      environmentLabel: 'BETA — Plataforma em fase de testes',
      generatedAt: new Date().toLocaleDateString('pt-BR'),
      companyDiagnosis: [
        `Empresa: ${workspace.company.name} | Segmento: ${workspace.company.segment || 'Não informado'} | Local: ${workspace.company.city || '-'}/${workspace.company.state || '-'}`,
        `Catálogo: ${workspace.products.length} produto(s) em ${workspace.categories.length} categoria(s) | Avaliações registradas: ${workspace.reviews.length}`,
        workspace.metrics.length > 0
          ? `Receita registrada acumulada: R$ ${revTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${workspace.metrics.length} período(s).`
          : 'Sem série financeira numérica lançada até o momento.',
        `Documentos e relatórios analisados: ${workspace.imports.length} arquivo(s) | Qualidade do cruzamento: ${crossQuality.score}/100 (${crossQuality.label}).`,
      ],
      marketSummary:
        radarAll.length > 0
          ? radarAll.slice(0, 6).map((r) => `[${r.category || 'Setor'}] ${r.title}: ${r.description}`)
          : ['Execute "Atualizar Radar com IA" para consolidar sinais de mercado do setor.'],
      competitorAnalyses: workspace.competitors.map((c) => {
        const dossier = !Array.isArray(c.reviewSnippetsJson) && c.reviewSnippetsJson
          ? (c.reviewSnippetsJson as Record<string, unknown>)
          : {};
        return {
          name: c.name,
          threatLevel: c.threatLevel || 'Impacto médio',
          summary: `${String(dossier.locationDistance || c.positioning || c.segment || '')} | Nota: ${c.publicRating || 'N/A'} | Elogios: ${String(dossier.positivesNote || 'N/A')} | Reclamações: ${c.complaintsNote || 'N/A'}`,
        };
      }),
      indicators: [
        ...macroIndicators.map((m) => ({
          label: m.label,
          value: m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível no momento',
          source: m.source,
          date: m.referenceDate || '-',
        })),
        {
          label: 'Qualidade do Cruzamento (Externo × Interno)',
          value: `${crossQuality.score}/100 (${crossQuality.label})`,
          source: 'Auditoria de completude interna',
          date: new Date().toLocaleDateString('pt-BR'),
        },
      ],
      threatsAndOpportunities: [
        ...oppsAll.map((o) => ({ kind: 'oportunidade', title: o.title, summary: o.description || o.impactNote })),
        ...radarAll
          .filter((r) => {
            const sig = String((r.metadataJson as Record<string, unknown>)?.signalKind || '');
            return sig === 'ameaca' || sig === 'oportunidade';
          })
          .map((r) => ({
            kind: String((r.metadataJson as Record<string, unknown>)?.signalKind || 'ameaca'),
            title: r.title,
            summary: r.description || r.impactNote,
          })),
      ],
      analyses:
        analysesAll.length > 0
          ? analysesAll.map((s) => ({
              title: s.title,
              summary: s.description || s.impactNote || s.status,
            }))
          : [{ title: 'Análises estratégicas', summary: NO_EVIDENCE_MSG }],
      approvedDecisions: approvedDecs.map((d) => ({
        title: d.title,
        outcome: d.impactNote || d.description || '-',
        dueDate: d.dueDate || '-',
      })),
      recommendations: decisionsAll.map((d) => ({
        title: `${d.title} (${d.status})`,
        impact: d.impactNote || 'A confirmar com métricas internas',
        priority: d.priority,
      })),
      actionPlansSummary: plansAll.map((p) => ({
        title: p.title,
        status: p.status,
        owner: String((p.metadataJson as Record<string, unknown>)?.owner || workspace.company.name),
        dueDate: p.dueDate || 'Sem prazo',
      })),
      kpiSummary: [
        { group: 'Inteligência interna', label: 'Documentos analisados', value: String(workspace.imports.length) },
        { group: 'Inteligência interna', label: 'Relatórios interpretados', value: String(workspace.imports.filter((i) => i.summaryText || (i.insightsJson && i.insightsJson.length > 0)).length) },
        { group: 'Inteligência interna', label: 'Descobertas relevantes', value: String(workspace.imports.reduce((acc, i) => acc + (Array.isArray(i.insightsJson) ? i.insightsJson.length : 0), 0) + analysesAll.length) },
        { group: 'Inteligência interna', label: 'Recomendações geradas', value: String(decisionsAll.length + oppsAll.length) },
        { group: 'Ambiente externo', label: 'Notícias verificadas', value: String(radarAll.length) },
        { group: 'Ambiente externo', label: 'Ameaças identificadas', value: String(radarAll.filter((r) => String((r.metadataJson as Record<string, unknown>)?.signalKind) === 'ameaca').length) },
        { group: 'Ambiente externo', label: 'Movimentações de mercado', value: String(radarAll.filter((r) => ['movimento', 'movimentacao'].includes(String((r.metadataJson as Record<string, unknown>)?.signalKind))).length) },
        { group: 'Ambiente externo', label: 'Informações pendentes', value: String(workspace.strategicItems.filter((s) => s.kind === 'verificar' && s.status === 'aberto').length) },
        { group: 'Gestão estratégica', label: 'Recomendações aguardando aprovação', value: String(decisionsAll.filter((d) => d.status === 'aberto').length) },
        { group: 'Gestão estratégica', label: 'Decisões aprovadas', value: String(approvedDecs.length) },
        { group: 'Gestão estratégica', label: 'Ações em andamento', value: String(plansAll.filter((p) => p.status !== 'concluido').length) },
      ],
      sources: [
        `Dados privados: ${workspace.company.name}`,
        ...macroIndicators.filter((m) => m.status === 'ok').map((m) => m.source),
        'Google Maps & Google Search Grounding (quando consultados)',
      ],
      limitations: [
        workspace.metrics.length === 0
          ? 'Sem série financeira/vendas interna importada para cálculo completo de impacto.'
          : 'Projeções dependem da acurácia e atualização dos lançamentos internos.',
        'Preços anunciados de concorrentes não representam preços efetivamente praticados.',
      ],
    };
  };

  const handleExportPdf = () => {
    const payload = buildExecutiveReportPayload();
    if (payload) exportExecutiveReportPDF(payload);
  };

  const handleExportExcel = () => {
    const payload = buildExecutiveReportPayload();
    if (payload) exportExecutiveReportExcel(payload);
  };

  const handleInterpretMacro = async () => {
    if (!activeCompanyId || interpretingMacro) return;
    setInterpretingMacro(true);
    try {
      const res = await apiFetch<{ interpretations?: unknown[] }>(
        `/api/beta/companies/${activeCompanyId}/macro/interpret`,
        { method: 'POST' }
      );
      showToast(
        res.interpretations && res.interpretations.length > 0
          ? `IA interpretou ${res.interpretations.length} indicador(es) econômico(s) para o seu segmento.`
          : 'Cenário econômico analisado.'
      );
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao interpretar cenário econômico.');
    } finally {
      setInterpretingMacro(false);
    }
  };

  const handleReviewActionPlans = async () => {
    if (!activeCompanyId || reviewingPlans) return;
    setReviewingPlans(true);
    try {
      const res = await apiFetch<{
        overallSummary: string;
        alerts: string[];
        recommendations: string[];
      }>(`/api/beta/companies/${activeCompanyId}/action-plans/review`, { method: 'POST' });
      setPlanReview(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao revisar planos de ação com IA.');
    } finally {
      setReviewingPlans(false);
    }
  };

  if (authLoading || loadingWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)]">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin text-[#20C5D5]" />
          <span>Carregando ambiente privado...</span>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[var(--bg-main)] text-[var(--text-primary)]">
        <BetaBadge />
        <p className="text-sm text-[var(--text-secondary)]">
          {workspaceError || 'Nenhuma empresa selecionada para esta conta.'}
        </p>
        <Link
          to="/beta/onboarding"
          className="rounded-lg bg-[#20C5D5] px-5 py-2.5 text-xs font-semibold text-[#06132D]"
        >
          Cadastrar empresa agora
        </Link>
      </div>
    );
  }

  const currentPlan = PLANS_CONFIG[workspace.subscription?.planCode || 'profissional'];
  const competitorLimit =
    currentPlan.limits.competitorsMax + (workspace.subscription?.extraCompetitors || 0);
  const totalRevenueReais = workspace.metrics.reduce((acc, m) => acc + m.revenueCents / 100, 0);
  const totalOrders = workspace.metrics.reduce((acc, m) => acc + m.ordersCount, 0);
  const hasInternalMetrics =
    workspace.metrics.length > 0 || Boolean(workspace.financialSummary?.hasData);

  const pendingDecisions = workspace.strategicItems.filter(
    (s) => s.kind === 'decision' && s.status === 'aberto'
  );
  const pendingVerification = workspace.strategicItems.filter(
    (s) => s.kind === 'verificar' && s.status === 'aberto'
  );
  const opportunitiesList = workspace.strategicItems.filter((s) => s.kind === 'opportunity');
  const openActions = workspace.strategicItems.filter(
    (s) => s.kind === 'action_plan' && s.status !== 'concluido'
  );

  const navGroups: NavGroup[] = [
    {
      title: 'VISÃO GERAL',
      items: [{ id: 'painel', label: 'Visão geral', icon: LayoutDashboard }],
    },
    {
      title: 'INTELIGÊNCIA INTERNA',
      items: [
        { id: 'documentos', label: 'Documentos e relatórios', icon: FileText, badgeCount: workspace.imports.length },
        { id: 'dados-empresa', label: 'Dados da empresa', icon: Database },
        { id: 'produtos', label: 'Produtos e estoque', icon: Package },
        { id: 'gestao-financeira', label: 'Vendas, DRE e Estoque', icon: BarChart3 },
        { id: 'consumidores', label: 'Consumidores', icon: Users },
      ],
    },
    {
      title: 'INTELIGÊNCIA EXTERNA',
      items: [
        { id: 'radar', label: 'Radar de mercado', icon: Radar },
        { id: 'macro', label: 'Ambiente macroeconômico', icon: Globe },
        { id: 'verificar', label: 'Informações a verificar', icon: Search, badgeCount: pendingVerification.length },
        { id: 'concorrentes', label: 'Concorrentes', icon: Target },
        { id: 'inteligencia-geo', label: 'Inteligência Geográfica', icon: MapPin },
      ],
    },
    {
      title: 'ESTRATÉGIA E DECISÃO',
      items: [
        { id: 'analises', label: 'Análises estratégicas', icon: BarChart3 },
        { id: 'decisoes', label: 'Central de decisões', icon: CheckCircle2, badgeCount: pendingDecisions.length },
        { id: 'planos-acao', label: 'Planos de ação', icon: Briefcase },
        { id: 'oportunidades', label: 'Oportunidades', icon: Lightbulb },
        { id: 'simulador', label: 'Simulador de cenários', icon: Sliders },
        { id: 'assistente', label: 'Assistente de inteligência', icon: Bot },
      ],
    },
    {
      title: 'DESEMPENHO',
      items: [
        { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
        { id: 'indicadores', label: 'Indicadores', icon: Activity },
      ],
    },
    {
      title: 'CONTA',
      items: [
        { id: 'historico', label: 'Histórico e notificações', icon: Bell },
        { id: 'plano', label: 'Minha assinatura', icon: CreditCard },
        { id: 'configuracoes', label: 'Configurações e LGPD', icon: Settings },
      ],
    },
  ];

  const activeScreenTitle =
    navGroups.flatMap((g) => g.items).find((i) => i.id === section)?.label || 'Visão geral';

  const metricsSeriesLabels = [...workspace.metrics]
    .slice(0, 6)
    .reverse()
    .map((m) => m.periodDate);
  const metricsSeriesValues = [...workspace.metrics]
    .slice(0, 6)
    .reverse()
    .map((m) => Number((m.revenueCents / 100).toFixed(0)));

  return (
    <AppShell
      navGroups={navGroups}
      activeId={section}
      onSelect={(id) => goToSection(id as BetaSection)}
      companyName={workspace.company.name}
      companySegment={workspace.company.segment || 'Empresa Beta'}
      periodLabel={`Qualidade ${crossQuality.score}/100`}
      environmentTag="BETA — Plataforma em fase de testes"
      isDemo={false}
      userInitial={(firebaseUser?.email?.[0] || 'U').toUpperCase()}
      notificationCount={pendingDecisions.length + pendingVerification.length}
      onOpenNotifications={() => goToSection('historico')}
      onOpenHelp={() => window.dispatchEvent(new CustomEvent('gemeo-open-assistant'))}
      topExtra={
        companies.length > 1 ? (
          <select
            value={activeCompanyId || ''}
            onChange={(e) => setActiveCompanyId(Number(e.target.value))}
            aria-label="Trocar empresa"
            className="hidden sm:block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : undefined
      }
      sidebarPlanBox={
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[#102B50]/70 p-3 text-xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            SEU PLANO
          </div>
          <div className="font-bold text-white">{currentPlan.name}</div>
          <button
            type="button"
            onClick={() => goToSection('plano')}
            className="text-[11px] font-medium text-[#20C5D5] hover:underline cursor-pointer"
          >
            Gerenciar assinatura
          </button>
        </div>
      }
      sidebarFooter={
        <div className="space-y-1.5">
          <Link
            to="/beta/onboarding"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:border-[#20C5D5]"
          >
            <Plus className="h-3.5 w-3.5 text-[#20C5D5]" />
            <span>Nova empresa</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair da conta</span>
          </button>
        </div>
      }
      mobileBottomItems={[
        { id: 'painel', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'produtos', label: 'Produtos', icon: Package },
        { id: 'macro', label: 'Macro', icon: Globe },
        { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
      ]}
    >
      {autoBootstrapping && (
        <div className="flex items-center gap-2 rounded-lg border border-[#20C5D5]/40 bg-[#15365F]/80 px-4 py-2.5 text-xs font-medium text-[#20C5D5]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>
            A IA está analisando automaticamente {workspace.company.name}, localizando concorrentes no Google Maps e preenchendo Radar, Análises e Decisões...
          </span>
        </div>
      )}
      {toast && (
        <div className="rounded-lg border border-[#20C5D5]/40 bg-[#15365F] px-4 py-2.5 text-xs font-medium text-[#20C5D5]">
          {toast}
        </div>
      )}

      {/* ================================================================ */}
      {/* VISÃO GERAL                                                      */}
      {/* ================================================================ */}
      {section === 'painel' && (
        <div className="space-y-6">
          <PageHeader
            kicker="PAINEL DO GESTOR"
            title={`Olá, ${firebaseUser?.displayName || workspace.company.name}.`}
            description="Resumo real do ambiente privado da sua empresa conectado às fontes oficiais e inteligência por IA."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={generatingIntelligence}
                  onClick={() => handleGenerateIntelligence('all')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  {generatingIntelligence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{generatingIntelligence ? 'Gerando com IA...' : 'Atualizar Inteligência com IA'}</span>
                </button>
                <BetaBadge />
              </div>
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <KpiStatCard
              title="Decisões pendentes"
              value={pendingDecisions.length}
              subtitle="Aguardando aprovação"
              tone="amber"
              icon={CheckCircle2}
              onClick={() => goToSection('decisoes')}
            />
            <KpiStatCard
              title="Oportunidades"
              value={opportunitiesList.length}
              subtitle="Registradas"
              tone="green"
              icon={Lightbulb}
              onClick={() => goToSection('oportunidades')}
            />
            <KpiStatCard
              title="Produtos"
              value={workspace.products.length}
              subtitle={`${workspace.categories.length} categoria(s)`}
              tone="cyan"
              icon={Package}
              onClick={() => goToSection('produtos')}
            />
            <KpiStatCard
              title="A verificar"
              value={pendingVerification.length}
              subtitle="Sem confirmação"
              onClick={() => goToSection('verificar')}
            />
            <KpiStatCard
              title="Qualidade cruzamento"
              value={`${crossQuality.score}/100`}
              subtitle={`Nível: ${crossQuality.label}`}
              tone={crossQuality.score >= 75 ? 'green' : 'amber'}
              icon={ShieldCheck}
            />
          </div>

          {!hasInternalMetrics && (
            <EmptyEvidenceBox
              title={NO_EVIDENCE_MSG}
              description={`Para cruzar indicadores econômicos oficiais com o desempenho da ${workspace.company.name}, cadastre seus produtos, lance seus registros em Vendas, DRE e Estoque ou importe uma planilha.`}
              actionLabel="Abrir Vendas, DRE e Estoque"
              onAction={() => goToSection('gestao-financeira')}
            />
          )}

          {(workspace.financialSummary?.hasData || workspace.reputationProfile?.googleRating || workspace.reputationProfile?.reclameAquiScore) && (
            <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-[#20C5D5] uppercase tracking-wider text-[11px]">
                  Sincronização Financeira, Estoque & Percepção dos Consumidores
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => goToSection('gestao-financeira')}
                    className="text-[#20C5D5] hover:underline cursor-pointer font-semibold"
                  >
                    Abrir Vendas, DRE e Estoque →
                  </button>
                  <button
                    type="button"
                    onClick={() => goToSection('consumidores')}
                    className="text-[#20C5D5] hover:underline cursor-pointer font-semibold"
                  >
                    Abrir Consumidores →
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                  <div className="text-[var(--text-secondary)]">Receita & Margem Bruta</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {workspace.financialSummary?.hasData
                      ? `${formatBrlFromCents(workspace.financialSummary.totalRevenueCents)} · ${formatPct(workspace.financialSummary.grossMarginPct)}`
                      : 'Sem vendas ainda'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                  <div className="text-[var(--text-secondary)]">Resultado Operacional</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {workspace.financialSummary?.hasData
                      ? `${formatBrlFromCents(workspace.financialSummary.operatingResultCents)} (${formatPct(workspace.financialSummary.operatingMarginPct)})`
                      : 'A calcular'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                  <div className="text-[var(--text-secondary)]">Valor em Estoque / Alertas</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {workspace.financialSummary?.hasData
                      ? `${formatBrlFromCents(workspace.financialSummary.totalInventoryValueCents)} · ${workspace.financialSummary.criticalStockItemsCount} alerta(s)`
                      : 'Sem itens no estoque'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                  <div className="text-[var(--text-secondary)]">Google Reviews / Reclame Aqui</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {workspace.reputationProfile?.googleRating
                      ? `Google ${workspace.reputationProfile.googleRating}/5`
                      : 'Google: aguardando'}
                    {workspace.reputationProfile?.reclameAquiScore
                      ? ` · RA ${workspace.reputationProfile.reclameAquiScore}`
                      : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Priority decisions or quick launch */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Decisões e Ações Prioritárias</h2>
                <button type="button" onClick={() => goToSection('decisoes')} className="text-xs text-[#20C5D5] hover:underline cursor-pointer">
                  Abrir central →
                </button>
              </div>
              {pendingDecisions.length === 0 ? (
                <div className="text-xs text-[var(--text-secondary)] py-4">
                  Nenhuma decisão pendente cadastrada. Clique em "Atualizar Inteligência com IA" ou cadastre em Estratégia e Decisão.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDecisions.slice(0, 3).map((d) => (
                    <div key={d.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm">{d.title}</div>
                        <div className="text-[var(--text-secondary)] mt-0.5">{d.description || d.impactNote}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${d.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'adiada' }),
                              });
                              showToast('Decisão adiada.');
                              loadWorkspace();
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Erro ao adiar decisão.');
                            }
                          }}
                          className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[var(--text-secondary)] hover:text-white cursor-pointer"
                        >
                          Adiar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await apiFetch<{ generatedActionsCount?: number }>(
                                `/api/beta/companies/${activeCompanyId}/strategic/${d.id}`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'aprovada' }),
                                }
                              );
                              showToast(
                                res.generatedActionsCount
                                  ? `Decisão aprovada e ${res.generatedActionsCount} tarefa(s) enviada(s) aos Planos de ação.`
                                  : 'Decisão aprovada.'
                              );
                              loadWorkspace();
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Erro ao aprovar decisão.');
                            }
                          }}
                          className="rounded-lg bg-[#F2B84B] px-3 py-1 font-semibold text-[#06132D] cursor-pointer"
                        >
                          Aprovar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
              <h2 className="text-base font-bold">Resumo da Operação</h2>
              <div className="divide-y divide-[var(--border-subtle)]">
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--text-secondary)]">Receita registrada</span>
                  <strong className="font-mono">
                    {hasInternalMetrics ? `R$ ${totalRevenueReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sem dados'}
                  </strong>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--text-secondary)]">Pedidos</span>
                  <strong className="font-mono">{hasInternalMetrics ? totalOrders : 0}</strong>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--text-secondary)]">Concorrentes monitorados</span>
                  <strong className="font-mono">{workspace.competitors.length}/{competitorLimit}</strong>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--text-secondary)]">Avaliações de clientes</span>
                  <strong className="font-mono">{workspace.reviews.length}</strong>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[var(--text-secondary)]">Ações abertas</span>
                  <strong className="font-mono">{openActions.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* DOCUMENTOS E RELATÓRIOS (Importação real + Lançamento manual)    */}
      {/* ================================================================ */}
      {section === 'documentos' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Documentos e relatórios"
            description="Envie planilhas (Excel/CSV), PDFs, textos ou fotos (OCR). A IA extrai descobertas e alimenta Radar, Análises e Decisões."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={generatingIntelligence}
                  onClick={() => handleGenerateIntelligence('all')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  {generatingIntelligence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{generatingIntelligence ? 'Gerando inteligência...' : 'Gerar Inteligência com IA'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadImportTemplateExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs hover:border-[#20C5D5] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Baixar modelo Excel (.xlsx)</span>
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
                <h2 className="text-base font-bold">Enviar arquivo (Prévia antes de salvar)</h2>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Planilhas de faturamento alimentam indicadores financeiros; relatórios em PDF, texto ou imagem têm suas descobertas lidas pela IA para gerar sinais e recomendações.
                </p>
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-6 text-center cursor-pointer hover:border-[#20C5D5] transition-colors">
                  <Upload className="h-6 w-6 text-[#20C5D5] mb-2" />
                  <span className="font-semibold text-sm">
                    {importLoading ? 'Processando arquivo com IA...' : 'Clique para selecionar arquivo'}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                    XLSX · CSV · PDF · TXT · MD · PNG/JPG (OCR IA)
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.txt,.md,image/png,image/jpeg,image/webp"
                    onChange={handleFileImportChange}
                    className="hidden"
                  />
                </label>

                {importPreview && (
                  <div className="rounded-lg border border-[#20C5D5]/40 bg-[#15365F]/60 p-4 space-y-3">
                    <div className="font-bold text-[#20C5D5]">
                      Prévia extraída: {importPreview.fileName} (Confiabilidade: {importPreview.reliability})
                    </div>
                    <div className="text-[var(--text-secondary)]">{importPreview.note}</div>
                    {importPreview.documentSummary && (
                      <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/70 p-2.5 text-[11px] text-[var(--text-primary)]">
                        <strong className="text-[#20C5D5]">Resumo extraído:</strong> {importPreview.documentSummary}
                      </div>
                    )}
                    {importPreview.insights && importPreview.insights.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          Descobertas identificadas ({importPreview.insights.length})
                        </div>
                        {importPreview.insights.slice(0, 4).map((ins, i) => (
                          <div key={i} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11px]">
                            <span className="font-semibold text-[#20C5D5]">[{ins.category}]</span> {ins.title}
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={importOrigin}
                      onChange={(e) => setImportOrigin(e.target.value)}
                      placeholder="Origem do dado (ex.: Fechamento PDV / Relatório Marketing)"
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-1.5 text-xs"
                    />
                    {importPreview.rows.length > 0 && (
                      <div className="max-h-36 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                        {importPreview.rows.map((r, i) => (
                          <div key={i} className="py-1.5 flex justify-between font-mono text-[11px]">
                            <span>{r.periodDate}</span>
                            <span>R$ {Number(r.revenueReais).toFixed(2)} · {r.ordersCount} ped.</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        className="rounded-lg bg-[#20C5D5] px-3 py-1.5 text-[#06132D] font-semibold cursor-pointer"
                      >
                        Confirmar e Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportPreview(null)}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 cursor-pointer"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch(`/api/beta/companies/${activeCompanyId}/metrics`, {
                      method: 'POST',
                      body: JSON.stringify(manualMetric),
                    });
                    showToast('Métrica interna registrada no banco.');
                    setManualMetric({ ...manualMetric, revenueReais: '', ordersCount: '', grossMarginPct: '' });
                    loadWorkspace();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Erro ao registrar métrica.');
                  }
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs"
              >
                <h2 className="text-base font-bold">Lançamento Manual de Indicador</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Data</label>
                    <input type="date" value={manualMetric.periodDate} onChange={(e) => setManualMetric({ ...manualMetric, periodDate: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Faturamento (R$)</label>
                    <input type="number" step="0.01" required value={manualMetric.revenueReais} onChange={(e) => setManualMetric({ ...manualMetric, revenueReais: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Pedidos</label>
                    <input type="number" required value={manualMetric.ordersCount} onChange={(e) => setManualMetric({ ...manualMetric, ordersCount: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Margem bruta (%)</label>
                    <input type="number" step="0.1" value={manualMetric.grossMarginPct} onChange={(e) => setManualMetric({ ...manualMetric, grossMarginPct: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5" />
                  </div>
                </div>
                <button type="submit" className="w-full rounded-lg bg-[#F4F8FF] py-2 text-[#06132D] font-semibold hover:bg-white cursor-pointer">
                  Salvar Indicador Interno
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold">Documentos e Importações Confirmadas ({workspace.imports.length})</h3>
                </div>
                {workspace.imports.length === 0 ? (
                  <p className="text-[var(--text-secondary)]">Nenhum arquivo importado e confirmado ainda.</p>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {workspace.imports.map((imp) => (
                      <div key={imp.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[var(--bg-card-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[#20C5D5]">
                              {imp.fileType.toUpperCase()}
                            </span>
                            <StatusBadge kind="aprovada" customLabel="Interpretado e Salvo" />
                          </div>
                          <span className="font-mono font-bold text-[#20C5D5]">{imp.rowCount} linha(s)</span>
                        </div>
                        <div className="font-bold text-sm">{imp.fileName}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          Origem: {imp.sourceOrigin} · Confiabilidade: {imp.reliabilityLevel} · {new Date(imp.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                        {imp.summaryText && (
                          <p className="text-[11px] text-[var(--text-primary)] bg-[var(--bg-card-secondary)]/40 rounded p-2">
                            {imp.summaryText}
                          </p>
                        )}
                        {Array.isArray(imp.insightsJson) && imp.insightsJson.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {imp.insightsJson.slice(0, 4).map((ins, i) => (
                              <span key={i} className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[10px] text-[#20C5D5]">
                                {ins.category}: {ins.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {workspace.metrics.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                  <h3 className="text-base font-bold">Lançamentos Financeiros Registrados ({workspace.metrics.length})</h3>
                  <div className="divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
                    {workspace.metrics.map((m) => (
                      <div key={m.id} className="py-2 flex justify-between gap-4">
                        <div>
                          <span className="font-mono text-[#20C5D5]">{m.periodDate}</span> · {m.sourceOrigin}
                        </div>
                        <div className="font-mono">
                          R$ {(m.revenueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {m.ordersCount} ped.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* DADOS DA EMPRESA E INTEGRAÇÕES (PDF 2 p.21-22)                   */}
      {/* ================================================================ */}
      {section === 'dados-empresa' && (
        <div className="space-y-6">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Dados da empresa e integrações"
            description="Conectores preparados para APIs oficiais. Nenhuma sincronização é simulada sem credenciais válidas."
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <h3 className="text-base font-bold">Integração automática</h3>
              <p className="text-[var(--text-secondary)]">
                iFood, Mercado Livre, OLX, Shopee, Amazon, Shopify e WhatsApp Business.
              </p>
              <div className="space-y-3 divide-y divide-[var(--border-subtle)]">
                {workspace.integrations
                  .filter((i) => i.provider !== 'own_site')
                  .map((int) => (
                    <div key={int.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-sm">{int.accountLabel}</span>
                          <span className="ml-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                            {int.connectionStatus === 'connected'
                              ? 'conectado'
                              : int.connectionStatus === 'awaiting_credentials'
                              ? 'aguardando OAuth'
                              : 'desconectado'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await apiFetch<{ message?: string }>(`/api/beta/companies/${activeCompanyId}/integrations/${int.provider}/sync`, { method: 'POST' });
                              showToast(res.message || 'Sincronizado.');
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Credenciais pendentes.');
                            }
                            loadWorkspace();
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 hover:border-[#20C5D5] cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Conectar</span>
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={integrationClientIds[int.provider] || ''}
                          onChange={(e) => setIntegrationClientIds((prev) => ({ ...prev, [int.provider]: e.target.value }))}
                          placeholder="Client ID / Chave API do parceiro..."
                          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/beta/companies/${activeCompanyId}/integrations/${int.provider}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ clientId: integrationClientIds[int.provider] || '' }),
                              });
                              showToast(`Credencial salva para ${int.accountLabel}.`);
                              loadWorkspace();
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Erro ao salvar credencial.');
                            }
                          }}
                          className="rounded-lg bg-[var(--bg-card-secondary)] px-2.5 py-1 text-[11px] font-medium hover:text-white cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                      {int.lastError && <div className="text-[11px] text-[#F2B84B]">{int.lastError}</div>}
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <h3 className="text-base font-bold">Site próprio</h3>
              {workspace.integrations
                .filter((i) => i.provider === 'own_site')
                .map((int) => (
                  <div key={int.id} className="space-y-3">
                    <label className="block text-[var(--text-secondary)]">Outro: link do site/loja</label>
                    <input
                      type="url"
                      defaultValue={int.storeUrl}
                      placeholder="https://sualoja.com.br"
                      onBlur={async (e) => {
                        try {
                          await apiFetch(`/api/beta/companies/${activeCompanyId}/integrations/${int.provider}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ storeUrl: e.target.value }),
                          });
                          showToast('URL da loja atualizada.');
                          loadWorkspace();
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Erro ao atualizar URL.');
                        }
                      }}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Status: <strong className="text-[#20C5D5]">{int.connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await apiFetch<{ message?: string }>(`/api/beta/companies/${activeCompanyId}/integrations/${int.provider}/sync`, { method: 'POST' });
                          showToast(res.message || 'Site verificado.');
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Informe a URL primeiro.');
                        }
                        loadWorkspace();
                      }}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 hover:border-[#20C5D5] cursor-pointer"
                    >
                      Verificar link
                    </button>
                  </div>
                ))}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
              <h3 className="text-base font-bold">Manual</h3>
              <p className="text-[var(--text-secondary)]">Foto (OCR), Excel/CSV ou PDF.</p>
              <div className="space-y-2 text-[var(--text-secondary)] leading-relaxed">
                <p><strong className="text-[var(--text-primary)]">Custo dos materiais:</strong> permite calcular o impacto da inflação na sua margem.</p>
                <p><strong className="text-[var(--text-primary)]">Total de vendas:</strong> base para sazonalidade e simulação.</p>
                <p><strong className="text-[var(--text-primary)]">Perdas:</strong> mostram o quanto proteger a lucratividade.</p>
                <p><strong className="text-[var(--text-primary)]">Estoque:</strong> liga a Selic ao capital parado.</p>
              </div>
              <button
                type="button"
                onClick={downloadImportTemplateExcel}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] py-2 font-medium hover:border-[#20C5D5] cursor-pointer"
              >
                Baixar planilha modelo (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* PRODUTOS E ESTOQUE (Importação Excel/PDF + Ranking + CRUD)      */}
      {/* ================================================================ */}
      {section === 'produtos' && (
        <div className="space-y-5">
          <PageHeader
            kicker="INTELIGÊNCIA INTERNA"
            title="Produtos e Estoque"
            description="Importe o catálogo de produtos e as unidades vendidas via Excel ou PDF para gerar automaticamente o ranking de desempenho e controle de estoque."
            actions={
              <div className="flex flex-wrap gap-2">
                <div className="relative w-52">
                  <Search className="h-3.5 w-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar nome ou código..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProductId(null);
                    setProdForm({
                      name: '',
                      description: '',
                      sku: '',
                      categoryId: '',
                      priceReais: '',
                      costReais: '',
                      stockQty: '',
                      soldUnits: '',
                      status: 'active',
                      imageUrl: '',
                    });
                    setProductModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-1.5 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Produto</span>
                </button>
              </div>
            }
          />

          {/* Duas áreas dedicadas de importação (Excel / PDF): 1. Catálogo & Estoque | 2. Unidades Vendidas */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Seção 1: Catálogo de Produtos e Informações de Estoque */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                    1. Catálogo de Produtos e Estoque
                  </span>
                  <h2 className="text-base font-bold mt-0.5">
                    Importar Catálogo (Excel ou PDF)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Envie arquivo com <strong>código/SKU</strong>, <strong>nome do produto</strong>,{' '}
                    <strong>preço unitário</strong> e quantidade em estoque.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCatalogTemplateExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 text-xs font-medium hover:border-[#20C5D5] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#20C5D5]" />
                  <span>Modelo Excel</span>
                </button>
              </div>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-5 text-center cursor-pointer hover:border-[#20C5D5] transition-colors">
                {catalogImportLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#20C5D5]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Lendo catálogo e estoque do arquivo...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#20C5D5]">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Selecionar Excel (.xlsx, .xls, .csv) ou PDF (.pdf)</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                      Atualiza preços e estoques de SKUs existentes ou cadastra novos itens
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  disabled={catalogImportLoading}
                  onChange={(e) => handleProductSpreadsheetOrPdfUpload('catalog', e)}
                  className="hidden"
                />
              </label>

              {catalogImportPreview && (
                <div className="rounded-lg border border-[#20C5D5]/40 bg-[var(--bg-card-secondary)]/60 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#20C5D5]">
                        Prévia: {catalogImportPreview.fileName} ({catalogImportPreview.items.length} itens)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {catalogImportPreview.note}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCatalogImportPreview(null)}
                      className="text-[var(--text-secondary)] hover:text-white cursor-pointer"
                      aria-label="Fechar prévia de catálogo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[var(--bg-sidebar)] text-[var(--text-secondary)] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1.5">Código</th>
                          <th className="px-2.5 py-1.5">Produto</th>
                          <th className="px-2.5 py-1.5 text-right">Preço Un.</th>
                          <th className="px-2.5 py-1.5 text-right">Estoque</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {catalogImportPreview.items.map((item, idx) => (
                          <tr key={`${item.sku}-${item.name}-${idx}`}>
                            <td className="px-2.5 py-1.5 font-mono text-[var(--text-secondary)]">
                              {item.sku || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 font-medium">{item.name}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono">
                              R$ {item.priceReais.toFixed(2)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono">{item.stockQty} un.</td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setCatalogImportPreview((prev) =>
                                    prev
                                      ? { ...prev, items: prev.items.filter((_, i) => i !== idx) }
                                      : null
                                  )
                                }
                                className="text-[#EF6464] hover:underline cursor-pointer"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCatalogImportPreview(null)}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={catalogImportLoading || catalogImportPreview.items.length === 0}
                      onClick={() => handleConfirmProductImport('catalog')}
                      className="rounded-lg bg-[#20C5D5] px-4 py-1.5 font-semibold text-[#06132D] hover:bg-[#38d3e2] disabled:opacity-50 cursor-pointer"
                    >
                      Confirmar e Salvar no Catálogo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Seção 2: Unidades Vendidas por Produto */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#20B981]">
                    2. Unidades Vendidas por Produto
                  </span>
                  <h2 className="text-base font-bold mt-0.5">
                    Importar Unidades Vendidas (Excel ou PDF)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Envie o volume de vendas por item para gerar automaticamente o{' '}
                    <strong>ranking dos produtos mais vendidos</strong> e alertas de reposição.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSalesUnitsTemplateExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 text-xs font-medium hover:border-[#20B981] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#20B981]" />
                  <span>Modelo Excel</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[var(--text-secondary)]">Ao importar:</span>
                <select
                  value={salesMergeStrategy}
                  onChange={(e) => setSalesMergeStrategy(e.target.value as 'replace' | 'add')}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-xs"
                >
                  <option value="replace">Atualizar total vendido do período</option>
                  <option value="add">Somar às unidades já registradas</option>
                </select>
              </div>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 px-4 py-5 text-center cursor-pointer hover:border-[#20B981] transition-colors">
                {salesImportLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#20B981]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processando unidades vendidas...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#20B981]">
                      <Upload className="h-4 w-4" />
                      <span>Selecionar Excel (.xlsx, .xls, .csv) ou PDF (.pdf)</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] mt-1">
                      Cruza automaticamente por código/SKU ou nome do produto
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  disabled={salesImportLoading}
                  onChange={(e) => handleProductSpreadsheetOrPdfUpload('sales', e)}
                  className="hidden"
                />
              </label>

              {salesImportPreview && (
                <div className="rounded-lg border border-[#20B981]/40 bg-[var(--bg-card-secondary)]/60 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#20B981]">
                        Prévia: {salesImportPreview.fileName} ({salesImportPreview.items.length} itens)
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {salesImportPreview.note}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSalesImportPreview(null)}
                      className="text-[var(--text-secondary)] hover:text-white cursor-pointer"
                      aria-label="Fechar prévia de vendas"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[var(--bg-sidebar)] text-[var(--text-secondary)] sticky top-0">
                        <tr>
                          <th className="px-2.5 py-1.5">Código</th>
                          <th className="px-2.5 py-1.5">Produto</th>
                          <th className="px-2.5 py-1.5 text-right">Unidades Vendidas</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {salesImportPreview.items.map((item, idx) => (
                          <tr key={`${item.sku}-${item.name}-${idx}`}>
                            <td className="px-2.5 py-1.5 font-mono text-[var(--text-secondary)]">
                              {item.sku || '—'}
                            </td>
                            <td className="px-2.5 py-1.5 font-medium">{item.name}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono font-bold text-[#20B981]">
                              {item.soldUnits} un.
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setSalesImportPreview((prev) =>
                                    prev
                                      ? { ...prev, items: prev.items.filter((_, i) => i !== idx) }
                                      : null
                                  )
                                }
                                className="text-[#EF6464] hover:underline cursor-pointer"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSalesImportPreview(null)}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={salesImportLoading || salesImportPreview.items.length === 0}
                      onClick={() => handleConfirmProductImport('sales')}
                      className="rounded-lg bg-[#20B981] px-4 py-1.5 font-semibold text-[#06132D] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      Confirmar Unidades Vendidas
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ranking, Destaque e Gráfico em Barras das Vendas por Produto */}
          {workspace.products.length > 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#20C5D5]/15 text-[#20C5D5]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">
                      Ranking e Desempenho de Vendas por Produto
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Comparativo automático entre unidades vendidas e estoque atual para apoiar reposição e mix comercial.
                    </p>
                  </div>
                </div>
                {productSalesStats.totalSoldUnits > 0 && (
                  <StatusBadge kind="oportunidade" customLabel="Ranking atualizado" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiStatCard
                  title="Produto Líder (1º Lugar)"
                  value={productSalesStats.topProduct ? productSalesStats.topProduct.name : 'Sem vendas'}
                  subtitle={
                    productSalesStats.topProduct
                      ? `${productSalesStats.topProduct.soldUnits} un. vendidas`
                      : 'Importe as unidades vendidas'
                  }
                  tone="cyan"
                />
                <KpiStatCard
                  title="Total de Unidades Vendidas"
                  value={`${productSalesStats.totalSoldUnits.toLocaleString('pt-BR')} un.`}
                  subtitle={`Em ${workspace.products.length} item(ns) no catálogo`}
                  tone="green"
                />
                <KpiStatCard
                  title="Receita Estimada do Mix"
                  value={`R$ ${productSalesStats.totalEstimatedRevenue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  subtitle="Unidades vendidas × preço unitário"
                  tone="default"
                />
                <KpiStatCard
                  title="Alerta de Reposição nos Líderes"
                  value={`${productSalesStats.criticalTopSellersCount} SKU(s)`}
                  subtitle={
                    productSalesStats.criticalTopSellersCount > 0
                      ? 'Estoque baixo frente às vendas'
                      : 'Cobertura sob controle'
                  }
                  tone={productSalesStats.criticalTopSellersCount > 0 ? 'amber' : 'green'}
                />
              </div>

              {productSalesStats.totalSoldUnits > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#20C5D5]" />
                        <span>Unidades Vendidas vs. Estoque Atual</span>
                      </h3>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Top {productSalesStats.chartData.length} produtos
                      </span>
                    </div>
                    <SimpleBarChart
                      data={productSalesStats.chartData}
                      primaryLabel="Unidades vendidas"
                      secondaryLabel="Estoque atual"
                      unitSuffix=""
                      height={220}
                    />
                  </div>

                  <div className="lg:col-span-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#20B981]" />
                        <span>Ranking de Produtos Mais Vendidos</span>
                      </h3>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Participação no volume total
                      </span>
                    </div>
                    <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                      {productSalesStats.ranked.map((p, index) => {
                        const sold = p.soldUnits || 0;
                        const sharePct =
                          productSalesStats.totalSoldUnits > 0
                            ? Math.round((sold / productSalesStats.totalSoldUnits) * 1000) / 10
                            : 0;
                        const estRev = sold * (p.priceCents / 100);
                        const needsRestock =
                          sold > 0 && p.stockQty <= Math.max(5, Math.round(sold * 0.15));
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProductId(p.id)}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 p-3 cursor-pointer hover:border-[#20C5D5] transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono font-bold text-[11px] ${
                                    index === 0
                                      ? 'bg-[#20C5D5] text-[#06132D]'
                                      : index === 1
                                      ? 'bg-[#20B981]/25 text-[#20B981]'
                                      : index === 2
                                      ? 'bg-[#F2B84B]/25 text-[#F2B84B]'
                                      : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {index + 1}º
                                </span>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{p.name}</div>
                                  <div className="text-[11px] text-[var(--text-secondary)]">
                                    SKU {p.sku || 'N/A'} · Estoque: {p.stockQty} un.
                                    {needsRestock && (
                                      <span className="ml-2 text-[#F2B84B] font-semibold">
                                        · Reposição urgente
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-[#20C5D5]">
                                  {sold} un. ({sharePct}%)
                                </div>
                                <div className="text-[11px] text-[var(--text-secondary)] font-mono">
                                  R$ {estRev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  index === 0 ? 'bg-[#20C5D5]' : 'bg-[#20B981]'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(sold > 0 ? 4 : 0, sharePct))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/40 p-4 text-xs text-[var(--text-secondary)] flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-[#F2B84B] shrink-0" />
                  <span>
                    Você já possui {workspace.products.length} produto(s) no catálogo, mas ainda não há unidades vendidas registradas. Importe o arquivo de <strong>Unidades Vendidas (Excel ou PDF)</strong> na seção 2 acima para gerar automaticamente o Ranking e o Gráfico Comparativo.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-wrap items-center gap-3 text-xs">
            <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nova categoria..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 text-xs"
              />
              <button type="submit" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-1.5 font-medium cursor-pointer">
                + Categoria
              </button>
            </form>
            <select value={prodCategoryFilter} onChange={(e) => setProdCategoryFilter(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5">
              <option value="all">Todas categorias</option>
              {workspace.categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <select value={prodStatusFilter} onChange={(e) => setProdStatusFilter(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5">
              <option value="all">Todos status</option>
              <option value="active">Ativo</option>
              <option value="draft">Rascunho</option>
              <option value="archived">Arquivado</option>
            </select>
            <select value={prodSort} onChange={(e) => setProdSort(e.target.value as typeof prodSort)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5">
              <option value="newest">Mais recentes</option>
              <option value="sales_desc">Mais vendidos (Ranking)</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="stock_asc">Menor estoque</option>
            </select>
          </div>

          {selectedProduct ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5">
              <button type="button" onClick={() => setSelectedProductId(null)} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#20C5D5] hover:underline cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar para catálogo</span>
              </button>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full aspect-[4/3] object-cover rounded-lg border border-[var(--border-subtle)]" />
                ) : (
                  <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
                    Sem imagem cadastrada
                  </div>
                )}
                <div className="md:col-span-2 space-y-3">
                  <div className="text-xs text-[var(--text-secondary)]">SKU {selectedProduct.sku || 'N/A'} · Status: {selectedProduct.status}</div>
                  <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedProduct.description || 'Sem descrição.'}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[var(--text-secondary)]">Preço Venda</div>
                      <div className="font-mono font-bold">R$ {(selectedProduct.priceCents / 100).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[var(--text-secondary)]">Custo Aquisição</div>
                      <div className="font-mono font-bold">R$ {(selectedProduct.acquisitionCostCents / 100).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[var(--text-secondary)]">Estoque</div>
                      <div className="font-mono font-bold">{selectedProduct.stockQty} un.</div>
                    </div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3">
                      <div className="text-[var(--text-secondary)]">Unidades Vendidas</div>
                      <div className="font-mono font-bold text-[#20B981]">{selectedProduct.soldUnits || 0} un.</div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProductId(selectedProduct.id);
                        setProdForm({
                          name: selectedProduct.name,
                          description: selectedProduct.description,
                          sku: selectedProduct.sku,
                          categoryId: selectedProduct.categoryId ? String(selectedProduct.categoryId) : '',
                          priceReais: (selectedProduct.priceCents / 100).toFixed(2),
                          costReais: (selectedProduct.acquisitionCostCents / 100).toFixed(2),
                          stockQty: String(selectedProduct.stockQty),
                          soldUnits: String(selectedProduct.soldUnits || 0),
                          status: selectedProduct.status,
                          imageUrl: selectedProduct.imageUrl,
                        });
                        setProductModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(selectedProduct.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#EF6464]/40 px-3 py-1.5 text-xs font-medium text-[#EF6464] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyEvidenceBox
              title="Nenhum produto cadastrado ainda"
              description="Cadastre manualmente ou importe acima o catálogo de produtos (Excel ou PDF) para cruzar preços, estoque e unidades vendidas."
              actionLabel="Cadastrar Primeiro Produto"
              onAction={() => setProductModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden cursor-pointer hover:border-[#20C5D5] transition-colors flex flex-col"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-[var(--bg-card-secondary)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
                      Sem foto
                    </div>
                  )}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-[var(--text-secondary)]">SKU {p.sku || 'N/A'}</div>
                      <h3 className="text-sm font-bold mt-0.5">{p.name}</h3>
                    </div>
                    <div className="pt-2 space-y-1 text-xs border-t border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#20C5D5]">R$ {(p.priceCents / 100).toFixed(2)}</span>
                        <span className="text-[var(--text-secondary)]">Estoque: {p.stockQty} un.</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)]">Vendidas:</span>
                        <span className="font-mono font-semibold text-[#20B981]">{p.soldUnits || 0} un.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {productModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <form
                onSubmit={handleSaveProduct}
                className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">{editingProductId ? 'Editar Produto' : 'Cadastrar Produto'}</h3>
                  <button type="button" onClick={() => setProductModalOpen(false)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[var(--text-secondary)] mb-1">Nome do produto *</label>
                    <input type="text" required value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">SKU / Código</label>
                    <input type="text" value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Categoria</label>
                    <select value={prodForm.categoryId} onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm">
                      <option value="">Sem categoria</option>
                      {workspace.categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Preço de venda (R$)</label>
                    <input type="number" step="0.01" value={prodForm.priceReais} onChange={(e) => setProdForm({ ...prodForm, priceReais: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Custo de aquisição (R$)</label>
                    <input type="number" step="0.01" value={prodForm.costReais} onChange={(e) => setProdForm({ ...prodForm, costReais: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Estoque atual (unidades)</label>
                    <input type="number" value={prodForm.stockQty} onChange={(e) => setProdForm({ ...prodForm, stockQty: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Unidades vendidas</label>
                    <input type="number" min="0" value={prodForm.soldUnits} onChange={(e) => setProdForm({ ...prodForm, soldUnits: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[var(--text-secondary)] mb-1">Status</label>
                    <select value={prodForm.status} onChange={(e) => setProdForm({ ...prodForm, status: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm">
                      <option value="active">Ativo</option>
                      <option value="draft">Rascunho</option>
                      <option value="archived">Arquivado</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[var(--text-secondary)] mb-1">Descrição</label>
                    <textarea rows={2} value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[var(--text-secondary)] mb-1">Imagem do produto</label>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-2 cursor-pointer">
                        <Upload className="h-4 w-4 text-[#20C5D5]" />
                        <span>Enviar foto (PNG/JPG/WEBP)</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const url = await uploadCompanyImage(f);
                              setProdForm((prev) => ({ ...prev, imageUrl: url }));
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Erro no upload.');
                            }
                          }}
                        />
                      </label>
                      {prodForm.imageUrl && <img src={prodForm.imageUrl} alt="Prévia" className="h-10 w-10 rounded object-cover" />}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setProductModalOpen(false)} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 cursor-pointer">Cancelar</button>
                  <button type="submit" className="rounded-lg bg-[#20C5D5] px-5 py-2 text-[#06132D] font-semibold cursor-pointer">Salvar Produto</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* CONSUMIDORES E VOZ DO CLIENTE                                    */}
      {/* ================================================================ */}
      {section === 'consumidores' && (() => {
        const rep = workspace.reputationProfile;
        const diag = aiReviewInterpretation;

        return (
          <div className="space-y-6">
            <PageHeader
              kicker="INTELIGÊNCIA INTERNA"
              title="Consumidores e Voz do Cliente"
              description="Sincronização automática do Google Reviews após cadastro/login, captura opcional do Reclame Aqui e diagnóstico completo da percepção dos consumidores com IA."
              actions={
                <button
                  type="button"
                  disabled={syncingGoogleReviews}
                  onClick={async () => {
                    setSyncingGoogleReviews(true);
                    try {
                      const res = await apiFetch<{ insertedReviewsCount?: number; syncNote?: string }>(
                        `/api/beta/companies/${activeCompanyId}/reviews/sync-google`,
                        { method: 'POST' }
                      );
                      await loadWorkspace();
                      showToast(
                        res.insertedReviewsCount && res.insertedReviewsCount > 0
                          ? `${res.insertedReviewsCount} avaliação(ões) importada(s) do Google Reviews.`
                          : res.syncNote || 'Sincronização com Google Reviews concluída.'
                      );
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao sincronizar Google Reviews.');
                    } finally {
                      setSyncingGoogleReviews(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  {syncingGoogleReviews ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{syncingGoogleReviews ? 'Buscando no Google Reviews...' : 'Sincronizar Google Reviews'}</span>
                </button>
              }
            />

            {/* Google Reviews Automático + Reclame Aqui Opcional */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-[#F2B84B]" />
                    <h2 className="text-base font-bold">Google Reviews (Busca Automática)</h2>
                  </div>
                  <StatusBadge
                    kind={
                      rep?.googleSyncStatus === 'synced'
                        ? 'oportunidade'
                        : rep?.googleSyncStatus === 'pending'
                        ? 'alerta'
                        : 'movimento'
                    }
                    customLabel={
                      rep?.googleSyncStatus === 'synced'
                        ? 'Sincronizado'
                        : rep?.googleSyncStatus === 'pending'
                        ? 'Sincronizando...'
                        : rep?.googleSyncStatus === 'not_found'
                        ? 'Perfil não localizado'
                        : 'Aguardando'
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                    <div className="text-[var(--text-secondary)]">Nota Média</div>
                    <div className="text-lg font-bold text-[#F2B84B] mt-0.5">
                      {rep?.googleRating ? `${rep.googleRating} ★` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                    <div className="text-[var(--text-secondary)]">Total Avaliações</div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {rep?.googleRatingsTotal ? rep.googleRatingsTotal.toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-3">
                    <div className="text-[var(--text-secondary)]">Comentários Base</div>
                    <div className="text-lg font-bold text-[#20C5D5] mt-0.5">
                      {workspace.reviews.filter((r) => r.source === 'google').length}
                    </div>
                  </div>
                </div>

                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {rep?.googleSyncNote ||
                    'Ao cadastrar/entrar na empresa, o sistema busca automaticamente o estabelecimento e suas avaliações públicas no Google Maps.'}
                </p>

                {rep?.googleMapsUri && (
                  <a
                    href={rep.googleMapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#20C5D5] hover:underline font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir ficha pública no Google Maps ({rep.googlePlaceName || workspace.company.name})</span>
                  </a>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold">Reclame Aqui (Opcional)</h2>
                  {rep?.reclameAquiCaptureStatus && rep.reclameAquiCaptureStatus !== 'idle' && (
                    <StatusBadge
                      kind={
                        rep.reclameAquiCaptureStatus === 'captured'
                          ? 'oportunidade'
                          : rep.reclameAquiCaptureStatus === 'partial'
                          ? 'alerta'
                          : 'movimento'
                      }
                      customLabel={
                        rep.reclameAquiCaptureStatus === 'captured'
                          ? 'Capturado'
                          : rep.reclameAquiCaptureStatus === 'partial'
                          ? 'Captura parcial'
                          : 'Limitado / Manual'
                      }
                    />
                  )}
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setCapturingReclameAqui(true);
                    try {
                      const res = await apiFetch<{ insertedComplaintsCount?: number; captureNote?: string }>(
                        `/api/beta/companies/${activeCompanyId}/reviews/reclame-aqui`,
                        {
                          method: 'POST',
                          body: JSON.stringify({ url: reclameAquiUrlInput }),
                        }
                      );
                      await loadWorkspace();
                      showToast(
                        res.captureNote ||
                          `Reclame Aqui atualizado (${res.insertedComplaintsCount || 0} relato(s) capturado(s)).`
                      );
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao capturar Reclame Aqui.');
                    } finally {
                      setCapturingReclameAqui(false);
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="url"
                    placeholder="https://www.reclameaqui.com.br/empresa/sua-empresa/"
                    value={reclameAquiUrlInput}
                    onChange={(e) => setReclameAquiUrlInput(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2"
                  />
                  <button
                    type="submit"
                    disabled={capturingReclameAqui}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {capturingReclameAqui ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    <span>{capturingReclameAqui ? 'Capturando...' : 'Salvar e Capturar'}</span>
                  </button>
                </form>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                    <div className="text-[10px] text-[var(--text-secondary)]">Nota / Selo</div>
                    <div className="font-bold text-white mt-0.5">
                      {rep?.reclameAquiScore || '—'} {rep?.reclameAquiStatusLabel ? `(${rep.reclameAquiStatusLabel})` : ''}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                    <div className="text-[10px] text-[var(--text-secondary)]">Respondidas</div>
                    <div className="font-bold text-[#20C5D5] mt-0.5">{rep?.reclameAquiResponseRatePct || '—'}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                    <div className="text-[10px] text-[var(--text-secondary)]">Índice Solução</div>
                    <div className="font-bold text-[#22C58B] mt-0.5">{rep?.reclameAquiSolvedRatePct || '—'}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-sidebar)] p-2.5">
                    <div className="text-[10px] text-[var(--text-secondary)]">Voltariam</div>
                    <div className="font-bold text-white mt-0.5">{rep?.reclameAquiBackToBuyPct || '—'}</div>
                  </div>
                </div>

                <p className="text-[var(--text-secondary)]">
                  {rep?.reclameAquiCaptureNote ||
                    'Cole opcionalmente o link da página da sua empresa no Reclame Aqui para capturar índices de satisfação e reclamações públicas disponíveis.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                <h2 className="text-base font-bold">Avaliações por Canal</h2>
                <SimpleBarChart data={reviewChartData} primaryLabel="Positivas (4–5★)" secondaryLabel="Neutras/Negativas (1–3★)" />
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch(`/api/beta/companies/${activeCompanyId}/reviews`, {
                      method: 'POST',
                      body: JSON.stringify(reviewForm),
                    });
                    setReviewForm({ source: 'google', rating: 5, commentText: '', authorLabel: '', hasLgpdConsent: true });
                    showToast('Avaliação registrada.');
                    loadWorkspace();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Erro ao registrar avaliação.');
                  }
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs"
              >
                <h2 className="text-base font-bold">Registrar Avaliação Real</h2>
                <div className="grid grid-cols-2 gap-3">
                  <select value={reviewForm.source} onChange={(e) => setReviewForm({ ...reviewForm, source: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2">
                    <option value="google">Google</option>
                    <option value="reclame_aqui">Reclame Aqui</option>
                    <option value="marketplace">Marketplaces</option>
                    <option value="whatsapp_business">WhatsApp Business</option>
                    <option value="manual">Outra central autorizada</option>
                  </select>
                  <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrela(s)</option>)}
                  </select>
                </div>
                <textarea required rows={2} placeholder="Comentário real do cliente..." value={reviewForm.commentText} onChange={(e) => setReviewForm({ ...reviewForm, commentText: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                <label className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <input type="checkbox" checked={reviewForm.hasLgpdConsent} onChange={(e) => setReviewForm({ ...reviewForm, hasLgpdConsent: e.target.checked })} />
                  <span>Cliente consentiu coleta/pesquisa conforme LGPD</span>
                </label>
                <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">
                  Salvar Avaliação
                </button>
              </form>
            </div>

            {/* Diagnóstico da Percepção dos Consumidores (IA Gemini) */}
            <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">Diagnóstico da Percepção dos Consumidores (IA)</h2>
                  <p className="text-[var(--text-secondary)]">
                    Cruza avaliações do Google Reviews, Reclame Aqui e registros manuais para extrair elogios, reclamações recorrentes, pontos negativos e oportunidades de melhoria.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={interpretingReviews}
                  onClick={async () => {
                    setInterpretingReviews(true);
                    try {
                      const res = await apiFetch<NonNullable<typeof aiReviewInterpretation>>(
                        `/api/beta/companies/${activeCompanyId}/reviews/interpret`,
                        { method: 'POST' }
                      );
                      setAiReviewInterpretation(res);
                      await loadWorkspace();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao interpretar avaliações.');
                    } finally {
                      setInterpretingReviews(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {interpretingReviews ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{interpretingReviews ? 'Diagnosticando...' : 'Gerar Diagnóstico Completo IA'}</span>
                </button>
              </div>

              {diag ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 p-4 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#20C5D5]">Síntese de Percepção</span>
                      {diag.satisfactionLevel && (
                        <StatusBadge kind={diag.hasSufficientData ? 'oportunidade' : 'alerta'} customLabel={diag.satisfactionLevel} />
                      )}
                    </div>
                    <p className="text-[var(--text-primary)] leading-relaxed">
                      {diag.overallPerceptionDiagnosis || diag.summary}
                    </p>
                    {diag.salesAndMarginImpact && (
                      <p className="text-[var(--text-secondary)] pt-1">
                        <strong>Impacto comercial e margem:</strong> {diag.salesAndMarginImpact}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-[#22C58B]/30 bg-[#22C58B]/5 p-3.5 space-y-2">
                      <div className="font-bold text-[#22C58B]">Elogios Identificados ({diag.positives?.length || 0})</div>
                      {(diag.positives || []).length === 0 ? (
                        <p className="text-[var(--text-secondary)]">Nenhum elogio recorrente destacado na amostra.</p>
                      ) : (
                        diag.positives!.map((p, idx) => (
                          <div key={idx} className="border-t border-[var(--border-subtle)] pt-1.5">
                            <div className="font-semibold text-white">{p.theme} ({p.frequency})</div>
                            {p.example && <div className="text-[var(--text-secondary)] italic">&quot;{p.example}&quot;</div>}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-lg border border-[#F2B84B]/30 bg-[#F2B84B]/5 p-3.5 space-y-2">
                      <div className="font-bold text-[#F2B84B]">Reclamações Recorrentes ({diag.recurringComplaints?.length || 0})</div>
                      {(diag.recurringComplaints || []).length === 0 ? (
                        <p className="text-[var(--text-secondary)]">Sem reclamações recorrentes identificadas na amostra atual.</p>
                      ) : (
                        diag.recurringComplaints!.map((c, idx) => (
                          <div key={idx} className="border-t border-[var(--border-subtle)] pt-1.5">
                            <div className="font-semibold text-white">{c.theme} ({c.frequency})</div>
                            {c.example && <div className="text-[var(--text-secondary)] italic">&quot;{c.example}&quot;</div>}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-lg border border-[#F25F6E]/30 bg-[#F25F6E]/5 p-3.5 space-y-2">
                      <div className="font-bold text-[#F25F6E]">Pontos Negativos ({diag.negatives?.length || 0})</div>
                      {(diag.negatives || []).length === 0 ? (
                        <p className="text-[var(--text-secondary)]">Sem pontos negativos críticos registrados na amostra.</p>
                      ) : (
                        diag.negatives!.map((n, idx) => (
                          <div key={idx} className="border-t border-[var(--border-subtle)] pt-1.5">
                            <div className="font-semibold text-white">{n.theme} ({n.frequency})</div>
                            {n.example && <div className="text-[var(--text-secondary)] italic">&quot;{n.example}&quot;</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {((diag.improvementOpportunities && diag.improvementOpportunities.length > 0) ||
                    (diag.recommendations && diag.recommendations.length > 0)) && (
                    <div className="rounded-lg border border-[#20C5D5]/30 bg-[#20C5D5]/5 p-3.5 space-y-1.5">
                      <div className="font-bold text-[#20C5D5]">Oportunidades de Melhoria e Ações</div>
                      <ul className="list-disc pl-4 space-y-1 text-[var(--text-primary)]">
                        {(diag.improvementOpportunities && diag.improvementOpportunities.length > 0
                          ? diag.improvementOpportunities
                          : diag.recommendations || []
                        ).map((op, i) => (
                          <li key={i}>{op}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diag.dataLimitations && (
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      <strong>Limitações da amostra:</strong> {diag.dataLimitations}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[var(--text-secondary)]">
                  Clique em &quot;Gerar Diagnóstico Completo IA&quot; para interpretar os comentários capturados do Google Reviews, Reclame Aqui e avaliações manuais.
                </p>
              )}
            </div>

            {/* Lista de Avaliações Capturadas / Registradas */}
            {workspace.reviews.length > 0 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold">Comentários e Avaliações na Base ({workspace.reviews.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {workspace.reviews.map((rv) => (
                    <div key={rv.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          {rv.authorLabel || 'Cliente'} · <span className="uppercase text-[10px] text-[#20C5D5]">{rv.source}</span>
                        </span>
                        <span className="font-mono text-[#F2B84B]">{rv.rating}/5 ★</span>
                      </div>
                      <p className="text-[var(--text-primary)]">{rv.commentText}</p>
                      <div className="text-[10px] text-[var(--text-secondary)]">{rv.reviewedAt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* GESTÃO FINANCEIRA, DRE & ESTOQUE (6 ABAS SINCRONIZADAS)          */}
      {/* ================================================================ */}
      {section === 'gestao-financeira' && (
        <FinancialOperationsModule
          companyId={workspace.company.id}
          companyName={workspace.company.name}
          categories={workspace.categories}
          sales={workspace.financialSales || []}
          costs={workspace.financialCosts || []}
          expenses={workspace.financialExpenses || []}
          inventory={workspace.inventoryItems || []}
          precomputedSummary={workspace.financialSummary}
          latestCrossAnalysis={
            (workspace.strategicItems.find((s) => s.kind === 'cross_sync_ai')?.metadataJson as
              | CrossAnalysisDisplay
              | undefined) || null
          }
          consumersContextNote={`${workspace.reviews.length} avaliação(ões)${
            workspace.reputationProfile?.googleRating
              ? ` · Google ${workspace.reputationProfile.googleRating}/5`
              : ''
          }`}
          competitorsCount={workspace.competitors.length}
          macroActiveCount={macroIndicators.filter((m) => m.status === 'ok').length}
          apiFetch={apiFetch}
          onRefresh={loadWorkspace}
          onNotify={showToast}
        />
      )}

      {/* ================================================================ */}
      {/* RADAR DE MERCADO (Sinais do setor, concorrentes e tendências)     */}
      {/* ================================================================ */}
      {section === 'radar' && (() => {
        const radarItems = workspace.strategicItems.filter((s) => s.kind === 'radar');
        const filteredRadar = radarItems.filter((item) => {
          const meta = (item.metadataJson || {}) as Record<string, string>;
          const sigKind = meta.signalKind || (item.priority === 'alta' ? 'ameaca' : 'movimento');
          const matchType =
            radarTypeFilter === 'Todos' ||
            (radarTypeFilter === 'Oportunidades' && sigKind === 'oportunidade') ||
            (radarTypeFilter === 'Ameaças' && sigKind === 'ameaca') ||
            (radarTypeFilter === 'A verificar' && sigKind === 'pendente') ||
            (radarTypeFilter === 'Movimentações' && ['movimento', 'movimentacao'].includes(sigKind));
          const matchCat = radarCatFilter === 'Todas' || (item.category || 'Setor') === radarCatFilter;
          return matchType && matchCat;
        });

        return (
          <div className="space-y-5">
            <PageHeader
              kicker="INTELIGÊNCIA EXTERNA"
              title="Radar de mercado"
              description="Sinais do setor, movimentações de concorrentes, tendências de consumo, regulação e descobertas dos seus documentos. Indicadores econômicos ficam na aba Ambiente macroeconômico."
              actions={
                <button
                  type="button"
                  disabled={generatingIntelligence}
                  onClick={() => handleGenerateIntelligence('radar')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                >
                  {generatingIntelligence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{generatingIntelligence ? 'Atualizando Radar...' : 'Atualizar Radar com IA'}</span>
                </button>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-9 space-y-4">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {['Todos', 'Oportunidades', 'Ameaças', 'A verificar', 'Movimentações'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRadarTypeFilter(t)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        radarTypeFilter === t
                          ? 'bg-[#F4F8FF] text-[#06132D] font-semibold'
                          : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {filteredRadar.length === 0 ? (
                  <EmptyEvidenceBox
                    title="Nenhum sinal no Radar com este filtro ainda"
                    description={`Clique em "Atualizar Radar com IA" para pesquisar sinais reais do segmento "${workspace.company.segment || 'sua empresa'}" e cruzar com os seus documentos importados.`}
                    actionLabel={generatingIntelligence ? 'Analisando...' : 'Gerar Sinais do Radar com IA'}
                    onAction={() => handleGenerateIntelligence('radar')}
                  />
                ) : (
                  filteredRadar.map((item) => {
                    const meta = (item.metadataJson || {}) as Record<string, string>;
                    const sigKind = (meta.signalKind as 'oportunidade' | 'ameaca' | 'pendente' | 'movimento') || (item.priority === 'alta' ? 'ameaca' : 'movimento');
                    return (
                      <SignalCard
                        key={item.id}
                        code={`SIG-${item.id}`}
                        kind={sigKind}
                        impactLabel={meta.impactLabel || (item.priority === 'alta' ? 'Impacto alto' : 'Impacto médio')}
                        category={item.category || 'Setor'}
                        metaRight={meta.publishedDate || item.dueDate || 'Atual'}
                        title={item.title}
                        summary={item.description || 'Sinal identificado para a empresa.'}
                        sourceName={meta.sourceName || 'IA + Fontes Públicas / Documentos'}
                        sourceVerified={meta.sourceUrl ? 'Fonte verificada' : 'Documento / Análise IA'}
                        publishedDate={meta.publishedDate || item.dueDate || 'Recente'}
                        lastChecked={meta.lastCheckedDate || item.dueDate || 'Atual'}
                        relevance={meta.relevance || item.impactNote || NO_EVIDENCE_MSG}
                        potentialImpact={item.impactNote || 'Em avaliação'}
                        recommendation={meta.recommendation || 'Avaliar e converter em decisão estratégica.'}
                        traceSteps={[
                          ...(workspace.imports.length > 0
                            ? [
                                {
                                  label: 'Documento',
                                  code: `DOC-${workspace.imports[0].id}`,
                                  onClick: () => goToSection('documentos'),
                                },
                              ]
                            : []),
                          { label: 'Radar', code: `SIG-${item.id}` },
                          { label: 'Análise', code: 'ANA', onClick: () => goToSection('analises') },
                          { label: 'Decisão', code: 'DEC', onClick: () => goToSection('decisoes') },
                          { label: 'Ação', code: 'PLN', onClick: () => goToSection('planos-acao') },
                        ]}
                        footerActions={
                          <div className="flex items-center gap-2">
                            {meta.sourceUrl && (
                              <a
                                href={meta.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-[#20C5D5] hover:border-[#20C5D5]"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Abrir fonte</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, { method: 'DELETE' });
                                  loadWorkspace();
                                } catch (err) {
                                  showToast(err instanceof Error ? err.message : 'Erro ao remover sinal.');
                                }
                              }}
                              className="text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                              aria-label="Remover sinal"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        }
                      />
                    );
                  })
                )}
              </div>

              <aside className="lg:col-span-3 space-y-3 self-start">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                    POR CATEGORIA
                  </div>
                  {['Todas', 'Concorrência', 'Setor', 'Custos', 'Canais', 'Eventos', 'Tributação', 'Legislação', 'Consumidor'].map((cat) => {
                    const count =
                      cat === 'Todas'
                        ? radarItems.length
                        : radarItems.filter((s) => (s.category || 'Setor') === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setRadarCatFilter(cat)}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer ${
                          radarCatFilter === cat
                            ? 'bg-[#15365F] text-white font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-white'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className="font-mono text-[11px]">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    COMO AS INFORMAÇÕES AVANÇAM
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    Rumores ou hipóteses sem comprovação ficam em{' '}
                    <button type="button" onClick={() => goToSection('verificar')} className="text-[#20C5D5] hover:underline cursor-pointer">
                      Informações a verificar
                    </button>{' '}
                    e só viram decisão após confirmação.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* AMBIENTE MACROECONÔMICO (BCB/IBGE/SEFAZ + Gráficos + IA Setorial) */}
      {/* ================================================================ */}
      {section === 'macro' && (() => {
        const macroAiItems = workspace.strategicItems.filter((s) => s.kind === 'macro_ai');
        return (
          <div className="space-y-6">
            <PageHeader
              kicker="INTELIGÊNCIA EXTERNA"
              title="Ambiente macroeconômico"
              description={`Economia, tributação (ICMS ${workspace.company.state || 'UF'}) e indicadores oficiais via Banco Central (SGS), IBGE (SIDRA) e SEFAZ.${macroFetchedAt ? ` Atualizado em ${new Date(macroFetchedAt).toLocaleString('pt-BR')}.` : ''}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={interpretingMacro}
                    onClick={handleInterpretMacro}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3.5 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                  >
                    {interpretingMacro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{interpretingMacro ? 'Interpretando...' : 'Interpretar Cenário Econômico para meu Setor'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={generatingIntelligence}
                    onClick={() => handleGenerateIntelligence('radar')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 bg-[var(--bg-card)] px-3 py-2 text-xs text-[#20C5D5] hover:bg-[#15365F] cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Atualizar Sinais Externos</span>
                  </button>
                </div>
              }
            />

            {macroLoading ? (
              <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#20C5D5]" />
                <span>Consultando Banco Central, IBGE e SEFAZ...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {macroIndicators.map((m) => {
                  const aiMatch = macroAiItems.find((a) => {
                    const meta = (a.metadataJson || {}) as Record<string, string>;
                    return meta.indicatorCode === m.code || a.title.toLowerCase().includes(m.label.toLowerCase().slice(0, 6));
                  });
                  return (
                    <div key={m.code} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                          <span className="truncate">{m.source} · {m.referenceDate || 'Atual'}</span>
                          {m.sourceUrl && (
                            <a
                              href={m.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#20C5D5] hover:underline shrink-0"
                            >
                              <span>Portal</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <h3 className="text-sm font-bold">{m.label}</h3>
                        <div className="text-2xl font-bold font-mono tabular-nums text-[#20C5D5]">
                          {m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível no momento'}
                        </div>
                        {m.comparisonText && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {m.comparisonText}
                          </div>
                        )}
                        {m.status !== 'ok' && m.lastKnownDate && (
                          <div className="text-[11px] text-[#F2B84B]">
                            Último dado oficial conhecido em {m.lastKnownDate}.
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-primary)]">Leitura para seu negócio:</strong>{' '}
                        {aiMatch
                          ? aiMatch.description
                          : hasInternalMetrics && m.code === 'SELIC'
                          ? `Com receita registrada de R$ ${totalRevenueReais.toLocaleString('pt-BR')}, juros altos exigem controle de parcelamento e estoque.`
                          : m.note}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Historical Charts (IPCA 12m, Selic, Câmbio) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {ipcaHistory && ipcaHistory.values.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold">Inflação (IPCA 12 meses)</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">Fonte: {ipcaHistory.source}</p>
                  </div>
                  <TrendLineChart
                    labels={ipcaHistory.labels}
                    series={[{ name: 'IPCA 12m (%)', color: '#20C5D5', values: ipcaHistory.values }]}
                    unitSuffix="%"
                  />
                </div>
              )}
              {selicHistory && selicHistory.values.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold">Taxa Selic Meta (% a.a.)</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">Fonte: {selicHistory.source}</p>
                  </div>
                  <TrendLineChart
                    labels={selicHistory.labels}
                    series={[{ name: 'Selic (%)', color: '#F2B84B', values: selicHistory.values }]}
                    unitSuffix="%"
                  />
                </div>
              )}
              {cambioHistory && cambioHistory.values.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold">Dólar PTAX (R$/USD)</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">Fonte: {cambioHistory.source}</p>
                  </div>
                  <TrendLineChart
                    labels={cambioHistory.labels}
                    series={[{ name: 'Dólar (R$)', color: '#20B981', values: cambioHistory.values }]}
                    unitSuffix=""
                  />
                </div>
              )}
            </div>

            {/* AI Plain-Language Interpretation for Company Segment */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#20C5D5]">
                    TRADUÇÃO PRÁTICA PARA O EMPREENDEDOR
                  </div>
                  <h2 className="text-base font-bold mt-0.5">
                    Como a economia impacta {workspace.company.name} ({workspace.company.segment || 'seu setor'})
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={interpretingMacro}
                  onClick={handleInterpretMacro}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/40 px-3 py-1.5 text-xs text-[#20C5D5] hover:bg-[#15365F] cursor-pointer disabled:opacity-60"
                >
                  {interpretingMacro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{macroAiItems.length > 0 ? 'Atualizar leitura econômica' : 'Gerar leitura para meu setor'}</span>
                </button>
              </div>

              {macroAiItems.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Clique em "Interpretar Cenário Econômico para meu Setor" para que a IA traduza Selic, IPCA, Dólar, PIB, Desemprego e ICMS ({workspace.company.state || 'UF'}) em linguagem simples e decisões práticas para sua empresa.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  {macroAiItems.map((item) => {
                    const meta = (item.metadataJson || {}) as Record<string, string>;
                    return (
                      <div key={item.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-4 space-y-2">
                        <div className="font-bold text-sm text-[#20C5D5]">{item.title}</div>
                        <p className="text-[var(--text-primary)] leading-relaxed">{item.description}</p>
                        {item.impactNote && (
                          <div className="text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">Efeito no seu negócio:</strong> {item.impactNote}
                          </div>
                        )}
                        {meta.practicalTip && (
                          <div className="rounded-md bg-[#20B981]/10 border border-[#20B981]/30 px-3 py-2 text-[#20B981]">
                            <strong>Ação prática:</strong> {meta.practicalTip}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2 text-xs">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#F2B84B]">TRIBUTAÇÃO E LEGISLAÇÃO ({workspace.company.state || 'UF'})</div>
              <p className="text-[var(--text-secondary)]">
                ICMS modal considerado para {workspace.company.state || 'seu estado'} + acompanhamento da transição IBS/CBS. Recomendações tributárias devem sempre ser validadas com seu contador.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* INFORMAÇÕES A VERIFICAR                                          */}
      {/* ================================================================ */}
      {section === 'verificar' && (
        <div className="space-y-5">
          <PageHeader
            kicker="DIAGNÓSTICO"
            title="Informações a verificar"
            description="Sinais, rumores ou dados incompletos pendentes de confirmação antes de embasar decisões da sua empresa."
          />

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic`, {
                  method: 'POST',
                  body: JSON.stringify({
                    ...stratForm,
                    kind: 'verificar',
                    status: 'aberto',
                    metadataJson: {
                      statusNote: 'Pendente de confirmação',
                      relevance: stratForm.impactNote || 'Impacto em avaliação documental',
                      recommendation: 'Confirmar com fonte primária ou documento interno antes de agir.',
                    },
                  }),
                });
                setStratForm({ ...stratForm, title: '', description: '', impactNote: '' });
                showToast('Informação adicionada à fila de verificação.');
                loadWorkspace();
              } catch (err) {
                showToast(err instanceof Error ? err.message : 'Erro ao registrar informação.');
              }
            }}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
          >
            <input type="text" required placeholder="Informação ou rumor a checar *" value={stratForm.title} onChange={(e) => setStratForm({ ...stratForm, title: e.target.value })} className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
            <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">Adicionar para verificar</button>
          </form>

          {pendingVerification.length === 0 ? (
            <EmptyEvidenceBox
              title="Nenhuma informação pendente de verificação"
              description="Quando houver rumores de concorrentes, notas divergentes nos relatórios ou propostas regulatórias para checar, adicione acima ou gere análises com IA."
            />
          ) : (
            pendingVerification.map((item) => {
              const meta = (item.metadataJson || {}) as Record<string, string>;
              const sitLabel = meta.statusNote || 'Pendente de confirmação';
              return (
                <SignalCard
                  key={item.id}
                  code={`V-${item.id}`}
                  kind="pendente"
                  impactLabel={sitLabel}
                  metaRight={item.dueDate || 'Aguardando checagem'}
                  title={item.title}
                  summary={item.description || 'Aguardando confirmação documental.'}
                  sourceName={meta.sourceName || 'Cadastro interno / IA (a confirmar)'}
                  sourceVerified="Aguardando confirmação"
                  relevance={meta.relevance || item.impactNote || 'Impacto em avaliação'}
                  potentialImpact={item.impactNote || 'Informação em validação'}
                  recommendation={meta.recommendation || 'Confirmar com fonte primária antes de converter em decisão.'}
                  footerActions={
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, { method: 'DELETE' });
                            showToast('Informação descartada.');
                            loadWorkspace();
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Erro ao descartar.');
                          }
                        }}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                      >
                        × Descartar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                status: 'confirmado',
                                metadataJson: { statusNote: 'Confirmada pelo usuário' },
                              }),
                            });
                            showToast('Informação confirmada.');
                            loadWorkspace();
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Erro ao confirmar.');
                          }
                        }}
                        className="rounded-lg bg-[#20C5D5] px-3 py-1.5 text-xs font-semibold text-[#06132D] cursor-pointer"
                      >
                        ✓ Confirmar
                      </button>
                    </>
                  }
                />
              );
            })
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* CONCORRENTES (Google Maps Grounding + Avaliações — PDF p.1 & p.4)*/}
      {/* ================================================================ */}
      {section === 'concorrentes' && (() => {
        const highThreatCount = workspace.competitors.filter((c) => c.threatLevel === 'Impacto alto').length;
        const lowerPriceCount = workspace.competitors.filter((c) => c.priceComparison === 'Abaixo').length;
        const compSignals = workspace.strategicItems.filter(
          (s) => s.kind === 'radar' && s.category === 'Concorrência'
        );

        return (
          <div className="space-y-5">
            <PageHeader
              kicker="INTELIGÊNCIA EXTERNA"
              title="Concorrentes"
              description={`Mapeamento competitivo automático via Google Maps e avaliações públicas · Limite do plano (${currentPlan.name}): ${workspace.competitors.length}/${competitorLimit}.`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToSection('inteligencia-geo')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C5D5]/50 bg-[#15365F] px-3.5 py-2 text-xs font-semibold text-[#20C5D5] hover:bg-[#1b4375] cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Abrir no Mapa Interativo</span>
                  </button>
                  <button
                    type="button"
                    disabled={discoveringCompetitors}
                    onClick={handleDiscoverCompetitors}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                  >
                    {discoveringCompetitors ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                    <span>{discoveringCompetitors ? 'Buscando no Google Maps...' : 'Buscar Concorrentes na Região (Google Maps)'}</span>
                  </button>
                </div>
              }
            />

            <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 p-3.5 text-xs text-[#F2B84B]">
              Aviso metodológico: preço anunciado por concorrentes não significa preço efetivamente praticado, e avaliações públicas no Google Maps representam amostra parcial do mercado.
            </div>

            {discoveredSummary && (
              <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-4 space-y-2 text-xs">
                <div className="font-bold text-[#20C5D5] flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>Resumo da pesquisa regional (Google Maps)</span>
                </div>
                <p className="text-[var(--text-secondary)]">{discoveredSummary}</p>
                {discoveredMapsLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {discoveredMapsLinks.map((lnk) => (
                      <a
                        key={lnk.uri}
                        href={lnk.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-2.5 py-1 text-[11px] text-[#20C5D5] hover:border-[#20C5D5]"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>{lnk.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <KpiStatCard title="Monitorados" value={`${workspace.competitors.length}/${competitorLimit}`} subtitle="Empresas acompanhadas" />
              <KpiStatCard title="Ameaça alta" value={highThreatCount} subtitle="Exige resposta rápida" tone="red" />
              <KpiStatCard title="Preço abaixo do nosso" value={lowerPriceCount} subtitle="Pressão competitiva" tone="amber" />
              <KpiStatCard title="Movimentos no Radar" value={compSignals.length} subtitle="Sinais de concorrência" tone="amber" />
            </div>

            {workspace.competitors.length === 0 ? (
              <EmptyEvidenceBox
                title="Nenhum concorrente cadastrado ainda"
                description={`Clique em "Buscar Concorrentes na Região (Google Maps)" para que a IA localize automaticamente concorrentes próximos a ${workspace.company.city || 'sua cidade'} com notas e avaliações reais, ou adicione manualmente abaixo.`}
                actionLabel={discoveringCompetitors ? 'Buscando...' : 'Buscar no Google Maps'}
                onAction={handleDiscoverCompetitors}
              />
            ) : (
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  DOSSIÊ COMPETITIVO REGIONAL ({workspace.competitors.length})
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {workspace.competitors.map((c) => {
                    const dossier: {
                      snippets?: string[];
                      locationDistance?: string;
                      positivesNote?: string;
                      negativesNote?: string;
                      productsPromotions?: string;
                      differentials?: string;
                      threatsOpportunities?: string;
                      consultedAt?: string;
                    } =
                      !Array.isArray(c.reviewSnippetsJson) && c.reviewSnippetsJson && typeof c.reviewSnippetsJson === 'object'
                        ? c.reviewSnippetsJson
                        : {};
                    const snippets: string[] = Array.isArray(c.reviewSnippetsJson)
                      ? c.reviewSnippetsJson
                      : Array.isArray(dossier.snippets)
                      ? dossier.snippets
                      : [];
                    return (
                      <div key={c.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-[var(--text-primary)]">{c.name}</h3>
                              <StatusBadge
                                kind={
                                  c.threatLevel === 'Impacto alto'
                                    ? 'ameaca'
                                    : c.threatLevel === 'Impacto baixo'
                                    ? 'oportunidade'
                                    : 'alerta'
                                }
                                customLabel={c.threatLevel || 'Impacto médio'}
                              />
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                              {c.segment || '-'} · {dossier.locationDistance || c.positioning || 'Localização regional'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/beta/companies/${activeCompanyId}/competitors/${c.id}`, { method: 'DELETE' });
                                showToast('Concorrente removido.');
                                loadWorkspace();
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Erro ao remover concorrente.');
                              }
                            }}
                            className="text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer"
                            aria-label="Remover concorrente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                          {c.publicRating && (
                            <span className="inline-flex items-center gap-1 text-[#F2B84B] font-semibold">
                              <Star className="h-3.5 w-3.5" />
                              <span>{c.publicRating}</span>
                            </span>
                          )}
                          <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-2 py-0.5">
                            Preço vs. nós: {c.priceComparison || 'Não informado'}
                          </span>
                          {(c.channels || c.shippingInfo) && (
                            <span className="text-[var(--text-secondary)]">Canais: {c.channels || c.shippingInfo}</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="rounded-lg border border-[#20B981]/30 bg-[#20B981]/10 p-3 space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#20B981]">PONTOS POSITIVOS</div>
                            <div className="text-[var(--text-primary)]">{dossier.positivesNote || 'Sem registro público detalhado.'}</div>
                          </div>
                          <div className="rounded-lg border border-[#EF6464]/30 bg-[#EF6464]/10 p-3 space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#EF6464]">PONTOS NEGATIVOS / CRÍTICAS</div>
                            <div className="text-[var(--text-primary)]">{dossier.negativesNote || c.complaintsNote || 'Sem reclamações públicas registradas.'}</div>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[var(--text-secondary)]">
                          <div>
                            <strong className="text-[var(--text-primary)]">Produtos, serviços e promoções divulgadas:</strong>{' '}
                            {dossier.productsPromotions || c.announcedPriceRange || 'Não divulgado publicamente'}
                          </div>
                          {dossier.differentials && (
                            <div>
                              <strong className="text-[var(--text-primary)]">Diferenciais competitivos:</strong>{' '}
                              {dossier.differentials}
                            </div>
                          )}
                          {(dossier.threatsOpportunities || c.lastChangeNote) && (
                            <div>
                              <strong className="text-[var(--text-primary)]">Ameaças e oportunidades:</strong>{' '}
                              {dossier.threatsOpportunities || c.lastChangeNote}
                            </div>
                          )}
                        </div>

                        {snippets.length > 0 && (
                          <div className="space-y-1">
                            {snippets.slice(0, 2).map((sn, i) => (
                              <div key={i} className="text-[11px] italic text-[var(--text-secondary)] border-l-2 border-[#20C5D5]/40 pl-2">
                                "{sn}"
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                          <span>Consultado em: {dossier.consultedAt || 'Atual'}</span>
                          {c.sourceUrl && (
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#20C5D5] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Abrir fonte consultada</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiFetch(`/api/beta/companies/${activeCompanyId}/competitors`, {
                    method: 'POST',
                    body: JSON.stringify(compForm),
                  });
                  setCompForm({ name: '', segment: '', positioning: '', announcedPriceRange: '', shippingInfo: '', deliveryDays: '', publicRating: '', complaintsNote: '' });
                  showToast('Concorrente adicionado.');
                  loadWorkspace();
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Erro ao adicionar concorrente.');
                }
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
            >
              <div className="sm:col-span-3 font-semibold text-sm">Adicionar concorrente manualmente</div>
              <input type="text" required placeholder="Nome do concorrente *" value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <input type="text" placeholder="Preços anunciados (ex.: R$ 150-300)" value={compForm.announcedPriceRange} onChange={(e) => setCompForm({ ...compForm, announcedPriceRange: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <input type="text" placeholder="Frete / Prazos" value={compForm.shippingInfo} onChange={(e) => setCompForm({ ...compForm, shippingInfo: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <input type="text" placeholder="Posicionamento" value={compForm.positioning} onChange={(e) => setCompForm({ ...compForm, positioning: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <input type="text" placeholder="Avaliação pública / Reclamações" value={compForm.complaintsNote} onChange={(e) => setCompForm({ ...compForm, complaintsNote: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">
                Adicionar Concorrente
              </button>
            </form>

            {compSignals.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">MOVIMENTOS RECENTES DE CONCORRÊNCIA</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {compSignals.map((s) => {
                    const meta = (s.metadataJson || {}) as Record<string, string>;
                    return (
                      <SignalCard
                        key={s.id}
                        code={`SIG-${s.id}`}
                        kind={(meta.signalKind as 'oportunidade' | 'ameaca' | 'movimento' | 'pendente') || 'movimento'}
                        impactLabel={meta.impactLabel || (s.priority === 'alta' ? 'Impacto alto' : 'Impacto médio')}
                        category="Concorrência"
                        metaRight={s.dueDate || 'Atual'}
                        title={s.title}
                        summary={s.description}
                        sourceName={meta.sourceName || 'Radar / Google Maps'}
                        sourceVerified={meta.sourceUrl ? 'Google Maps / Fonte externa' : 'Monitoramento competitivo'}
                        relevance={meta.relevance || s.impactNote || 'Impacto competitivo regional'}
                        potentialImpact={s.impactNote || (s.priority === 'alta' ? 'Impacto alto' : 'Impacto médio')}
                        recommendation={meta.recommendation || 'Avaliar reação comercial e posicionamento de preço.'}
                        footerActions={
                          meta.sourceUrl ? (
                            <a
                              href={meta.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-[#20C5D5] hover:border-[#20C5D5]"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver no Google Maps</span>
                            </a>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* INTELIGÊNCIA GEOGRÁFICA, MERCADOLÓGICA E COMPETITIVA (Google Maps)*/}
      {/* ================================================================ */}
      {section === 'inteligencia-geo' && (
        <GeoIntelligenceModule
          company={workspace.company}
          units={workspace.units}
          apiFetch={apiFetch}
          onWorkspaceRefresh={loadWorkspace}
        />
      )}

      {/* ================================================================ */}
      {/* ANÁLISES ESTRATÉGICAS (SWOT 4-box + PESTEL + Porter + TOWS + IA) */}
      {/* ================================================================ */}
      {section === 'analises' && (() => {
        const swotItems = workspace.strategicItems.filter((s) => s.kind === 'swot');
        const ongoingAnalyses = workspace.strategicItems.filter((s) => s.kind === 'analysis');
        return (
          <div className="space-y-6">
            <PageHeader
              kicker="ESTRATÉGIA E EXECUÇÃO"
              title="Análises estratégicas"
              description="Leituras SWOT/FOFA, PESTEL, 5 Forças de Porter, Matriz TOWS e Fichas de Evidência geradas a partir dos dados e documentos."
              actions={
                <div className="flex flex-wrap gap-1.5 text-xs items-center">
                  <button
                    type="button"
                    disabled={generatingIntelligence}
                    onClick={() => handleGenerateIntelligence('strategy')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3 py-1.5 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60 mr-1"
                  >
                    {generatingIntelligence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{generatingIntelligence ? 'Gerando...' : 'Gerar Análises com IA'}</span>
                  </button>
                  {[
                    { id: 'swot', label: 'SWOT / FOFA' },
                    { id: 'pestel', label: 'PESTEL' },
                    { id: 'porter', label: 'Porter' },
                    { id: 'tows', label: 'TOWS' },
                    { id: 'evidencias', label: 'Fichas de Evidência' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAnalysisTab(t.id as typeof analysisTab)}
                      className={`rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
                        analysisTab === t.id
                          ? 'bg-[#F4F8FF] text-[#06132D] font-semibold'
                          : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              }
            />

            {analysisTab === 'swot' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">VISÃO SWOT</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                  {[
                    { label: 'Forças', match: 'for', border: 'border-[#20C5D5]' },
                    { label: 'Fraquezas', match: 'fra', border: 'border-[#F2B84B]' },
                    { label: 'Oportunidades', match: 'opo', border: 'border-[#20B981]' },
                    { label: 'Ameaças', match: 'ame', border: 'border-[#EF6464]' },
                  ].map((quad) => {
                    const qItems = swotItems.filter((i) =>
                      (i.category || '').toLowerCase().startsWith(quad.match)
                    );
                    return (
                      <div key={quad.label} className={`rounded-xl border-t-2 ${quad.border} border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2`}>
                        <div className="font-bold text-sm">{quad.label}</div>
                        {qItems.length === 0 ? (
                          <p className="text-[var(--text-secondary)]">Clique em "Gerar Análises com IA" ou adicione abaixo.</p>
                        ) : (
                          <ul className="space-y-1.5 text-[var(--text-secondary)]">
                            {qItems.map((x) => (
                              <li key={x.id}>
                                <span className="text-[var(--text-primary)] font-medium">{x.title}</span>
                                {x.description ? ` — ${x.description}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {analysisTab === 'evidencias' ? (
              <div className="space-y-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await apiFetch(`/api/beta/companies/${activeCompanyId}/evidence`, {
                        method: 'POST',
                        body: JSON.stringify({
                          ...evidenceForm,
                          crossQualityScore: crossQuality.score,
                          hasSufficientEvidence: Boolean(evidenceForm.externalFinding && evidenceForm.internalDataUsed),
                        }),
                      });
                      setEvidenceForm({ moduleKey: 'geral', title: '', externalFinding: '', internalDataUsed: '', source: '', method: 'Cruzamento externo × interno', limitations: '', verificationNeeded: '' });
                      showToast('Ficha de evidência registrada.');
                      loadWorkspace();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao registrar ficha.');
                    }
                  }}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
                >
                  <input type="text" required placeholder="Título da ficha *" value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <input type="text" required placeholder="Fonte e data *" value={evidenceForm.source} onChange={(e) => setEvidenceForm({ ...evidenceForm, source: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <input type="text" required placeholder="Achado externo *" value={evidenceForm.externalFinding} onChange={(e) => setEvidenceForm({ ...evidenceForm, externalFinding: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <input type="text" required placeholder="Dado interno utilizado *" value={evidenceForm.internalDataUsed} onChange={(e) => setEvidenceForm({ ...evidenceForm, internalDataUsed: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <input type="text" placeholder="Limitações metodológicas" value={evidenceForm.limitations} onChange={(e) => setEvidenceForm({ ...evidenceForm, limitations: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">
                    Registrar Ficha de Evidência
                  </button>
                </form>

                {workspace.evidenceCards.length === 0 ? (
                  <EmptyEvidenceBox title={NO_EVIDENCE_MSG} description="Registre acima uma Ficha de Evidência cruzando achados externos com métricas ou produtos internos." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {workspace.evidenceCards.map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-2">
                        <div className="flex justify-between text-[var(--text-secondary)]">
                          <span>{ev.moduleKey} · {ev.referenceDate}</span>
                          <span className="font-mono font-bold text-[#20C5D5]">Qualidade: {ev.crossQualityScore}/100</span>
                        </div>
                        <h3 className="text-sm font-bold">{ev.title}</h3>
                        <p><strong>Achado externo:</strong> {ev.externalFinding}</p>
                        <p><strong>Dado interno:</strong> {ev.internalDataUsed}</p>
                        <p className="text-[var(--text-secondary)]"><strong>Fonte:</strong> {ev.source} · <strong>Método:</strong> {ev.method}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic`, {
                        method: 'POST',
                        body: JSON.stringify({ ...stratForm, kind: analysisTab }),
                      });
                      setStratForm({ ...stratForm, title: '', description: '', impactNote: '' });
                      showToast('Análise registrada.');
                      loadWorkspace();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao registrar análise.');
                    }
                  }}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
                >
                  <input type="text" required placeholder={`Novo fator ${analysisTab.toUpperCase()} *`} value={stratForm.title} onChange={(e) => setStratForm({ ...stratForm, title: e.target.value })} className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <input type="text" placeholder="Categoria (Força/Fraqueza/Político/SO...)" value={stratForm.category} onChange={(e) => setStratForm({ ...stratForm, category: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                  <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">Adicionar</button>
                  <textarea rows={2} placeholder="Descrição e evidências relacionadas..." value={stratForm.description} onChange={(e) => setStratForm({ ...stratForm, description: e.target.value })} className="sm:col-span-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                </form>

                <div className="space-y-3">
                  {workspace.strategicItems.filter((s) => s.kind === analysisTab).map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs flex justify-between gap-4">
                      <div>
                        <div className="text-[11px] text-[#20C5D5] font-semibold">{item.category || analysisTab.toUpperCase()}</div>
                        <div className="text-sm font-bold mt-0.5">{item.title}</div>
                        <p className="text-[var(--text-secondary)] mt-1">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, { method: 'DELETE' });
                            loadWorkspace();
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Erro ao excluir.');
                          }
                        }}
                        className="text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer self-start"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Análises em curso (Leituras aprofundadas da IA) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">ANÁLISES EM CURSO</span>
                <span className="text-[var(--text-secondary)]">{ongoingAnalyses.length} análise(s)</span>
              </div>
              {ongoingAnalyses.length === 0 ? (
                <EmptyEvidenceBox
                  title="Nenhuma análise consolidada em curso ainda"
                  description="Clique em 'Gerar Análises com IA' para cruzar seus documentos, macroeconomia e concorrentes em leituras estratégicas."
                  actionLabel={generatingIntelligence ? 'Gerando...' : 'Gerar Análises com IA'}
                  onAction={() => handleGenerateIntelligence('strategy')}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {ongoingAnalyses.map((a) => {
                    const meta = (a.metadataJson || {}) as {
                      classification?: string;
                      problem?: string;
                      evidenceSummary?: string;
                      dataSourcesUsed?: string;
                      strategicRecommendation?: string;
                      justification?: string;
                      originSignals?: Array<{ kind: string; text: string }>;
                    };
                    const clsKind =
                      meta.classification === 'oportunidade'
                        ? 'oportunidade'
                        : meta.classification === 'ameaca'
                        ? 'ameaca'
                        : 'alerta';
                    return (
                      <div key={a.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--text-secondary)]">A-{a.id}</span>
                            <StatusBadge kind={clsKind} customLabel={meta.classification === 'oportunidade' ? 'Oportunidade' : meta.classification === 'ameaca' ? 'Ameaça' : 'Atenção'} />
                            <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#20C5D5]">{a.category || 'Estratégia'}</span>
                          </div>
                          <span className="text-[11px] text-[var(--text-secondary)]">{a.dueDate || 'Atualizada'}</span>
                        </div>
                        <h3 className="text-base font-bold">{a.title}</h3>
                        {meta.problem && (
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">PROBLEMA IDENTIFICADO</div>
                            <p className="text-[var(--text-primary)] mt-0.5">{meta.problem}</p>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">EVIDÊNCIAS ENCONTRADAS</div>
                          <p className="text-[var(--text-secondary)] border-l-2 border-[#20C5D5]/50 pl-3 mt-0.5">
                            {meta.evidenceSummary || a.description}
                          </p>
                        </div>
                        {meta.dataSourcesUsed && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">Informações utilizadas:</strong> {meta.dataSourcesUsed}
                          </div>
                        )}
                        {a.impactNote && (
                          <div className="text-[11px] text-[#F2B84B]">
                            <strong>Impacto potencial:</strong> {a.impactNote}
                          </div>
                        )}
                        {meta.strategicRecommendation && (
                          <div className="rounded-lg border border-[#20C5D5]/30 bg-[#15365F]/40 p-3 space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#20C5D5]">RECOMENDAÇÃO ESTRATÉGICA</div>
                            <div className="text-[var(--text-primary)] font-medium">{meta.strategicRecommendation}</div>
                            {meta.justification && (
                              <div className="text-[11px] text-[var(--text-secondary)]">
                                <strong>Justificativa:</strong> {meta.justification}
                              </div>
                            )}
                          </div>
                        )}
                        {Array.isArray(meta.originSignals) && meta.originSignals.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">SINAIS DE ORIGEM</div>
                            {meta.originSignals.map((os, i) => (
                              <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 px-3 py-2 flex items-center gap-2">
                                <StatusBadge kind={os.kind === 'oportunidade' ? 'oportunidade' : os.kind === 'ameaca' ? 'ameaca' : 'movimento'} />
                                <span className="truncate">{os.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* CENTRAL DE DECISÕES / PLANOS DE AÇÃO / OPORTUNIDADES             */}
      {/* ================================================================ */}
      {(['decisoes', 'planos-acao', 'oportunidades'] as BetaSection[]).includes(section) && (() => {
        const allDecisions = workspace.strategicItems.filter((s) => s.kind === 'decision');
        const allPlans = workspace.strategicItems.filter((s) => s.kind === 'action_plan');

        return (
          <div className="space-y-5">
            <PageHeader
              kicker="ESTRATÉGIA E DECISÃO"
              title={
                section === 'decisoes'
                  ? 'Central de decisões'
                  : section === 'planos-acao'
                  ? 'Planos de ação'
                  : 'Oportunidades identificadas'
              }
              description={
                section === 'decisoes'
                  ? 'Aprove para enviar automaticamente as tarefas de execução para Planos de ação, ou adie/descarte.'
                  : section === 'planos-acao'
                  ? 'Ações geradas a partir das decisões aprovadas com recursos, indicadores e acompanhamento por IA.'
                  : 'Sinais de mercado com potencial positivo mapeado pela IA e equipe.'
              }
              actions={
                section === 'planos-acao' ? (
                  <button
                    type="button"
                    disabled={reviewingPlans}
                    onClick={handleReviewActionPlans}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3.5 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                  >
                    {reviewingPlans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{reviewingPlans ? 'Avaliando progresso...' : 'Acompanhar Progresso com IA'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={generatingIntelligence}
                    onClick={() => handleGenerateIntelligence('strategy')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-3.5 py-2 text-xs font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer disabled:opacity-60"
                  >
                    {generatingIntelligence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{generatingIntelligence ? 'Gerando...' : 'Gerar Recomendações com IA'}</span>
                  </button>
                )
              }
            />

            {section === 'planos-acao' && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <KpiStatCard title="A fazer" value={allPlans.filter((a) => a.status === 'a_fazer').length} subtitle="Aguardando início" />
                  <KpiStatCard title="Em andamento" value={allPlans.filter((a) => a.status === 'em_andamento' || a.status === 'aberto').length} subtitle="Em execução" tone="amber" />
                  <KpiStatCard title="Concluídas" value={allPlans.filter((a) => a.status === 'concluido').length} subtitle="Entregues" tone="green" />
                  <KpiStatCard title="Aguardando decisão" value={pendingDecisions.length} subtitle="Filtrar pendentes" tone="cyan" onClick={() => setPlanFilter('aguardando_decisao')} />
                </div>

                {planReview && (
                  <div className="rounded-xl border border-[#20C5D5]/40 bg-[#15365F]/50 p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-[#20C5D5] flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        <span>Acompanhamento de Execução pela IA</span>
                      </div>
                      <button type="button" onClick={() => setPlanReview(null)} className="text-[var(--text-secondary)] hover:text-white cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[var(--text-primary)]">{planReview.overallSummary}</p>
                    {planReview.alerts.length > 0 && (
                      <div className="space-y-1 text-[#F2B84B]">
                        <div className="font-semibold uppercase text-[10px]">ALERTAS</div>
                        {planReview.alerts.map((al, i) => <div key={i}>• {al}</div>)}
                      </div>
                    )}
                    {planReview.recommendations.length > 0 && (
                      <div className="space-y-1 text-[#20B981]">
                        <div className="font-semibold uppercase text-[10px]">PRÓXIMAS RECOMENDAÇÕES</div>
                        {planReview.recommendations.map((rec, i) => <div key={i}>• {rec}</div>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { id: 'todos', label: `Todas (${allPlans.length})` },
                    { id: 'a_fazer', label: `A fazer (${allPlans.filter((a) => a.status === 'a_fazer').length})` },
                    { id: 'em_andamento', label: `Em andamento (${allPlans.filter((a) => a.status === 'em_andamento' || a.status === 'aberto').length})` },
                    { id: 'concluido', label: `Concluído (${allPlans.filter((a) => a.status === 'concluido').length})` },
                    { id: 'aguardando_decisao', label: `Aguardando decisão (${pendingDecisions.length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPlanFilter(f.id as typeof planFilter)}
                      className={`rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
                        planFilter === f.id ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const kindMap: Record<string, string> = {
                    decisoes: 'decision',
                    'planos-acao': 'action_plan',
                    oportunidades: 'opportunity',
                  };
                  await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic`, {
                    method: 'POST',
                    body: JSON.stringify({
                      ...stratForm,
                      kind: kindMap[section],
                      status: section === 'planos-acao' ? 'a_fazer' : 'aberto',
                      metadataJson: section === 'planos-acao' ? { completionPct: 0, owner: workspace.company.name, resources: 'Equipe interna', kpi: 'Conclusão dentro do prazo' } : {},
                    }),
                  });
                  setStratForm({ ...stratForm, title: '', description: '', impactNote: '' });
                  showToast('Registro salvo no PostgreSQL.');
                  loadWorkspace();
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Erro ao salvar item.');
                }
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
            >
              <input type="text" required placeholder="Título *" value={stratForm.title} onChange={(e) => setStratForm({ ...stratForm, title: e.target.value })} className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <input type="text" placeholder="Resultado/Impacto esperado" value={stratForm.impactNote} onChange={(e) => setStratForm({ ...stratForm, impactNote: e.target.value })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
              <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">Adicionar Item</button>
              <textarea rows={2} placeholder="Evidência e detalhes..." value={stratForm.description} onChange={(e) => setStratForm({ ...stratForm, description: e.target.value })} className="sm:col-span-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
            </form>

            {section === 'decisoes' && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: 'aberto', label: `Pendentes (${allDecisions.filter((d) => d.status === 'aberto').length})` },
                  { id: 'aprovada', label: `Aprovadas (${allDecisions.filter((d) => d.status === 'aprovada').length})` },
                  { id: 'adiada', label: `Adiadas (${allDecisions.filter((d) => d.status === 'adiada').length})` },
                  { id: 'recusada', label: `Descartadas (${allDecisions.filter((d) => d.status === 'recusada').length})` },
                  { id: 'todas', label: `Todas (${allDecisions.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDecisionFilter(t.id as typeof decisionFilter)}
                    className={`rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
                      decisionFilter === t.id ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {section === 'planos-acao' ? (
              planFilter === 'aguardando_decisao' ? (
                pendingDecisions.length === 0 ? (
                  <EmptyEvidenceBox
                    title="Nenhuma decisão pendente"
                    description="Todas as recomendações estratégicas já foram avaliadas na Central de decisões."
                  />
                ) : (
                  <div className="space-y-3">
                    {pendingDecisions.map((d) => (
                      <div key={d.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-mono text-[#F2B84B]">D-{d.id} · Aguardando decisão</div>
                          <div className="font-bold text-sm mt-0.5">{d.title}</div>
                          <div className="text-[var(--text-secondary)] mt-0.5">{d.impactNote || d.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await apiFetch<{ generatedActionsCount?: number }>(`/api/beta/companies/${activeCompanyId}/strategic/${d.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'aprovada' }),
                              });
                              showToast(res.generatedActionsCount ? `Aprovada! ${res.generatedActionsCount} tarefa(s) gerada(s).` : 'Decisão aprovada.');
                              setPlanFilter('todos');
                              loadWorkspace();
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Erro ao aprovar.');
                            }
                          }}
                          className="rounded-lg bg-[#20C5D5] px-3 py-2 font-semibold text-[#06132D] cursor-pointer"
                        >
                          Aprovar e gerar tarefas →
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (() => {
                const visiblePlans = allPlans.filter((a) => {
                  if (planFilter === 'todos') return true;
                  if (planFilter === 'em_andamento') return a.status === 'em_andamento' || a.status === 'aberto';
                  return a.status === planFilter;
                });

                if (visiblePlans.length === 0) {
                  return (
                    <EmptyEvidenceBox
                      title="Nenhuma ação neste filtro"
                      description="Aprove recomendações na Central de decisões para que a IA quebre automaticamente em tarefas executáveis aqui."
                      actionLabel="Ir para Central de decisões"
                      onAction={() => goToSection('decisoes')}
                    />
                  );
                }

                return (
                  <div className="space-y-4">
                    {Array.from(
                      new Set(
                        visiblePlans.map((p) =>
                          String((p.metadataJson as Record<string, unknown>)?.decisionId || 'manual')
                        )
                      )
                    ).map((decKey) => {
                      const group = visiblePlans.filter(
                        (p) =>
                          String((p.metadataJson as Record<string, unknown>)?.decisionId || 'manual') === decKey
                      );
                      const avgPct = Math.round(
                        group.reduce((acc, g) => {
                          const metaPct = Number((g.metadataJson as Record<string, unknown>)?.completionPct);
                          if (g.status === 'concluido') return acc + 100;
                          if (Number.isFinite(metaPct)) return acc + metaPct;
                          return acc + (g.status === 'em_andamento' ? 50 : 0);
                        }, 0) / group.length
                      );
                      const decTitle = String(
                        (group[0].metadataJson as Record<string, unknown>)?.decisionTitle ||
                          (decKey === 'manual' ? 'Ações cadastradas manualmente' : `Decisão D-${decKey}`)
                      );
                      return (
                        <div key={decKey} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                                {decKey === 'manual' ? 'MANUAL' : `D-${decKey}`}
                              </div>
                              <h3 className="text-base font-bold">{decTitle}</h3>
                            </div>
                            <div className="flex items-center gap-3 w-48">
                              <div className="flex-1 h-2 rounded-full bg-[var(--bg-card-secondary)] overflow-hidden">
                                <div className="h-full bg-[#20C5D5]" style={{ width: `${avgPct}%` }} />
                              </div>
                              <span className="font-mono text-xs font-semibold">{avgPct}%</span>
                            </div>
                          </div>
                          <div className="divide-y divide-[var(--border-subtle)]">
                            {group.map((act) => {
                              const actMeta = (act.metadataJson || {}) as Record<string, unknown>;
                              const owner = String(actMeta.owner || workspace.company.name);
                              const resources = String(actMeta.resources || 'Equipe interna / orçamento operacional');
                              const kpi = String(actMeta.kpi || act.impactNote || 'Conclusão no prazo');
                              const compPct =
                                act.status === 'concluido'
                                  ? 100
                                  : Number.isFinite(Number(actMeta.completionPct))
                                  ? Number(actMeta.completionPct)
                                  : act.status === 'em_andamento'
                                  ? 50
                                  : 0;
                              return (
                                <div key={act.id} className="py-3.5 space-y-2.5 text-xs">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1 flex-1 min-w-[240px]">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[var(--text-secondary)]">P-{act.id}</span>
                                        <span className="font-bold text-sm text-[var(--text-primary)]">{act.title}</span>
                                        <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#F2B84B]">
                                          Prioridade {act.priority}
                                        </span>
                                      </div>
                                      {act.description && <div className="text-[var(--text-secondary)]">{act.description}</div>}
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                                        <span><strong className="text-[var(--text-primary)]">Responsável:</strong> {owner}</span>
                                        <span><strong className="text-[var(--text-primary)]">Prazo:</strong> {act.dueDate || 'Sem prazo'}</span>
                                        <span><strong className="text-[var(--text-primary)]">Recursos:</strong> {resources}</span>
                                        <span><strong className="text-[var(--text-primary)]">Indicador:</strong> {kpi}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                      <div className="flex flex-wrap gap-1">
                                        {[
                                          { st: 'a_fazer', label: 'A fazer' },
                                          { st: 'em_andamento', label: 'Em andamento' },
                                          { st: 'concluido', label: 'Concluído' },
                                        ].map((opt) => (
                                          <button
                                            key={opt.st}
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const nextPct = opt.st === 'concluido' ? 100 : opt.st === 'a_fazer' ? 0 : Math.max(25, compPct === 100 ? 50 : compPct);
                                                await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${act.id}`, {
                                                  method: 'PATCH',
                                                  body: JSON.stringify({ status: opt.st, metadataJson: { completionPct: nextPct } }),
                                                });
                                                loadWorkspace();
                                              } catch (err) {
                                                showToast(err instanceof Error ? err.message : 'Erro ao atualizar status.');
                                              }
                                            }}
                                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                                              (act.status === opt.st || (opt.st === 'em_andamento' && act.status === 'aberto'))
                                                ? opt.st === 'concluido'
                                                  ? 'bg-[#20B981] text-[#06132D] font-bold'
                                                  : opt.st === 'em_andamento'
                                                  ? 'bg-[#20C5D5] text-[#06132D] font-bold'
                                                  : 'bg-[#F2B84B] text-[#06132D] font-bold'
                                                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>

                                      <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-[var(--text-secondary)] mr-1">Conclusão:</span>
                                        {[0, 25, 50, 75, 100].map((pctVal) => (
                                          <button
                                            key={pctVal}
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const nextStatus = pctVal === 100 ? 'concluido' : pctVal === 0 ? 'a_fazer' : 'em_andamento';
                                                await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${act.id}`, {
                                                  method: 'PATCH',
                                                  body: JSON.stringify({ status: nextStatus, metadataJson: { completionPct: pctVal } }),
                                                });
                                                loadWorkspace();
                                              } catch (err) {
                                                showToast(err instanceof Error ? err.message : 'Erro ao atualizar conclusão.');
                                              }
                                            }}
                                            className={`rounded px-1.5 py-0.5 font-mono cursor-pointer ${
                                              compPct === pctVal
                                                ? 'bg-[#15365F] text-[#20C5D5] font-bold border border-[#20C5D5]/50'
                                                : 'text-[var(--text-secondary)] hover:text-white'
                                            }`}
                                          >
                                            {pctVal}%
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div className="space-y-4">
                {workspace.strategicItems
                  .filter((s) => {
                    const targetKind = section === 'decisoes' ? 'decision' : 'opportunity';
                    if (s.kind !== targetKind) return false;
                    if (section === 'decisoes' && decisionFilter !== 'todas') {
                      return s.status === decisionFilter;
                    }
                    return true;
                  })
                  .map((item) => {
                    const meta = (item.metadataJson || {}) as Record<string, string>;
                    return (
                      <div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[var(--text-secondary)]">
                              {section === 'decisoes' ? `D-${item.id}` : `OP-${item.id}`}
                            </span>
                            <StatusBadge
                              kind={
                                item.status === 'aprovada'
                                  ? 'aprovada'
                                  : item.status === 'recusada'
                                  ? 'recusada'
                                  : item.status === 'adiada'
                                  ? 'alerta'
                                  : 'pendente'
                              }
                              customLabel={
                                item.status === 'aberto'
                                  ? 'Pendente'
                                  : item.status === 'recusada'
                                  ? 'Descartada'
                                  : item.status
                              }
                            />
                            <span className="rounded bg-[var(--bg-card-secondary)] px-2 py-0.5 text-[11px] text-[#EF6464]">
                              Prioridade {item.priority}
                            </span>
                          </div>
                          {item.dueDate && <span className="text-[11px] text-[var(--text-secondary)]">Prazo sugerido: {item.dueDate}</span>}
                        </div>

                        <h3 className="text-base font-bold">{item.title}</h3>

                        {section === 'decisoes' ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">PROBLEMA</div>
                                <div className="mt-1">{meta.problem || item.description}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">EVIDÊNCIAS</div>
                                <div className="mt-1 text-[var(--text-secondary)]">{meta.evidence || 'Cruzamento de documentos e sinais do Radar'}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">AÇÃO RECOMENDADA</div>
                                <div className="mt-1">{meta.suggestedAction || item.description}</div>
                              </div>
                            </div>
                            {(meta.justification || meta.kpisToTrack) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]/60">
                                {meta.justification && (
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">JUSTIFICATIVA</div>
                                    <div className="mt-0.5 text-[var(--text-secondary)]">{meta.justification}</div>
                                  </div>
                                )}
                                {meta.kpisToTrack && (
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">INDICADORES PARA ACOMPANHAR</div>
                                    <div className="mt-0.5 text-[#20C5D5]">{meta.kpisToTrack}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[var(--text-secondary)]">{item.description}</p>
                        )}

                        {item.impactNote && (
                          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/60 px-3 py-2 text-[#20B981]">
                            Resultado esperado: <strong className="text-[var(--text-primary)]">{item.impactNote}</strong>
                          </div>
                        )}

                        {section === 'decisoes' && (
                          <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-end gap-2">
                            {item.status !== 'recusada' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'recusada' }),
                                    });
                                    showToast('Decisão descartada.');
                                    loadWorkspace();
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Erro ao descartar.');
                                  }
                                }}
                                className="rounded-lg border border-[#EF6464]/40 px-3 py-1.5 text-[#EF6464] hover:bg-[#EF6464]/10 cursor-pointer"
                              >
                                Descartar
                              </button>
                            )}
                            {item.status !== 'adiada' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/beta/companies/${activeCompanyId}/strategic/${item.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'adiada' }),
                                    });
                                    showToast('Decisão adiada.');
                                    loadWorkspace();
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Erro ao adiar.');
                                  }
                                }}
                                className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-secondary)] hover:text-white cursor-pointer"
                              >
                                Adiar
                              </button>
                            )}
                            {item.status !== 'aprovada' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await apiFetch<{ generatedActionsCount?: number }>(
                                      `/api/beta/companies/${activeCompanyId}/strategic/${item.id}`,
                                      {
                                        method: 'PATCH',
                                        body: JSON.stringify({ status: 'aprovada' }),
                                      }
                                    );
                                    showToast(
                                      res.generatedActionsCount
                                        ? `Decisão aprovada! ${res.generatedActionsCount} tarefa(s) criada(s) em Planos de ação.`
                                        : 'Decisão aprovada!'
                                    );
                                    loadWorkspace();
                                  } catch (err) {
                                    showToast(err instanceof Error ? err.message : 'Erro ao aprovar.');
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#F2B84B] px-3 py-1.5 font-semibold text-[#06132D] cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Aprovar</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* SIMULADOR DE CENÁRIOS (4 cenários comparativos + 6 perguntas IA) */}
      {/* ================================================================ */}
      {section === 'simulador' && (() => {
        const hasBaseData = hasInternalMetrics || workspace.products.length > 0;
        const months = simForm.horizonDays / 30;
        const netUnitPrice = simForm.unitPriceReais * (1 - simForm.impostos / 100);
        const contributionMarginPerUnit = Number((netUnitPrice - simForm.variableCostPerUnit).toFixed(2));
        const marginalGainPerUnit = Number((netUnitPrice - simForm.marginalCostPerUnit).toFixed(2));
        const monthlyPayrollExtra = simForm.extraEmployeesCount * simForm.employeeCostReais;
        const totalFixedMonthly = simForm.fixedCostsReais + monthlyPayrollExtra;
        const breakEvenUnitsMonth =
          contributionMarginPerUnit > 0 ? Math.ceil(totalFixedMonthly / contributionMarginPerUnit) : 0;

        const avgRevenueMonth =
          workspace.metrics.length > 0
            ? workspace.metrics.reduce((s, m) => s + m.revenueCents / 100, 0) / workspace.metrics.length
            : simForm.currentProducedUnits * simForm.unitPriceReais;

        const macroDrag =
          1 -
          (simForm.inflacao / 100) * 0.22 -
          Math.max(0, simForm.selic - 10) * 0.004 -
          Math.max(0, simForm.desemprego - 7) * 0.006 +
          (simForm.pibReal - 2) * 0.008;

        const calcScenario = (
          label: string,
          demandMult: number,
          prodMult: number,
          macroFactor: number,
          usePayrollExtra: boolean
        ) => {
          const soldUnitsMonth = Math.min(
            Math.max(1, simForm.estimatedDemandUnits) * demandMult,
            Math.max(1, simForm.currentProducedUnits) * prodMult +
              (usePayrollExtra ? simForm.marginalProductUnits : 0)
          );
          const rev = Math.round(
            Math.max(soldUnitsMonth * simForm.unitPriceReais, avgRevenueMonth * demandMult) *
              months *
              macroFactor
          );
          const totalFixed = (simForm.fixedCostsReais + (usePayrollExtra ? monthlyPayrollExtra : 0)) * months;
          const totalVariable = soldUnitsMonth * months * simForm.variableCostPerUnit * (1 + simForm.inflacao / 1000);
          const netAfterTax = rev * (1 - simForm.impostos / 100);
          const profit = Math.round(netAfterTax - totalVariable - totalFixed);
          const marginPct = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
          const chance = Math.min(
            95,
            Math.max(
              5,
              Math.round(
                (simForm.targetProfitReais > 0 ? profit / simForm.targetProfitReais : 1) * 70 -
                  Math.max(0, simForm.selic - 11) * 1.4
              )
            )
          );
          return {
            label,
            revenueReais: rev,
            profitReais: profit,
            marginPct,
            targetProbabilityPct: chance,
          };
        };

        const scenarioAtual = calcScenario('Cenário atual', 1.0, 1.0, 1.0, false);
        const scenarioPessimista = calcScenario('Cenário pessimista', 0.85, 0.9, macroDrag * 0.94, simForm.extraEmployeesCount > 0);
        const scenarioRealista = calcScenario(
          'Cenário realista',
          1 + simForm.crescimentoVendas / 100,
          1 + simForm.productionIncreasePct / 100,
          macroDrag,
          simForm.extraEmployeesCount > 0
        );
        const scenarioOtimista = calcScenario(
          'Cenário otimista',
          1 + Math.max(0.12, simForm.crescimentoVendas / 100 + 0.12),
          1 + Math.max(0.15, simForm.productionIncreasePct / 100 + 0.1),
          Math.max(1.0, macroDrag + 0.04),
          simForm.extraEmployeesCount > 0
        );
        const fourScenarios = [scenarioAtual, scenarioPessimista, scenarioRealista, scenarioOtimista];

        const activeScenarioObj =
          simForm.scenarioType === 'pessimista'
            ? scenarioPessimista
            : simForm.scenarioType === 'otimista'
            ? scenarioOtimista
            : scenarioRealista;

        const projectedRevenue = activeScenarioObj.revenueReais;
        const projectedProfit = activeScenarioObj.profitReais;
        const successChancePct = activeScenarioObj.targetProbabilityPct;
        const worthIncreasingProduction = marginalGainPerUnit > 0 && simForm.estimatedDemandUnits >= simForm.currentProducedUnits * 0.9;
        const worthHiring =
          simForm.extraEmployeesCount > 0
            ? simForm.marginalProductUnits * Math.max(0, marginalGainPerUnit) > monthlyPayrollExtra
            : false;

        const fallbackQuestions = {
          worthIncreasingProductionAnswer: worthIncreasingProduction
            ? `Sim, com cautela: cada unidade extra deixa R$ ${marginalGainPerUnit.toFixed(2)} de margem após impostos (${simForm.impostos}%) e há demanda estimada (${simForm.estimatedDemandUnits} un./mês).`
            : `Não agora: a margem livre por unidade extra (R$ ${marginalGainPerUnit.toFixed(2)}) ou a demanda estimada (${simForm.estimatedDemandUnits} un./mês) não sustentam ampliar produção sem pressionar o caixa.`,
          worthHiringAnswer:
            simForm.extraEmployeesCount === 0
              ? `Você definiu 0 funcionário(s) extra(s). Se contratar 1 pessoa por R$ ${simForm.employeeCostReais.toLocaleString('pt-BR')}/mês, ela precisa gerar pelo menos ${marginalGainPerUnit > 0 ? Math.ceil(simForm.employeeCostReais / marginalGainPerUnit) : 'mais'} venda(s) extras por mês para se pagar.`
              : worthHiring
              ? `Compensa: ${simForm.extraEmployeesCount} funcionário(s) adicionam R$ ${monthlyPayrollExtra.toLocaleString('pt-BR')}/mês em folha, mas a produção extra de ${simForm.marginalProductUnits} un. gera R$ ${Math.round(simForm.marginalProductUnits * marginalGainPerUnit).toLocaleString('pt-BR')} de margem.`
              : `Não compensa neste nível: o custo mensal da equipe extra (R$ ${monthlyPayrollExtra.toLocaleString('pt-BR')}) supera a sobra gerada pelas ${simForm.marginalProductUnits} unidades adicionais.`,
          salesCompensateCostsAnswer:
            projectedProfit >= 0
              ? `Sim: no cenário ${simForm.scenarioType}, o faturamento de R$ ${projectedRevenue.toLocaleString('pt-BR')} cobre custos fixos, variáveis e impostos, deixando lucro estimado de R$ ${projectedProfit.toLocaleString('pt-BR')}.`
              : `Não: neste cenário o faturamento não cobre todos os custos, gerando prejuízo estimado de R$ ${Math.abs(projectedProfit).toLocaleString('pt-BR')}. O ponto de equilíbrio exige ${breakEvenUnitsMonth} un./mês.`,
          costIncreaseImpactAnswer: `Com IPCA em ${simForm.inflacao}% e Selic em ${simForm.selic}%, cada aumento de 10% no custo variável reduz sua margem de contribuição para R$ ${(netUnitPrice - simForm.variableCostPerUnit * 1.1).toFixed(2)}/un. e eleva o ponto de equilíbrio mensal.`,
          salesNeededForGoalAnswer:
            contributionMarginPerUnit > 0
              ? `Para cobrir os custos fixos de R$ ${totalFixedMonthly.toLocaleString('pt-BR')}/mês e buscar a meta de R$ ${simForm.targetProfitReais.toLocaleString('pt-BR')} em ${simForm.horizonDays}d, você precisa vender cerca de ${Math.ceil((totalFixedMonthly * months + simForm.targetProfitReais) / contributionMarginPerUnit)} unidade(s) no período.`
              : `Com margem de contribuição negativa ou zero (R$ ${contributionMarginPerUnit.toFixed(2)}), aumentar o volume de vendas não gera lucro — é preciso revisar preço ou reduzir custo variável primeiro.`,
          profitabilityMeasuresAnswer:
            simForm.selic >= 11
              ? `1) Reduza estoque parado (Selic ${simForm.selic}%); 2) Priorize itens com margem acima de R$ ${Math.max(10, Math.round(contributionMarginPerUnit)).toFixed(2)}/un.; 3) Negocie prazo com fornecedores antes de contratar.`
              : `1) Aumente o ticket médio com combos; 2) Controle descontos para não corroer os R$ ${contributionMarginPerUnit.toFixed(2)}/un. de margem; 3) Acompanhe a demanda semanal antes de expandir.`,
        };

        return (
          <div className="space-y-5">
            <PageHeader
              kicker="ESTRATÉGIA E DECISÃO"
              title="Simulador de cenários"
              description="Compare Cenário Atual × Pessimista × Realista × Otimista em linguagem simples, integrando produção, custos, contratação e todos os indicadores oficiais."
            />

            {!hasBaseData && (
              <div className="rounded-xl border border-[#F2B84B]/40 bg-[#F2B84B]/10 p-4 text-xs text-[#F2B84B]">
                {NO_EVIDENCE_MSG} Cadastre produtos ou importe faturamento para que os valores iniciais venham da base real da empresa; enquanto isso, ajuste os parâmetros abaixo para simular hipóteses (com caráter estritamente ilustrativo).
              </div>
            )}

            {/* All live macro indicators integrated banner */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs space-y-2">
              <div className="font-semibold uppercase tracking-wider text-[11px] text-[#20C5D5]">
                INDICADORES OFICIAIS INTEGRADOS AO SIMULADOR ({workspace.company.state || 'UF'})
              </div>
              <div className="flex flex-wrap gap-2.5">
                {macroIndicators.map((m) => (
                  <span key={m.code} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 px-2.5 py-1">
                    {m.label}: <strong className="font-mono text-white">{m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível'}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Inputs Panel */}
              <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3.5 text-xs">
                <div className="flex flex-wrap gap-2 items-center">
                  {(['pessimista', 'realista', 'otimista'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setSimForm({ ...simForm, scenarioType: sc })}
                      className={`px-3 py-1.5 rounded-lg capitalize font-semibold cursor-pointer ${
                        simForm.scenarioType === sc ? 'bg-[#20C5D5] text-[#06132D]' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1">
                    {([30, 90, 180] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSimForm({ ...simForm, horizonDays: h })}
                        className={`px-2.5 py-1.5 rounded-lg font-mono cursor-pointer ${
                          simForm.horizonDays === h ? 'bg-[#F4F8FF] text-[#06132D] font-bold' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {h}d
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <div className="flex justify-between mb-1">
                    <span>Média de vendas (variação %):</span>
                    <span className="font-mono text-[#20C5D5]">{simForm.crescimentoVendas > 0 ? `+${simForm.crescimentoVendas}%` : `${simForm.crescimentoVendas}%`}</span>
                  </div>
                  <input type="range" min={-30} max={45} step={1} value={simForm.crescimentoVendas} onChange={(e) => setSimForm({ ...simForm, crescimentoVendas: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                </label>

                <label className="block">
                  <div className="flex justify-between mb-1">
                    <span>Aumento de produção/compras (%):</span>
                    <span className="font-mono text-[#20C5D5]">+{simForm.productionIncreasePct}%</span>
                  </div>
                  <input type="range" min={0} max={50} step={1} value={simForm.productionIncreasePct} onChange={(e) => setSimForm({ ...simForm, productionIncreasePct: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Quantidade produzida/mês</span>
                    <input type="number" min={1} value={simForm.currentProducedUnits} onChange={(e) => setSimForm({ ...simForm, currentProducedUnits: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Demanda estimada/mês</span>
                    <input type="number" min={1} value={simForm.estimatedDemandUnits} onChange={(e) => setSimForm({ ...simForm, estimatedDemandUnits: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Preço de venda (R$)</span>
                    <input type="number" min={1} step={0.5} value={simForm.unitPriceReais} onChange={(e) => setSimForm({ ...simForm, unitPriceReais: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Custos fixos / mês (R$)</span>
                    <input type="number" min={0} step={100} value={simForm.fixedCostsReais} onChange={(e) => setSimForm({ ...simForm, fixedCostsReais: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Custos variáveis / un. (R$)</span>
                    <input type="number" min={0} step={0.5} value={simForm.variableCostPerUnit} onChange={(e) => setSimForm({ ...simForm, variableCostPerUnit: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Custo marginal / un. (R$)</span>
                    <input type="number" min={0} step={0.5} value={simForm.marginalCostPerUnit} onChange={(e) => setSimForm({ ...simForm, marginalCostPerUnit: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Produto marginal (un. extras)</span>
                    <input type="number" min={1} value={simForm.marginalProductUnits} onChange={(e) => setSimForm({ ...simForm, marginalProductUnits: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Meta de lucro ({simForm.horizonDays}d) (R$)</span>
                    <input type="number" min={500} step={500} value={simForm.targetProfitReais} onChange={(e) => setSimForm({ ...simForm, targetProfitReais: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Funcionários extras (qtd)</span>
                    <input type="number" min={0} max={50} value={simForm.extraEmployeesCount} onChange={(e) => setSimForm({ ...simForm, extraEmployeesCount: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="block text-[var(--text-primary)] font-medium">Custo / funcionário (R$)</span>
                    <input type="number" min={0} step={100} value={simForm.employeeCostReais} onChange={(e) => setSimForm({ ...simForm, employeeCostReais: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 font-mono" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <div className="flex justify-between mb-1"><span>Inflação (IPCA):</span><span className="font-mono text-[#20C5D5]">{simForm.inflacao}%</span></div>
                    <input type="range" min={2} max={15} step={0.25} value={simForm.inflacao} onChange={(e) => setSimForm({ ...simForm, inflacao: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                  </label>
                  <label className="block">
                    <div className="flex justify-between mb-1"><span>Taxa Selic:</span><span className="font-mono text-[#20C5D5]">{simForm.selic}%</span></div>
                    <input type="range" min={6} max={18} step={0.25} value={simForm.selic} onChange={(e) => setSimForm({ ...simForm, selic: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                  </label>
                  <label className="block">
                    <div className="flex justify-between mb-1"><span>Câmbio USD/BRL:</span><span className="font-mono text-[#20C5D5]">R$ {simForm.cambio.toFixed(2)}</span></div>
                    <input type="range" min={4.2} max={7.5} step={0.05} value={simForm.cambio} onChange={(e) => setSimForm({ ...simForm, cambio: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                  </label>
                  <label className="block">
                    <div className="flex justify-between mb-1"><span>ICMS / Impostos ({workspace.company.state || 'UF'}):</span><span className="font-mono text-[#20C5D5]">{simForm.impostos}%</span></div>
                    <input type="range" min={4} max={25} step={0.5} value={simForm.impostos} onChange={(e) => setSimForm({ ...simForm, impostos: Number(e.target.value) })} className="w-full accent-[#20C5D5]" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={advisingSimulator}
                    onClick={async () => {
                      setAdvisingSimulator(true);
                      try {
                        const res = await apiFetch<{
                          verdictSimple: string;
                          explanationSimple: string;
                          worthIncreasingProductionAnswer?: string;
                          worthHiringAnswer?: string;
                          salesCompensateCostsAnswer?: string;
                          costIncreaseImpactAnswer?: string;
                          salesNeededForGoalAnswer?: string;
                          profitabilityMeasuresAnswer?: string;
                          suggestions: string[];
                        }>(`/api/beta/companies/${activeCompanyId}/simulator/advise`, {
                          method: 'POST',
                          body: JSON.stringify({
                            hasSufficientData: hasBaseData,
                            assumptions: {
                              horizonDays: simForm.horizonDays,
                              avgSalesVariationPct: simForm.crescimentoVendas,
                              productionIncreasePct: simForm.productionIncreasePct,
                              currentProducedUnits: simForm.currentProducedUnits,
                              estimatedDemandUnits: simForm.estimatedDemandUnits,
                              fixedCostsReais: simForm.fixedCostsReais,
                              variableCostPerUnit: simForm.variableCostPerUnit,
                              marginalCostPerUnit: simForm.marginalCostPerUnit,
                              marginalProductUnits: simForm.marginalProductUnits,
                              unitPriceReais: simForm.unitPriceReais,
                              extraEmployeesCount: simForm.extraEmployeesCount,
                              employeeCostReais: simForm.employeeCostReais,
                              targetProfitReais: simForm.targetProfitReais,
                            },
                            computed: {
                              worthIncreasingProduction,
                              marginalRevenuePerUnit: Number(netUnitPrice.toFixed(2)),
                              marginalContributionPerUnit: contributionMarginPerUnit,
                              breakEvenUnits: breakEvenUnitsMonth,
                              projectedRevenueReais: projectedRevenue,
                              projectedProfitReais: projectedProfit,
                              successChancePct,
                              fourScenarios,
                            },
                          }),
                        });
                        setSimulatorAdvice(res);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Erro ao consultar IA para metas.');
                      } finally {
                        setAdvisingSimulator(false);
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#20C5D5] py-2.5 px-3 text-[#06132D] font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {advisingSimulator ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{advisingSimulator ? 'Analisando...' : 'Responder com IA'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/beta/companies/${activeCompanyId}/simulations`, {
                          method: 'POST',
                          body: JSON.stringify({
                            name: `Cenário ${simForm.scenarioType} (${simForm.horizonDays}d)`,
                            scenarioType: simForm.scenarioType,
                            horizonDays: simForm.horizonDays,
                            assumptions: simForm,
                          }),
                        });
                        showToast('Simulação salva no PostgreSQL.');
                        loadWorkspace();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Erro ao salvar simulação.');
                      }
                    }}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-4 py-2.5 font-semibold cursor-pointer hover:border-[#20C5D5]"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Results, 4-Scenario Comparison & 6 Questions Panel */}
              <div className="lg:col-span-7 space-y-4 text-xs">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold">Comparação Automática de Cenários ({simForm.horizonDays} dias)</h2>
                    <span className={`rounded-md px-2.5 py-1 font-bold ${
                      successChancePct >= 65
                        ? 'bg-[#20B981]/20 text-[#20B981]'
                        : successChancePct >= 40
                        ? 'bg-[#F2B84B]/20 text-[#F2B84B]'
                        : 'bg-[#EF6464]/20 text-[#EF6464]'
                    }`}>
                      Probabilidade estatística de êxito ({simForm.scenarioType}): {successChancePct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KpiStatCard title="Margem contrib. / un." value={`R$ ${contributionMarginPerUnit.toFixed(2)}`} subtitle="Calculada automaticamente" tone={contributionMarginPerUnit > 0 ? 'cyan' : 'red'} />
                    <KpiStatCard title="Ponto equilíbrio" value={`${breakEvenUnitsMonth} un.`} subtitle="Por mês para empatar" />
                    <KpiStatCard title="Receita est." value={`R$ ${projectedRevenue.toLocaleString('pt-BR')}`} subtitle={simForm.scenarioType} />
                    <KpiStatCard title="Lucro est." value={`R$ ${projectedProfit.toLocaleString('pt-BR')}`} subtitle={`Meta: R$ ${simForm.targetProfitReais.toLocaleString('pt-BR')}`} tone={projectedProfit >= simForm.targetProfitReais ? 'green' : 'amber'} />
                  </div>

                  {/* 4 Scenarios Table */}
                  <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-card-secondary)]/60 text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-3 py-2">Cenário</th>
                          <th className="px-3 py-2">Receita est.</th>
                          <th className="px-3 py-2">Lucro est.</th>
                          <th className="px-3 py-2">Margem</th>
                          <th className="px-3 py-2">Chance de meta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {fourScenarios.map((sc) => (
                          <tr key={sc.label} className={sc.label.toLowerCase().includes(simForm.scenarioType) ? 'bg-[#20C5D5]/10 font-semibold' : ''}>
                            <td className="px-3 py-2">{sc.label}</td>
                            <td className="px-3 py-2 font-mono">R$ {sc.revenueReais.toLocaleString('pt-BR')}</td>
                            <td className={`px-3 py-2 font-mono ${sc.profitReais >= 0 ? 'text-[#20B981]' : 'text-[#EF6464]'}`}>
                              R$ {sc.profitReais.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2 font-mono">{sc.marginPct}%</td>
                            <td className="px-3 py-2 font-mono text-[#20C5D5]">{sc.targetProbabilityPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <SimpleBarChart
                    data={fourScenarios.map((s) => ({
                      label: s.label.replace('Cenário ', ''),
                      value: s.revenueReais,
                      secondaryValue: Math.max(0, s.profitReais),
                    }))}
                    primaryLabel="Receita estimada (R$)"
                    secondaryLabel="Lucro estimado (R$)"
                  />

                  <div className="text-[11px] text-[var(--text-secondary)] italic">
                    Estimativa estatística calculada sobre custos, preços, demanda informada e indicadores BCB/IBGE/SEFAZ (sujeita a variação de ±15% a ±25%). Não garante resultado financeiro.
                  </div>
                </div>

                {/* 6 Questions Answered in Plain Portuguese */}
                <div className="rounded-xl border border-[#20C5D5]/30 bg-[var(--bg-card)] p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#20C5D5]">
                      {simulatorAdvice ? simulatorAdvice.verdictSimple : 'Respostas Diretas ao Empreendedor'}
                    </h3>
                  </div>
                  {simulatorAdvice?.explanationSimple && (
                    <p className="text-[var(--text-primary)]">{simulatorAdvice.explanationSimple}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { q: '1. Vale a pena aumentar a produção?', a: simulatorAdvice?.worthIncreasingProductionAnswer || fallbackQuestions.worthIncreasingProductionAnswer },
                      { q: '2. Vale a pena contratar funcionários extras?', a: simulatorAdvice?.worthHiringAnswer || fallbackQuestions.worthHiringAnswer },
                      { q: '3. O aumento de vendas compensa os custos?', a: simulatorAdvice?.salesCompensateCostsAnswer || fallbackQuestions.salesCompensateCostsAnswer },
                      { q: '4. Qual o impacto do aumento de custos no lucro?', a: simulatorAdvice?.costIncreaseImpactAnswer || fallbackQuestions.costIncreaseImpactAnswer },
                      { q: '5. Quanto vender para atingir o resultado desejado?', a: simulatorAdvice?.salesNeededForGoalAnswer || fallbackQuestions.salesNeededForGoalAnswer },
                      { q: '6. Quais medidas adotar para ganhar rentabilidade?', a: simulatorAdvice?.profitabilityMeasuresAnswer || fallbackQuestions.profitabilityMeasuresAnswer },
                    ].map((qa) => (
                      <div key={qa.q} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/40 p-3 space-y-1">
                        <div className="font-bold text-[var(--text-primary)]">{qa.q}</div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{qa.a}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                  <h2 className="text-sm font-bold">Simulações Salvas ({workspace.simulations.length})</h2>
                  {workspace.simulations.length === 0 ? (
                    <div className="text-[var(--text-secondary)]">Nenhuma simulação salva ainda.</div>
                  ) : (
                    workspace.simulations.map((s) => {
                      const pj = s.projectionsJson as {
                        projectedSalesReais?: number;
                        projectedMarginPct?: number;
                        successChancePct?: number;
                        worthIncreasingProduction?: boolean;
                      };
                      return (
                        <div key={s.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/50 p-3 space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>{s.name}</span>
                            {pj.successChancePct !== undefined && (
                              <span className="font-mono text-[#20C5D5]">Êxito {pj.successChancePct}%</span>
                            )}
                          </div>
                          {s.hasSufficientData ? (
                            <div className="font-mono text-[#20C5D5]">
                              Vendas est.: R$ {Number(pj.projectedSalesReais || 0).toLocaleString('pt-BR')} · Margem est.: {String(pj.projectedMarginPct || '-')}% ·{' '}
                              {pj.worthIncreasingProduction ? 'Expansão viável' : 'Expansão cautelosa'}
                            </div>
                          ) : (
                            <div className="text-[#F2B84B]">{NO_EVIDENCE_MSG}</div>
                          )}
                          <div className="text-[11px] text-[var(--text-secondary)]">{s.uncertaintyNote}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* ASSISTENTE DE INTELIGÊNCIA FULL-PAGE (PDF 2 p.13 + Gemini real)   */}
      {/* ================================================================ */}
      {section === 'assistente' && (
        <div className="space-y-5">
          <PageHeader
            kicker="ESTRATÉGIA E DECISÃO"
            title="Assistente de inteligência"
            description="Pergunte sobre os dados internos da sua empresa, macroeconomia oficial e estratégia."
          />

          <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-4 py-2.5 text-xs text-[#F2B84B]">
            Respostas geradas via Gemini AI usando exclusivamente os registros cadastrados da {workspace.company.name} e fontes oficiais (BCB/IBGE). Não substitui aconselhamento jurídico, contábil ou tributário.
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              'Qual a Qualidade do Cruzamento atual da minha empresa e o que falta preencher?',
              'Como a Selic e o IPCA atuais impactam nossos produtos cadastrados?',
              'Quais riscos competitivos merecem decisão imediata?',
              'Faça um resumo executivo da situação atual da empresa.',
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askFullAssistant(q)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs hover:border-[#20C5D5] cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askFullAssistant(fullAiInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={fullAiInput}
              onChange={(e) => setFullAiInput(e.target.value)}
              placeholder="Faça uma pergunta sobre sua empresa..."
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
            <button
              type="submit"
              disabled={fullAiLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4F8FF] px-5 py-3 text-xs font-semibold text-[#06132D] hover:bg-white cursor-pointer disabled:opacity-60"
            >
              {fullAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Perguntar</span>
            </button>
          </form>

          {(fullAiMessages.length > 0 || fullAiLoading) && (
            <div className="space-y-3">
              {fullAiMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'border-[#20C5D5]/40 bg-[#15365F]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                  }`}
                >
                  <div className="font-semibold text-[11px] uppercase tracking-wider text-[#20C5D5] mb-1">
                    {m.role === 'user' ? 'Você' : `Assistente IA · ${workspace.company.name}`}
                  </div>
                  <p>{m.content}</p>
                  {m.groundingLinks && m.groundingLinks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
                      {m.groundingLinks.map((lnk, lIdx) => (
                        <a
                          key={lIdx}
                          href={lnk.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-[#20C5D5]/30 bg-[#20C5D5]/10 px-2 py-0.5 text-[11px] text-[#20C5D5] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>{lnk.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {m.sourcesUsed && m.sourcesUsed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                      Fontes consultadas: {m.sourcesUsed.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
              {fullAiLoading && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-xs flex items-center gap-2 text-[var(--text-secondary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#20C5D5]" />
                  <span>digitando...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* RELATÓRIOS (8 seções consolidadas) & INDICADORES (3 grupos+Macro)*/}
      {/* ================================================================ */}
      {section === 'relatorios' && (() => {
        const rep = buildExecutiveReportPayload();
        return (
          <div className="space-y-6">
            <PageHeader
              kicker="DESEMPENHO"
              title="Relatórios"
              description="Relatório executivo completo em 8 seções, exportação em PDF/Excel e compartilhamento com fontes e limitações documentadas."
              actions={
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleExportPdf} className="inline-flex items-center gap-1.5 rounded-lg bg-[#20C5D5] px-4 py-2 text-xs font-semibold text-[#06132D] cursor-pointer">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Exportar PDF</span>
                  </button>
                  <button type="button" onClick={handleExportExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-xs cursor-pointer">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-[#20C5D5]" />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              }
            />

            {rep && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#20C5D5]">RELATÓRIO EXECUTIVO CONSOLIDADO (8 SEÇÕES)</div>
                    <h2 className="text-xl font-bold mt-0.5">{rep.companyName}</h2>
                    <div className="text-[var(--text-secondary)]">{rep.generatedAt}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BetaBadge />
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Relatório Gêmeo Digital — ${rep.companyName}: Qualidade do cruzamento ${crossQuality.score}/100.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5 text-[#20C5D5]" />
                      <span>WhatsApp</span>
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`Relatório Gêmeo Digital — ${rep.companyName}`)}&body=${encodeURIComponent(`Resumo executivo da empresa ${rep.companyName}.`)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5"
                    >
                      <span>E-mail</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">1. Diagnóstico da empresa</div>
                    {rep.companyDiagnosis?.map((line, i) => <div key={i} className="text-[var(--text-secondary)]">• {line}</div>)}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">2. Situação do mercado</div>
                    {rep.marketSummary?.slice(0, 4).map((line, i) => <div key={i} className="text-[var(--text-secondary)]">• {line}</div>)}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">3. Análise dos concorrentes ({rep.competitorAnalyses?.length || 0})</div>
                    {rep.competitorAnalyses && rep.competitorAnalyses.length > 0 ? (
                      rep.competitorAnalyses.slice(0, 4).map((c, i) => (
                        <div key={i} className="text-[var(--text-secondary)]">• <strong className="text-[var(--text-primary)]">{c.name}</strong> ({c.threatLevel}): {c.summary}</div>
                      ))
                    ) : (
                      <div className="text-[var(--text-secondary)]">Nenhum concorrente monitorado ainda.</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">4. Indicadores macroeconômicos</div>
                    {rep.indicators.slice(0, 6).map((m, i) => (
                      <div key={i} className="flex justify-between text-[var(--text-secondary)]">
                        <span>{m.label}</span>
                        <strong className="font-mono text-[var(--text-primary)]">{m.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">5. Principais ameaças e oportunidades</div>
                    {rep.threatsAndOpportunities && rep.threatsAndOpportunities.length > 0 ? (
                      rep.threatsAndOpportunities.slice(0, 5).map((t, i) => (
                        <div key={i} className="text-[var(--text-secondary)]">
                          • <span className={t.kind === 'oportunidade' ? 'text-[#20B981]' : 'text-[#EF6464]'}>[{t.kind.toUpperCase()}]</span> {t.title}
                        </div>
                      ))
                    ) : (
                      <div className="text-[var(--text-secondary)]">Gere inteligência no Radar para consolidar ameaças e oportunidades.</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">6. Decisões aprovadas ({rep.approvedDecisions?.length || 0})</div>
                    {rep.approvedDecisions && rep.approvedDecisions.length > 0 ? (
                      rep.approvedDecisions.slice(0, 4).map((d, i) => (
                        <div key={i} className="text-[var(--text-secondary)]">• <strong className="text-[var(--text-primary)]">{d.title}</strong> ({d.dueDate})</div>
                      ))
                    ) : (
                      <div className="text-[var(--text-secondary)]">Nenhuma decisão aprovada ainda.</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">7. Planos de ação ({rep.actionPlansSummary?.length || 0})</div>
                    {rep.actionPlansSummary && rep.actionPlansSummary.length > 0 ? (
                      rep.actionPlansSummary.slice(0, 4).map((p, i) => (
                        <div key={i} className="text-[var(--text-secondary)]">• {p.title} — <strong>{p.status}</strong> ({p.owner})</div>
                      ))
                    ) : (
                      <div className="text-[var(--text-secondary)]">Aprove decisões para gerar planos de ação.</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)]/30 p-4 space-y-1.5">
                    <div className="font-bold text-[#20C5D5]">8. Resultados e indicadores</div>
                    {rep.kpiSummary?.slice(0, 6).map((k, i) => (
                      <div key={i} className="flex justify-between text-[var(--text-secondary)]">
                        <span>{k.label}</span>
                        <strong className="font-mono text-[var(--text-primary)]">{k.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {section === 'indicadores' && (() => {
        const radarAll = workspace.strategicItems.filter((s) => s.kind === 'radar');
        const analysesAll = workspace.strategicItems.filter((s) => s.kind === 'analysis');
        const decisionsAll = workspace.strategicItems.filter((s) => s.kind === 'decision');
        const oppsAll = workspace.strategicItems.filter((s) => s.kind === 'opportunity');
        const docsInterpreted = workspace.imports.filter((i) => i.summaryText || (i.insightsJson && i.insightsJson.length > 0)).length;
        const discoveriesCount =
          workspace.imports.reduce((acc, i) => acc + (Array.isArray(i.insightsJson) ? i.insightsJson.length : 0), 0) +
          analysesAll.length;
        const threatsCount = radarAll.filter((r) => String((r.metadataJson as Record<string, unknown>)?.signalKind) === 'ameaca').length;
        const movementsCount = radarAll.filter((r) =>
          ['movimento', 'movimentacao'].includes(String((r.metadataJson as Record<string, unknown>)?.signalKind))
        ).length;
        const approvedDecisionsCount = decisionsAll.filter((d) => d.status === 'aprovada').length;

        return (
          <div className="space-y-6">
            <PageHeader
              kicker="DESEMPENHO"
              title="Indicadores"
              description="Consolidação real dos 3 grupos operacionais (Inteligência interna, Ambiente externo, Gestão estratégica) e indicadores macroeconômicos oficiais."
            />

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">1. INTELIGÊNCIA INTERNA</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiStatCard title="Documentos analisados" value={workspace.imports.length} subtitle="Arquivos no banco" />
                <KpiStatCard title="Relatórios interpretados" value={docsInterpreted} subtitle="Leitura automática IA" />
                <KpiStatCard title="Descobertas relevantes" value={discoveriesCount} subtitle="Insights + Análises" tone="cyan" />
                <KpiStatCard title="Recomendações geradas" value={decisionsAll.length + oppsAll.length} subtitle="Decisões + Oportunidades" tone="green" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">2. AMBIENTE EXTERNO</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiStatCard title="Notícias verificadas" value={radarAll.length} subtitle="Sinais no Radar" />
                <KpiStatCard title="Ameaças identificadas" value={threatsCount} subtitle="Monitoramento ativo" tone="red" />
                <KpiStatCard title="Movimentações de mercado" value={movementsCount} subtitle="Setor e concorrência" tone="cyan" />
                <KpiStatCard title="Informações pendentes" value={pendingVerification.length} subtitle="Em verificação" tone="amber" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">3. GESTÃO ESTRATÉGICA</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <KpiStatCard title="Recomendações aguardando aprovação" value={pendingDecisions.length} subtitle="Central de decisões" tone="amber" />
                <KpiStatCard title="Decisões aprovadas" value={approvedDecisionsCount} subtitle="Enviadas para execução" tone="green" />
                <KpiStatCard title="Ações em andamento" value={openActions.length} subtitle="Planos de ação" tone="cyan" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">4. FINANCEIRO, ESTOQUE & PERCEPÇÃO DOS CONSUMIDORES (SINCRONIZADO)</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <KpiStatCard
                  title="Receita / Lucro Bruto"
                  value={workspace.financialSummary?.hasData ? formatBrlFromCents(workspace.financialSummary.totalRevenueCents) : '—'}
                  subtitle={
                    workspace.financialSummary?.hasData
                      ? `Lucro Bruto: ${formatBrlFromCents(workspace.financialSummary.grossProfitCents)} (${formatPct(workspace.financialSummary.grossMarginPct)})`
                      : 'Sem vendas lançadas'
                  }
                  tone="cyan"
                  onClick={() => goToSection('gestao-financeira')}
                />
                <KpiStatCard
                  title="Resultado Operacional"
                  value={workspace.financialSummary?.hasData ? formatBrlFromCents(workspace.financialSummary.operatingResultCents) : '—'}
                  subtitle={
                    workspace.financialSummary?.hasData
                      ? `Margem Op.: ${formatPct(workspace.financialSummary.operatingMarginPct)}`
                      : 'Aguardando DRE'
                  }
                  tone={
                    (workspace.financialSummary?.operatingResultCents || 0) >= 0 ? 'green' : 'red'
                  }
                  onClick={() => goToSection('gestao-financeira')}
                />
                <KpiStatCard
                  title="Valor em Estoque"
                  value={workspace.financialSummary?.hasData ? formatBrlFromCents(workspace.financialSummary.totalInventoryValueCents) : '—'}
                  subtitle={`${workspace.financialSummary?.criticalStockItemsCount || 0} item(ns) para repor`}
                  tone={(workspace.financialSummary?.criticalStockItemsCount || 0) > 0 ? 'amber' : 'green'}
                  onClick={() => goToSection('gestao-financeira')}
                />
                <KpiStatCard
                  title="Reputação Consumidores"
                  value={
                    workspace.reputationProfile?.googleRating
                      ? `${workspace.reputationProfile.googleRating}/5 ★`
                      : `${workspace.reviews.length} aval.`
                  }
                  subtitle={
                    workspace.reputationProfile?.reclameAquiScore
                      ? `Reclame Aqui: ${workspace.reputationProfile.reclameAquiScore}`
                      : 'Google Reviews & Central'
                  }
                  tone="cyan"
                  onClick={() => goToSection('consumidores')}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">INDICADORES MACROECONÔMICOS OFICIAIS (BCB / IBGE / SEFAZ)</div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {macroIndicators.map((m) => (
                  <KpiStatCard
                    key={m.code}
                    title={m.label}
                    value={m.status === 'ok' ? `${m.value} ${m.unit}` : 'Indisponível'}
                    subtitle={`${m.source}${m.referenceDate ? ` · ${m.referenceDate}` : ''}`}
                    tone={m.status === 'ok' ? 'cyan' : 'amber'}
                  />
                ))}
              </div>
            </div>

            {metricsSeriesLabels.length > 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                <h3 className="text-sm font-bold">Evolução da Receita Registrada (R$)</h3>
                <TrendLineChart
                  labels={metricsSeriesLabels}
                  series={[{ name: 'Faturamento (R$)', color: '#20C5D5', values: metricsSeriesValues }]}
                />
              </div>
            ) : (
              <EmptyEvidenceBox
                title="Sem série histórica de faturamento"
                description="Importe uma planilha ou lance períodos financeiros em Documentos e Relatórios para visualizar o gráfico de evolução."
                actionLabel="Ir para Documentos"
                onAction={() => goToSection('documentos')}
              />
            )}
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* HISTÓRICO E NOTIFICAÇÕES / MINHA ASSINATURA / CONFIG & LGPD      */}
      {/* ================================================================ */}
      {section === 'historico' && (
        <div className="space-y-5">
          <PageHeader
            kicker="CONTA"
            title="Histórico e notificações"
            description="Log persistente de auditoria e alertas reais da sua empresa no PostgreSQL."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Registro de Auditoria</h2>
                <div className="flex gap-1">
                  {['Todas', 'Produtos', 'Empresa'].map((f) => (
                    <button key={f} type="button" onClick={() => setNotifFilter(f)} className={`rounded px-2 py-1 text-[11px] cursor-pointer ${notifFilter === f ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : 'bg-[var(--bg-card-secondary)] text-[var(--text-secondary)]'}`}>{f}</button>
                  ))}
                </div>
              </div>
              {workspace.auditLogs.length === 0 ? (
                <div className="text-[var(--text-secondary)]">Nenhum evento registrado ainda.</div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {workspace.auditLogs
                    .filter((l) => notifFilter === 'Todas' || (notifFilter === 'Produtos' && l.entityType === 'product') || (notifFilter === 'Empresa' && l.entityType === 'company'))
                    .map((log) => (
                      <div key={log.id} className="py-2.5 flex justify-between gap-4">
                        <div>
                          <strong>{log.action}</strong> · {log.entityType} #{log.entityId}
                          <div className="text-[var(--text-secondary)]">{log.userEmail}</div>
                        </div>
                        <span className="font-mono text-[var(--text-secondary)] shrink-0">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3 text-xs self-start">
              <h2 className="text-sm font-bold">Alertas da Conta</h2>
              {workspace.products.some((p) => p.stockQty <= 5) ? (
                <div className="rounded-lg border border-[#F2B84B]/40 bg-[#F2B84B]/10 p-3 text-[#F2B84B]">
                  Há produtos com estoque baixo (≤ 5 unidades) no catálogo.
                </div>
              ) : (
                <div className="text-[var(--text-secondary)]">Sem alertas críticos de estoque no momento.</div>
              )}
              {!hasInternalMetrics && (
                <div className="rounded-lg border border-[#20C5D5]/30 bg-[#20C5D5]/10 p-3 text-[#20C5D5]">
                  Importe seu faturamento para desbloquear cruzamento completo externo × interno.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'plano' && (
        <div className="space-y-6 text-xs">
          <PageHeader
            kicker="CONTA"
            title="Minha assinatura"
            description="Seu plano atual, módulos incluídos e contratação demonstrativa."
          />

          <div className="rounded-xl border border-[#F2B84B]/30 bg-[#F2B84B]/10 p-3 text-[#F2B84B]">
            {PAYMENT_NOTICE_DEMO}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(PLANS_CONFIG).map((p) => {
              const isCurrent = workspace.subscription?.planCode === p.code;
              return (
                <div key={p.code} className={`rounded-xl border p-5 bg-[var(--bg-card)] space-y-3 flex flex-col justify-between ${isCurrent ? 'border-[#20C5D5] ring-1 ring-[#20C5D5]/30' : 'border-[var(--border-subtle)]'}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">{p.name}</span>
                      {isCurrent && <StatusBadge kind="aprovada" customLabel="Plano Atual" />}
                    </div>
                    <div className="font-mono text-2xl font-bold">
                      R$ {p.monthlyPrice.toFixed(2).replace('.', ',')}<span className="text-xs font-normal text-[var(--text-secondary)]">/mês</span>
                    </div>
                    <div className="text-[var(--text-secondary)]">Anual: R$ {p.annualMonthlyEquivalent.toFixed(2).replace('.', ',')}/mês ({ANNUAL_DISCOUNT_LABEL})</div>
                    <ul className="space-y-1 pt-2 border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/beta/companies/${activeCompanyId}/subscription`, {
                          method: 'PUT',
                          body: JSON.stringify({ planCode: p.code, billingCycle: workspace.subscription?.billingCycle || 'monthly' }),
                        });
                        showToast(`Plano atualizado para ${p.name} (contratação demonstrativa).`);
                        loadWorkspace();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
                      }
                    }}
                    className={`w-full rounded-lg py-2 font-semibold cursor-pointer ${isCurrent ? 'bg-[#15365F] text-white' : 'bg-[#20C5D5] text-[#06132D]'}`}
                  >
                    {isCurrent ? 'Plano Ativo' : `Selecionar ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLAN_ADDONS.map((ad) => (
              <div key={ad.code}>
                <div className="font-semibold">{ad.name} — R$ {ad.monthlyPrice.toFixed(2).replace('.', ',')}</div>
                <div className="text-[var(--text-secondary)]">{ad.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'configuracoes' && (
        <div className="space-y-5 text-xs">
          <PageHeader
            kicker="CONTA"
            title="Configurações, Equipe e LGPD"
            description="Dados cadastrais, controle de acesso por perfil (RBAC) e direitos do titular."
            actions={
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'empresa', label: 'Dados da Empresa' },
                  { id: 'equipe', label: 'Equipe (RBAC)' },
                  { id: 'preferencias', label: 'Preferências (Firestore)' },
                  { id: 'lgpd', label: 'Privacidade e LGPD' },
                ].map((t) => (
                  <button key={t.id} type="button" onClick={() => setConfigTab(t.id as typeof configTab)} className={`rounded-lg px-3 py-1.5 font-medium cursor-pointer ${configTab === t.id ? 'bg-[#20C5D5] text-[#06132D] font-semibold' : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            }
          />

          {configTab === 'empresa' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiFetch(`/api/beta/companies/${activeCompanyId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(companyEdit),
                  });
                  showToast('Dados da empresa atualizados.');
                  loadWorkspace();
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Erro ao salvar dados.');
                }
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Nome da empresa</label>
                <input type="text" value={companyEdit.name || ''} onChange={(e) => setCompanyEdit({ ...companyEdit, name: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Segmento</label>
                <input type="text" value={companyEdit.segment || ''} onChange={(e) => setCompanyEdit({ ...companyEdit, segment: e.target.value })} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Cidade / UF</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={companyEdit.city || ''} onChange={(e) => setCompanyEdit({ ...companyEdit, city: e.target.value })} className="col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                  <input type="text" maxLength={2} value={companyEdit.state || ''} onChange={(e) => setCompanyEdit({ ...companyEdit, state: e.target.value.toUpperCase() })} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] mb-1">Logotipo</label>
                <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card-secondary)] px-3 py-2 cursor-pointer">
                  <Upload className="h-4 w-4 text-[#20C5D5]" />
                  <span>Atualizar logotipo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const url = await uploadCompanyImage(f);
                        setCompanyEdit((prev) => ({ ...prev, logoUrl: url }));
                        showToast('Logotipo enviado. Clique em Salvar Alterações.');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Erro no upload.');
                      }
                    }}
                  />
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" className="rounded-lg bg-[#20C5D5] px-5 py-2 text-[#06132D] font-semibold cursor-pointer">
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

          {configTab === 'equipe' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
              <h2 className="text-base font-bold">Membros e Controle de Acesso (RBAC)</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await apiFetch(`/api/beta/companies/${activeCompanyId}/members`, {
                      method: 'POST',
                      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
                    });
                    setInviteEmail('');
                    showToast('Convite registrado.');
                    loadWorkspace();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Erro ao convidar membro.');
                  }
                }}
                className="flex flex-wrap gap-2"
              >
                <input type="email" required placeholder="E-mail do colaborador" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1 min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2">
                  <option value="admin">Administrador</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Leitor</option>
                </select>
                <button type="submit" className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer">Convidar</button>
              </form>
              <div className="divide-y divide-[var(--border-subtle)]">
                {workspace.members.map((m) => (
                  <div key={m.id} className="py-2 flex justify-between">
                    <span>{m.email}</span>
                    <span className="font-mono text-[#20C5D5]">{m.role} · {m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {configTab === 'preferencias' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingPrefs(true);
                try {
                  await updatePreferences({
                    theme: preferences.theme,
                    defaultRadiusKm: preferences.defaultRadiusKm,
                    preferredTravelMode: preferences.preferredTravelMode,
                  });
                  showToast('Preferências salvas no Firestore.');
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Erro ao salvar preferências.');
                } finally {
                  setSavingPrefs(false);
                }
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-5"
            >
              <div>
                <h2 className="text-base font-bold">Preferências Pessoais do Usuário</h2>
                <p className="text-[var(--text-secondary)] mt-1">
                  Armazenadas exclusivamente no Firebase Firestore para sua conta autenticada. Dados corporativos continuam no PostgreSQL (Cloud SQL).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Tema da Interface</label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => {
                      const val = e.target.value === 'light' ? 'light' : 'dark';
                      updatePreferences({ theme: val }).catch(() => {});
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
                  >
                    <option value="dark">Escuro Executivo (Padrão)</option>
                    <option value="light">Claro Corporativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Raio Padrão do Mapa (km)</label>
                  <input
                    type="number"
                    min={0.5}
                    max={200}
                    step={0.5}
                    value={preferences.defaultRadiusKm}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      if (!Number.isNaN(parsed)) {
                        updatePreferences({
                          defaultRadiusKm: Math.max(0.5, Math.min(200, parsed)),
                        }).catch(() => {});
                      }
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-secondary)] mb-1">Modo de Rota Padrão</label>
                  <select
                    value={preferences.preferredTravelMode}
                    onChange={(e) => {
                      const val =
                        e.target.value === 'WALK' || e.target.value === 'TWO_WHEELER'
                          ? e.target.value
                          : 'DRIVE';
                      updatePreferences({ preferredTravelMode: val }).catch(() => {});
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm"
                  >
                    <option value="DRIVE">Carro (DRIVE)</option>
                    <option value="WALK">A pé (WALK)</option>
                    <option value="TWO_WHEELER">Moto (TWO_WHEELER)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#20C5D5] px-5 py-2 text-[#06132D] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {savingPrefs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Salvar Preferências</span>
                </button>
              </div>
            </form>
          )}

          {configTab === 'lgpd' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
              <h2 className="text-base font-bold">Privacidade, Consentimentos e LGPD</h2>
              <p className="text-[var(--text-secondary)]">
                Todos os dados desta empresa estão isolados por autenticação e validação estrita de tenant no PostgreSQL.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lgpd-export-${workspace.company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
                    a.click();
                    apiFetch(`/api/beta/companies/${activeCompanyId}/lgpd`, {
                      method: 'POST',
                      body: JSON.stringify({ recordType: 'export_request', scope: 'Portabilidade JSON completa' }),
                    })
                      .then(() => loadWorkspace())
                      .catch(() => {});
                  }}
                  className="rounded-lg bg-[#20C5D5] px-4 py-2 text-[#06132D] font-semibold cursor-pointer"
                >
                  Exportar Todos os Meus Dados (JSON)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch(`/api/beta/companies/${activeCompanyId}/lgpd`, {
                        method: 'POST',
                        body: JSON.stringify({ recordType: 'deletion_request', scope: 'Exclusão de dados corporativos' }),
                      });
                      showToast('Solicitação de exclusão LGPD registrada no histórico.');
                      loadWorkspace();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Erro ao registrar solicitação.');
                    }
                  }}
                  className="rounded-lg border border-[#EF6464]/40 text-[#EF6464] px-4 py-2 font-medium cursor-pointer"
                >
                  Solicitar Exclusão de Dados
                </button>
              </div>
              <div className="divide-y divide-[var(--border-subtle)] pt-2">
                {workspace.lgpdRecords.map((r) => (
                  <div key={r.id} className="py-2 flex justify-between">
                    <span>{r.recordType} · {r.scope}</span>
                    <span className="font-mono text-[var(--text-secondary)]">{r.status} · {new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
};
